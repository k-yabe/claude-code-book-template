/**
 * AI NEWS — 統合API
 *
 * POST /api/ai-news-api
 * Body: { action: "digest" | "tts" | "xtrends", ...params }
 *
 * action=digest: Claude Haiku でニュースダイジェストスクリプトを生成
 *   params: { execSummary, mustKnow, thisWeek }
 *   response: { script: "..." }
 *
 * action=tts: OpenAI TTS API で音声生成
 *   params: { text: "..." }
 *   response: audio/mpeg (MP3バイナリ)
 *
 * action=xtrends: Claude + web_search で「今日の注目 X 投稿」をオンデマンド取得
 *   params: {}
 *   response: { items: [{ author, handle, text, url, tag, likes, retweets }, ...] }
 *
 * GET /api/ai-news-api?action=xtrends にも対応（GET キャッシュで 1 時間）
 */
export default async function handler(req, res) {
  // xtrends は GET/POST 両方受ける（GET なら CDN キャッシュが効きやすい）
  if (req.method === 'GET' && (req.query && req.query.action === 'xtrends')) {
    return handleXTrends(req, res);
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action } = req.body || {};

  if (action === 'digest')      return handleDigest(req, res);
  if (action === 'tts')         return handleTTS(req, res);
  if (action === 'xtrends')     return handleXTrends(req, res);
  if (action === 'resolve-ogp') return handleResolveOgp(req, res);
  return res.status(400).json({ error: 'action は "digest" | "tts" | "xtrends" | "resolve-ogp" を指定してください' });
}

/* ── OGP 画像の on-demand 取得（バッチ） ──
   scraper がスクレイプ時に OGP を拾えなかった記事（Google News 系など）に対して、
   クライアントが当該 URL のリストを送ると、各 URL の og:image / twitter:image を返す。
   結果は URL → 画像URL or null のマップで、CDN で 1h + stale-while-revalidate 24h キャッシュ。
   Google News のリダイレクター URL は実記事 URL に解決してから OGP を取得する。 */
async function handleResolveOgp(req, res) {
  const { urls } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls は 1〜20 件の配列で指定してください' });
  }
  const uniq = [...new Set(urls.filter(u => typeof u === 'string' && u.startsWith('http')))].slice(0, 20);
  const OGP_RE_1 = /<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image(?::src)?)["'][^>]*content\s*=\s*["']([^"']+)["']/i;
  const OGP_RE_2 = /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]*(?:property|name)\s*=\s*["'](?:og:image|twitter:image(?::src)?)["']/i;

  /** Google News リダイレクター URL を実記事 URL に解決する。
   *  ① fetch follow-redirect で resp.url が news.google.com 以外になればそれを採用
   *  ② HTML body 内の anchor / meta refresh から実 URL を抽出 */
  async function resolveGoogleNews(gnewsUrl) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const resp = await fetch(gnewsUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-NEWS-Bot/1.0; +https://kunito-yabe.vercel.app/)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en;q=0.8',
        },
      });
      clearTimeout(timer);
      if (resp.url && !resp.url.includes('news.google.com')) return resp.url;
      if (!resp.ok) return null;
      const html = await resp.text();
      // meta refresh から URL 抽出
      const meta = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+url=([^"'>\s]+)/i);
      if (meta && meta[1] && !meta[1].includes('news.google.com')) return meta[1];
      // 本文内の data-n-au 属性（Google News 内部の実 URL マーカー）
      const dna = html.match(/data-n-au=["'](https?:\/\/[^"']+)["']/i);
      if (dna && dna[1] && !dna[1].includes('news.google.com')) return dna[1];
      // 最初の外部 anchor href
      const anchor = html.match(/<a[^>]+href=["'](https?:\/\/(?!news\.google\.com)[^"']+)["']/i);
      if (anchor && anchor[1]) return anchor[1];
      return null;
    } catch {
      return null;
    }
  }

  async function fetchOgp(targetUrl) {
    try {
      let actualUrl = targetUrl;
      // Google News のリダイレクター URL を先に解決
      if (targetUrl.includes('news.google.com')) {
        const real = await resolveGoogleNews(targetUrl);
        if (real) actualUrl = real;
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const resp = await fetch(actualUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-NEWS-Bot/1.0; +https://kunito-yabe.vercel.app/apps/ai-news/)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en;q=0.8',
        },
      });
      clearTimeout(timer);
      if (!resp.ok) return null;
      const reader = resp.body && resp.body.getReader ? resp.body.getReader() : null;
      let html = '';
      if (reader) {
        const decoder = new TextDecoder('utf-8', { fatal: false });
        let bytes = 0;
        while (bytes < 262144) { // 256KB 上限
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          html += decoder.decode(value, { stream: true });
          if (html.toLowerCase().includes('</head>')) break;
        }
        try { reader.cancel(); } catch {}
      } else {
        html = await resp.text();
        if (html.length > 262144) html = html.slice(0, 262144);
      }
      const headEnd = html.toLowerCase().indexOf('</head>');
      const head = headEnd > 0 ? html.slice(0, headEnd) : html;
      const m = head.match(OGP_RE_1) || head.match(OGP_RE_2);
      if (!m) return null;
      let img = String(m[1] || '').trim();
      if (!img) return null;
      try { img = new URL(img, resp.url || actualUrl).href; } catch {}
      return img.startsWith('https://') ? img : null;
    } catch {
      return null;
    }
  }

  const entries = await Promise.all(uniq.map(async (u) => [u, await fetchOgp(u)]));
  const images = Object.fromEntries(entries);
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ images, count: entries.length });
}

