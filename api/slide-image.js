// Unsplash画像検索API — Slide Maker用
// GET /api/slide-image?q=keyword  → { url, thumb, credit }
// POST /api/slide-image { queries: ["keyword1", ...] } → [{ url, thumb, credit }, ...]

export default async function handler(req, res) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    return res.status(200).json({ error: 'UNSPLASH_ACCESS_KEY not configured', fallback: true });
  }

  try {
    if (req.method === 'GET') {
      const q = req.query.q;
      if (!q) return res.status(400).json({ error: 'q parameter required' });
      const result = await searchUnsplash(key, q);
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const { queries } = req.body || {};
      if (!Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: 'queries array required' });
      }
      // 最大20クエリまで（レートリミット対策）
      const limited = queries.slice(0, 20);
      const results = await Promise.all(limited.map(q => searchUnsplash(key, q)));
      return res.status(200).json({ images: results });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('slide-image error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function searchUnsplash(key, query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`;
  const resp = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
  });

  if (!resp.ok) {
    return { query, url: null, thumb: null, credit: null, error: `Unsplash API ${resp.status}` };
  }

  const data = await resp.json();
  const photos = (data.results || []).slice(0, 3);

  if (photos.length === 0) {
    return { query, url: null, thumb: null, credit: null, error: 'No results' };
  }

  // 最も関連性の高い1枚目を返す + 候補3枚
  const primary = photos[0];
  return {
    query,
    url: primary.urls.regular,
    thumb: primary.urls.thumb,
    credit: {
      name: primary.user.name,
      link: primary.user.links.html,
      unsplash: primary.links.html,
    },
    alternatives: photos.slice(1).map(p => ({
      url: p.urls.regular,
      thumb: p.urls.thumb,
      credit: { name: p.user.name, link: p.user.links.html },
    })),
  };
}
