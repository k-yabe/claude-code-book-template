export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URLが必要です' });
  }

  // YouTube動画IDを抽出
  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'YouTube URLを認識できません' });
  }

  try {
    // 動画ページを取得してタイトルと字幕トラック情報を取得
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      },
    });
    if (!pageRes.ok) throw new Error('YouTube ページの取得に失敗しました');

    const html = await pageRes.text();

    // タイトル抽出
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = (titleMatch?.[1] || '').replace(' - YouTube', '').trim();

    // playerResponse から字幕トラック情報を取得
    const captionsMatch = html.match(/"captions":\s*(\{.*?"captionTracks":\s*\[.*?\].*?\})/s);
    if (!captionsMatch) {
      // innertube API経由でも試行
      const transcript = await fetchViaInnerTube(videoId);
      if (transcript) {
        return res.status(200).json({ title: title || videoId, text: transcript.slice(0, 15000) });
      }
      return res.status(422).json({ error: 'この動画には字幕がありません。手動生成字幕のみの動画は対応していません。' });
    }

    // captionTracks を抽出
    const tracksMatch = html.match(/"captionTracks":\s*(\[.*?\])/s);
    if (!tracksMatch) {
      return res.status(422).json({ error: '字幕トラック情報を取得できません' });
    }

    let tracks;
    try {
      tracks = JSON.parse(tracksMatch[1]);
    } catch {
      return res.status(422).json({ error: '字幕トラック情報の解析に失敗しました' });
    }

    // 日本語字幕を優先、次に英語、なければ最初のトラック
    const jaTrack = tracks.find(t => t.languageCode === 'ja');
    const enTrack = tracks.find(t => t.languageCode === 'en');
    const track = jaTrack || enTrack || tracks[0];

    if (!track?.baseUrl) {
      return res.status(422).json({ error: '字幕URLが見つかりません' });
    }

    // 字幕XMLを取得
    const captionRes = await fetch(track.baseUrl);
    if (!captionRes.ok) throw new Error('字幕データの取得に失敗しました');

    const captionXml = await captionRes.text();

    // XMLからテキスト抽出
    const lines = [];
    const regex = /<text[^>]*>([^<]*)<\/text>/g;
    let match;
    while ((match = regex.exec(captionXml)) !== null) {
      const text = decodeEntities(match[1]).trim();
      if (text) lines.push(text);
    }

    if (lines.length === 0) {
      return res.status(422).json({ error: '字幕テキストが空です' });
    }

    const transcript = lines.join(' ');
    const lang = track.languageCode === 'ja' ? '日本語' : track.languageCode === 'en' ? '英語' : track.languageCode;

    return res.status(200).json({
      title,
      text: transcript.slice(0, 15000),
      language: lang,
      videoId,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// innertube API経由での字幕取得（フォールバック）
async function fetchViaInnerTube(videoId) {
  try {
    const r = await fetch('https://www.youtube.com/youtubei/v1/get_transcript?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20240101' } },
        params: btoa(`\n\x0b${videoId}`),
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const segments = data?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer
      ?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments;
    if (!segments) return null;
    return segments
      .map(s => s.transcriptSegmentRenderer?.snippet?.runs?.map(r => r.text).join('') || '')
      .filter(Boolean)
      .join(' ');
  } catch {
    return null;
  }
}

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
