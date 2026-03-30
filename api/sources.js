import { kv } from '@vercel/kv';

const KV_KEY = 'prompt_maker_sources';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET: ソース一覧取得
    if (req.method === 'GET') {
      const sources = await kv.get(KV_KEY) || [];
      return res.status(200).json({ sources });
    }

    // POST: ソース追加
    if (req.method === 'POST') {
      const { title, content, type, user } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'コンテンツが空です' });
      }

      const sources = await kv.get(KV_KEY) || [];
      const newSource = {
        id: Date.now().toString(),
        title: (title || '').trim() || content.trim().slice(0, 40),
        content: content.trim(),
        type: type || 'text',
        user: user || 'unknown',
        createdAt: new Date().toISOString(),
      };
      sources.unshift(newSource);
      await kv.set(KV_KEY, sources);
      return res.status(201).json({ source: newSource });
    }

    // PATCH: ソース部分更新（要約・メモなど）
    if (req.method === 'PATCH') {
      const { id, summary, note } = req.body;
      if (!id) return res.status(400).json({ error: 'IDが必要です' });

      const sources = await kv.get(KV_KEY) || [];
      const source = sources.find(s => s.id === id);
      if (!source) return res.status(404).json({ error: 'ソースが見つかりません' });

      if (summary !== undefined) source.summary = summary;
      if (note !== undefined) source.note = note;
      await kv.set(KV_KEY, sources);
      return res.status(200).json({ source });
    }


    // DELETE: ソース削除
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'IDが必要です' });

      const sources = await kv.get(KV_KEY) || [];
      const filtered = sources.filter(s => s.id !== id);
      await kv.set(KV_KEY, filtered);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    // KV未設定時のフォールバック
    if (err.message?.includes('REDIS') || err.message?.includes('KV') || err.code === 'ERR_MODULE_NOT_FOUND') {
      return res.status(503).json({ error: 'KV_UNAVAILABLE', message: 'Vercel KV が未設定です。localStorageモードで動作します。' });
    }
    return res.status(500).json({ error: err.message });
  }
}
