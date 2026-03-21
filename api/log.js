export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  const endpoint = process.env.LOG_ENDPOINT;
  if (!endpoint) return res.status(200).json({ ok: false, reason: 'no endpoint' });

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
  } catch (_) {}

  res.status(200).json({ ok: true });
}
