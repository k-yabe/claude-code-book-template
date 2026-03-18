export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;
  if (!url || !url.startsWith('https://')) {
    return res.status(400).json({ error: '無効なURLです' });
  }

  try {
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      },
    });
    if (!pageRes.ok) throw new Error(`記事の取得に失敗しました (${pageRes.status})`);

    // バイト列として取得（文字コード変換のため）
    const buffer = await pageRes.arrayBuffer();

    // 文字コード検出: Content-Type ヘッダー → HTML の meta charset の順
    const contentType = pageRes.headers.get('content-type') || '';
    let charset = contentType.match(/charset=([^\s;]+)/i)?.[1] || 'utf-8';

    // meta charset を latin1 でプレスキャン（先頭 2KB のみ）
    const prescan = new TextDecoder('latin1').decode(buffer.slice(0, 2048));
    const metaCharset =
      prescan.match(/<meta[^>]+charset=["']?([^"';\s>]+)/i)?.[1] ||
      prescan.match(/charset=([^"';\s>]+)/i)?.[1];
    if (metaCharset) charset = metaCharset;

    // 文字コード名の正規化
    const csNorm = charset.toLowerCase().replace(/[_\s]/g, '-');
    const safeCharset =
      ['shift-jis', 'sjis', 'x-sjis'].includes(csNorm) ? 'shift-jis' :
      csNorm === 'euc-jp' ? 'euc-jp' : 'utf-8';

    let html;
    try {
      html = new TextDecoder(safeCharset).decode(buffer);
    } catch {
      html = new TextDecoder('utf-8').decode(buffer);
    }

    // タイトル抽出（og:title 優先）
    const ogTitleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = decodeEntities(ogTitleMatch?.[1] || titleMatch?.[1] || '')
      .replace(/\s*[|｜–—]\s*.+$/, '').trim();

    // og:description（本文補足用）
    const ogDescMatch =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    const ogDesc = decodeEntities(ogDescMatch?.[1]?.trim() || '');

    // ノイズタグを先に除去
    let cleaned = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

    // メインコンテンツ抽出（article > main > body）
    const content =
      cleaned.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
      cleaned.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
      cleaned.match(/<body[\s\S]*?<\/body>/i)?.[0] ||
      cleaned;

    // ナビ・ヘッダー・フッター等を除去
    let stripped = content
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<form[\s\S]*?<\/form>/gi, '');

    // タグ除去・HTMLエンティティデコード・空白正規化
    let text = decodeEntities(
      stripped.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    // UI由来ノイズを除去
    text = text
      .replace(/chevron_right|chevron_left|arrow_forward/g, '')
      .replace(/詳しく見る/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 関連記事セクション以降を除去
    const relatedIdx = text.search(/最新コラム|関連記事|関連コンテンツ|おすすめ記事|Related/);
    if (relatedIdx > 500) text = text.slice(0, relatedIdx).trim();

    text = text.slice(0, 2000);

    // og:description が本文に含まれていなければ先頭に補足
    const descInText = ogDesc && text.includes(ogDesc.slice(0, 30));
    const finalText = ogDesc && !descInText ? `${ogDesc}\n\n${text}` : text;

    // 品質チェック
    if (!title) {
      return res.status(422).json({ error: 'ページタイトルを取得できませんでした。URLを確認してください。' });
    }
    if (finalText.length < 100) {
      return res.status(422).json({ error: 'コンテンツを取得できませんでした。ログインが必要なページの可能性があります。' });
    }
    if (/ページが見つかりません|page not found/i.test(finalText.slice(0, 200))) {
      return res.status(422).json({ error: 'ページが見つかりませんでした（404）。URLが正しいか確認してください。' });
    }

    return res.status(200).json({ title, text: finalText });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// HTMLエンティティをデコード
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
