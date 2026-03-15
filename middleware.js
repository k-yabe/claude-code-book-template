export const config = {
  matcher: '/:path*',
};

export default function middleware(request) {
  const authHeader = request.headers.get('authorization');

  if (authHeader && authHeader.startsWith('Basic ')) {
    const decoded = atob(authHeader.slice(6));
    // "username:password" 形式。パスワード部分のみ検証
    const [username, ...rest] = decoded.split(':');
    const password = rest.join(':');
    const validUser = process.env.AUTH_USER;
    const validPass = process.env.AUTH_PASS;

    if (validUser && validPass && username === validUser && password === validPass) {
      return; // 認証成功 → リクエストをそのまま通す
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
