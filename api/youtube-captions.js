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

  // 字幕は dynamic import で youtube-transcript を使用
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');

    const transcripts = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ja' })
      .catch(() => YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' }))
      .catch(() => YoutubeTranscript.fetchTranscript(videoId));

    if (!transcripts || transcripts.length === 0) {
      return res.status(200).json({ segments: null, title });
    }

    const segments = transcripts
      .map(item => {
        const t = Math.round((item.offset || 0) / 1000);
        const mm = String(Math.floor(t / 60)).padStart(2, '0');
        const ss = String(t % 60).padStart(2, '0');
        const text = (item.text || '').replace(/\n/g, ' ').trim();
        return text ? `[${mm}:${ss}] ${text}` : null;
      })
      .filter(Boolean)
      .join('\n');

    return res.status(200).json({ segments, title });
  } catch (_) {
    return res.status(200).json({ segments: null, title });
  }
}

function extractVideoId(url) {
  const m = (url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