/* ── ダイジェスト生成（Claude Haiku） ── */
async function handleDigest(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'APIキーが未設定です' });
  }

  const { execSummary, mustKnow, thisWeek } = req.body || {};
  if ((!Array.isArray(execSummary) || !execSummary.length) && (!Array.isArray(mustKnow) || !mustKnow.length)) {
    return res.status(400).json({ error: '記事データが不足しています' });
  }

  const articleLines = [];
  if (Array.isArray(execSummary) && execSummary.length) {
    articleLines.push('【今日の全体像】');
    execSummary.forEach(s => articleLines.push(`・${s}`));
  }
  if (Array.isArray(mustKnow) && mustKnow.length) {
    articleLines.push('\n【重要ニュース】');
    mustKnow.forEach(n => {
      articleLines.push(`■ ${n.title}`);
      if (n.summary) articleLines.push(`  ${n.summary}`);
      if (n.whyItMatters) articleLines.push(`  影響: ${n.whyItMatters}`);
      if (n.actionItem) articleLines.push(`  アクション: ${n.actionItem}`);
    });
  }
  if (Array.isArray(thisWeek) && thisWeek.length) {
    articleLines.push('\n【注目ニュース】');
    thisWeek.forEach(n => {
      articleLines.push(`■ ${n.title}`);
      if (n.summary) articleLines.push(`  ${n.summary}`);
      if (n.actionItem) articleLines.push(`  アクション: ${n.actionItem}`);
    });
  }

  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const dateLabel = `${today.getMonth()+1}月${today.getDate()}日`;

  const systemPrompt = `あなたはマーケティングチーム向けの朝の社内ラジオ番組のパーソナリティです。
毎朝5分で、昨日のニュースをわかりやすくダイジェストで伝えます。

## 絶対ルール
- 日本語のみで書く。英単語・英語表記は原則使わない。固有名詞で英語が避けられない場合はカタカナ表記にする（例: "ChatGPT"→「チャットジーピーティー」、"Claude"→「クロード」、"Gemini"→「ジェミニ」、"OpenAI"→「オープンエーアイ」、"Google"→「グーグル」、"GPT"→「ジーピーティー」、"AI"→「エーアイ」、"LP"→「ランディングページ」、"SNS"→「エスエヌエス」）
- 日付は「${dateLabel}」と書く（「0」や英数字の日付表記はNG）
- 数字はなるべく漢数字か読みやすい書き方にする（例: "50%"→「五割」or「半分以上」、"3つ"→「みっつ」）
- 記号（%、＆、＃、「」以外）は使わない。括弧は「」のみ
- マークダウン記法、箇条書き、見出しは使わない（読み上げが崩れる）

## 構成（3幕構成を厳守）

### 第1幕：オープニング（冒頭30秒）
- 「おはようございます。${dateLabel}のマーケティング・ニュースダイジェストです。」
- 「今日のポイントは3つあります。」と予告し、重要トピックを1行ずつ紹介

### 第2幕：本編（3〜4分）
- 重要ニュースから順に詳しく解説
- 記事間のつながりを必ず入れる（「この流れを受けて」「一方で」「同じくエーアイ関連では」）
- 各トピックで「なぜ自分たちに関係あるのか」を必ず説明
- 「あなたのチームがやるべきことは」という形で具体的アクションを提示

### 第3幕：まとめ（30秒）
- 「最後にまとめです。」で今日のポイントを3つ振り返り
- 「今日も一日頑張っていきましょう。」で締める

## ルール
- 話し言葉で書く。「〜ですね」「〜なんですが」のような自然な口語体
- 難しい専門用語は使わない。使う場合は必ず噛み砕いて説明する
- 個別の記事を羅列するのではなく、全体の流れ・つながりをストーリーにまとめる
- 1000〜1500字（読み上げで約4〜5分）
- マーケティング部門のメンバーが通勤中に聴く想定

出力はダイジェストの本文のみ。見出しやマークダウンは不要。一切の英単語を含めないこと。`;

  const userPrompt = `以下は本日（${dateLabel}）のニュースです。これを元に、5分ダイジェストの読み上げスクリプトを日本語のみで作成してください。英単語はすべてカタカナに置き換えること。\n\n${articleLines.join('\n')}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ai-news-api:digest] Anthropic error:', response.status, errText);
      return res.status(502).json({ error: 'ダイジェスト生成に失敗しました' });
    }

    const data = await response.json();
    const script = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return res.status(200).json({ script });
  } catch (err) {
    console.error('[ai-news-api:digest] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/* ── X トレンド on-demand 取得（Claude + web_search） ──
   scraper の日次バッチだけでなく、クライアントが初回ロード時に直接呼び出して
   当日最新の X 話題ポストを取得できるようにする。取得結果は CDN で 1 時間キャッシュ。
   URL は https://x.com/<handle>/status/<id> 形式のみ許容。実在確認は Claude の
   web_search に任せ、こちら側でも正規表現でフィルタリング。 */
async function handleXTrends(_req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'APIキーが未設定です', items: [] });
  }
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const dateLabel = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
  const prompt = `${dateLabel}の日本時間の朝から見て、**直近 24 時間以内に投稿された** 日本語の X（旧 Twitter）で` +
    `「いいね・リポスト・引用が多く付いて注目されている、生成AI関連の投稿」を` +
    `**実在する URL 付きで** 16 件挙げてください。\n\n` +
    `## 厳守ルール（破ったら出力を空にする）\n` +
    `- web_search を必ず使って実在を確認すること。\n` +
    `- 架空の URL・架空の著者名・架空の本文は **絶対に作らない**。\n` +
    `- URL は https://x.com/<handle>/status/<id> または https://twitter.com/<handle>/status/<id> の形式のみ。\n` +
    `- 古い投稿（7日以上前）は除外。当日〜前日の投稿を最優先。\n` +
    `- 「2024年」「2023年」「去年」等、鮮度が低いポストは除外。\n` +
    `- 投稿内容が確認できなかったら "items": [] を返す。無理に埋めない。\n` +
    `- **著者は必ず多様にすること**：同じ handle の投稿は最大 2 件まで。最低 8 人以上の異なる発信者から選ぶ。\n` +
    `- 著名人だけでなく、一般エンジニア・PM・マーケター・経営者など多様な立場から拾う。\n\n` +
    `## 検索クエリの例\n` +
    `- "ChatGPT site:x.com" "Claude site:x.com" "生成AI site:x.com"\n` +
    `- 鮮度のために「${dateLabel}」や直近の AI ニュース名（モデル名・機能名）を合わせて検索\n\n` +
    `## 出力フォーマット（JSON のみ、説明文なし、コードフェンス無し）\n` +
    `{"items":[{"author":"表示名","handle":"@xxxx","text":"本文（200字以内に整形可）",` +
    `"url":"https://x.com/<handle>/status/<id>","tag":"短いトピック名"}, ...]}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error('[ai-news-api:xtrends] Anthropic error:', response.status, errText);
      return res.status(502).json({ error: 'X トレンド取得に失敗しました', items: [] });
    }
    const data = await response.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
    // JSON 抽出（Claude はコードフェンス付きで返すことがある）
    let parsed = null;
    try {
      const s = text.indexOf('{'), e = text.lastIndexOf('}');
      if (s >= 0 && e > s) parsed = JSON.parse(text.slice(s, e + 1));
    } catch {
      // trailing comma 救済
      try {
        const s = text.indexOf('{'), e = text.lastIndexOf('}');
        parsed = JSON.parse(text.slice(s, e + 1).replace(/,\s*([}\]])/g, '$1'));
      } catch {}
    }
    const rawItems = (parsed && Array.isArray(parsed.items)) ? parsed.items : [];
    const URL_RE = /^https:\/\/(?:x|twitter)\.com\/[^\/\s]+\/status\/\d+/;
    const items = [];
    const handleCount = new Map(); // 著者ごとに最大 2 件まで（独占防止 + 件数確保）
    const MAX_PER_AUTHOR = 2;
    for (const it of rawItems.slice(0, 20)) {
      const url = String(it.url || '').trim();
      if (!URL_RE.test(url)) continue;
      const handle = String(it.handle || '').trim();
      const author = String(it.author || '').trim();
      const body = String(it.text || '').trim();
      if (!author || !handle || !body) continue;
      const h = handle.replace(/^@/, '').toLowerCase();
      const c = handleCount.get(h) || 0;
      if (c >= MAX_PER_AUTHOR) continue;
      handleCount.set(h, c + 1);
      items.push({
        id: 'xt_' + simpleHash(url),
        author: author.slice(0, 40),
        handle: handle.startsWith('@') ? handle.slice(0, 40) : ('@' + h).slice(0, 40),
        avatar: `https://unavatar.io/x/${h}`,
        text: body.length > 240 ? body.slice(0, 239) + '…' : body,
        tag: String(it.tag || 'AI').slice(0, 20),
        url,
        likes: 3000,   // 「注目されている」と判定済みの前提で client 閾値を通す最低値
        retweets: 0,
      });
    }
    // CDN / Vercel Edge で 1 時間キャッシュ、stale-while-revalidate で 4 時間
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=14400');
    return res.status(200).json({ items, count: items.length, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[ai-news-api:xtrends] error:', err.message);
    return res.status(500).json({ error: err.message, items: [] });
  }
}

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(16).slice(0, 10);
}

