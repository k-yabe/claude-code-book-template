export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { url } = req.body;
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: '有効なYouTube URLではありません' });

  // タイトルは oEmbed で確実に取得（APIキー不要）
  let title = '';
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      title = oembedData.title || '';
    }
  } catch (_) { /* タイトル取得失敗は無視 */ }

  // 字幕はページスクレイピングで取得（失敗してもタイトルは返す）
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Cookie': 'CONSENT=YES+1; SOCS=CAESEwgDEgk0OTIxMzkxMjQaAmphIAEaBgiAo_CmBg==',
      },
    });
    const html = await pageRes.text();

    const marker = 'ytInitialPlayerResponse = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) {
      // ページ取得失敗。タイトルだけ返す
      return res.status(200).json({ segments: null, title });
    }

    const jsonStart = startIdx + marker.length;
    let depth = 0, i = jsonStart;
    while (i < html.length) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') { depth--; if (depth === 0) break; }
      i++;
    }
    const playerResponse = JSON.parse(html.slice(jsonStart, i + 1));
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    // oEmbedで取れなかった場合はplayerResponseからも試みる
    if (!title) title = playerResponse.videoDetails?.title || '';

    if (!tracks || tracks.length === 0) {
      return res.status(200).json({ segments: null, title });
    }

    // 日本語優先、なければ英語、なければ最初のトラック
    const track = tracks.find(t => t.languageCode === 'ja')
      || tracks.find(t => t.languageCode === 'en')
      || tracks[0];

    const captionRes = await fetch(track.baseUrl + '&fmt=json3');
    const captionData = await captionRes.json();

    const segments = (captionData.events || [])
      .filter(e => e.segs)
      .map(e => {
        const t = Math.round((e.tStartMs || 0) / 1000);
        const mm = String(Math.floor(t / 60)).padStart(2, '0');
        const ss = String(t % 60).padStart(2, '0');
        const text = e.segs.map(s => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
        return text ? `[${mm}:${ss}] ${text}` : null;
      })
      .filter(Boolean)
      .join('\n');

    return res.status(200).json({ segments, title });
  } catch (err) {
    // スクレイピング失敗。タイトルだけ返す
    return res.status(200).json({ segments: null, title });
  }
}

function extractVideoId(url) {
  const m = (url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
