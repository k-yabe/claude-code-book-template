export const config = {
  matcher: '/:path*',
};

export default function middleware(request) {
  const validPass = (process.env.AUTH_PASS || '').trim();

  const authHeader = request.headers.get('authorization');

  if (validPass && authHeader && authHeader.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice(6).trim());
      const colonIndex = decoded.indexOf(':');
      const password = colonIndex >= 0 ? decoded.slice(colonIndex + 1) : decoded;

      if (password === validPass) {
        return; // 認証OK → そのまま通す
      }
    } catch (_) {
      // base64デコード失敗 → 401へ
    }
  }

  return new Response('このサイトは社内向けです。パスワードを入力してください。', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Marketing Apps"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
