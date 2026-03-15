export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { url } = req.body;
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: '有効なYouTube URLではありません' });

  // タイトルは oEmbed で確実に取得
  let title = '';
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      title = oembedData.title || '';
    }
  } catch (_) {}

  // 字幕は InnerTube API で取得（スクレイピングよりbot判定されにくい）
  try {
    const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20231121.09.00',
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20231121.09.00',
            hl: 'ja',
            gl: 'JP',
          },
        },
      }),
    });

    if (!playerRes.ok) {
      return res.status(200).json({ segments: null, title });
    }

    const playerData = await playerRes.json();
    if (!title) title = playerData.videoDetails?.title || '';

    const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
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
    return res.status(200).json({ segments: null, title });
  }
}

function extractVideoId(url) {
  const m = (url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
