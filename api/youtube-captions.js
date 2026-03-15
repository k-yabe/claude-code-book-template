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
      const d = await oembedRes.json();
      title = d.title || '';
    }
  } catch (_) {}

  // 字幕は timedtext API を直接叩く（パッケージ不要）
  // ja自動生成 → ja手動 → en自動生成 → en手動 の順で試みる
  const candidates = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ja&kind=asr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ja&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
  ];

  for (const captionUrl of candidates) {
    try {
      const r = await fetch(captionUrl);
      if (!r.ok) continue;
      const data = await r.json();
      const events = data.events || [];
      if (events.length === 0) continue;

      const segments = events
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

      if (segments) return res.status(200).json({ segments, title });
    } catch (_) {}
  }

  return res.status(200).json({ segments: null, title });
}

function extractVideoId(url) {
  const m = (url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