/* ── TTS 音声生成（OpenAI） ── */
async function handleTTS(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'TTS APIキーが未設定です' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.length > 5000) {
    return res.status(400).json({ error: 'テキストは1〜5000文字で指定してください' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'nova',
        input: text,
        instructions: `You are a professional Japanese TV news anchor reading the morning business news on NHK or TV Tokyo's morning business program. Your audience is Japanese marketing professionals.

VOICE CHARACTER:
- Clear, authoritative, composed — the voice of a seasoned Japanese news anchor (ニュースアナウンサー)
- Natural Japanese pitch accent (高低アクセント) — NOT flat or monotonic
- Professional, trustworthy, warm but not overly friendly
- Think: NHKおはよう日本 or テレビ東京 WBS anchor

PACE & RHYTHM:
- Baseline pace: calm and measured, about 300 Japanese characters per minute
- Slow down on key numbers, proper nouns (パーソル、グーグル、クロード)
- Speed up slightly on supporting details
- Insert clear pauses at sentence boundaries (「。」) — approximately 0.5 second
- Insert shorter pauses at clause boundaries (「、」)
- Take a longer breath (0.8-1.0s) at paragraph/topic transitions

INTONATION:
- Rising intonation at sentence beginnings, falling at sentence ends (natural Japanese cadence)
- Emphasize subjects and key verbs with slight pitch rise
- Soften descriptive clauses slightly
- Emotional color: professional composure with subtle warmth, never forced excitement

PRONUNCIATION:
- Japanese katakana loanwords: pronounce with Japanese phonetics, not English (e.g., "ChatGPT" = チャットジーピーティー, "Google" = グーグル)
- Numbers: read naturally in Japanese (e.g., "25%" = にじゅうごパーセント)
- Proper nouns: crisp, slightly slowed delivery

AVOID:
- English-accented pronunciation of Japanese words
- Robotic or uniform flat delivery (text-to-speech tone)
- Overly cheerful or "radio DJ" style
- Rushing through numbers or proper nouns
- Filler softness — be crisp and articulate

DELIVERY ARC:
- Opening ("おはようございます…"): calm, warm, professional greeting with clear articulation
- News body: measured, authoritative, emphasize the 3W (what/why/what-to-do)
- Transitions ("続いて…", "一方で…"): clear pause, slight tonal shift
- Closing ("今日も一日…"): composed, encouraging, with slight smile in voice

Target: the listener should feel like they're getting a trusted morning briefing from a senior Japanese business news anchor.`,
        response_format: 'mp3',
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ai-news-api:tts] OpenAI error:', response.status, errText);
      return res.status(502).json({ error: 'TTS生成に失敗しました' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[ai-news-api:tts] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
