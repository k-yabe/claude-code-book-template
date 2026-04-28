// Marketing Apps ポータル / 各アプリからの「誰がいつ何をしたか」ログを
// Google Apps Script (Web App) に中継するエンドポイント。
//
// 期待する Vercel 環境変数:
//   LOG_ENDPOINT = https://script.google.com/macros/s/<deployment-id>/exec
//
// 期待する POST body (JSON or sendBeacon Blob):
//   { user: string, action: string, app?: string, timestamp?: string }
//
// なお `/index.html` の sendLog() からは navigator.sendBeacon で叩かれるため、
// Content-Type が application/json でないケース (text/plain として届く) もある。
// その場合は req.body が文字列のままなので JSON.parse でフォールバックする。

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const logEndpoint = process.env.LOG_ENDPOINT;
  if (!logEndpoint) {
    // 環境変数未設定時は no-op（デプロイ即死を避ける）
    return res.status(204).end();
  }

  // Vercel Node runtime は Content-Type: application/json なら req.body をパース済 object で渡すが、
  // sendBeacon (Blob: application/json) や text/plain で来た場合は string のままなので保険を入れる
  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = null; }
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Bad Request' });
  }

  const user   = String(payload.user   || '').slice(0, 100).trim();
  const action = String(payload.action || '').slice(0, 50).trim();
  const app    = String(payload.app    || '').slice(0, 100).trim();
  const timestamp = String(
    payload.timestamp ||
    new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  ).slice(0, 40);

  if (!user || !action) {
    return res.status(400).json({ error: 'Bad Request' });
  }

  try {
    // GAS Web App は /exec → googleusercontent へ 302 redirect するので follow を明示
    const r = await fetch(logEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, action, app, timestamp }),
      redirect: 'follow',
    });
    if (!r.ok) {
      // GAS 側が落ちていてもクライアントに 5xx を返さない（UX を阻害しない）
      console.warn(`[api/log] GAS responded ${r.status}`);
    }
  } catch (err) {
    console.warn(`[api/log] forward failed: ${err && err.message}`);
  }

  return res.status(204).end();
}
