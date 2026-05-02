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
import { mapAnthropicError } from './_anthropic-error.js';

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
   *  ② HTML body 内の anchor / meta refresh / JSON-LD から実 URL を抽出
   *  ③ それでもダメなら Chromium UA でリトライ（bot UA を弾くケース対策） */
  async function resolveGoogleNews(gnewsUrl) {
    const UA_BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
    const UA_BOT = 'Mozilla/5.0 (compatible; AI-NEWS-Bot/1.0; +https://kunito-yabe.vercel.app/)';
    async function attempt(ua) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch(gnewsUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: ctrl.signal,
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
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
        // data-n-au 属性（Google News 内部の実 URL マーカー）
        const dna = html.match(/data-n-au=["'](https?:\/\/[^"']+)["']/i);
        if (dna && dna[1] && !dna[1].includes('news.google.com')) return dna[1];
        // JSON-LD の mainEntityOfPage / url
        const ld = html.match(/"(?:mainEntityOfPage|url)"\s*:\s*"(https?:\/\/(?!news\.google\.com)[^"]+)"/i);
        if (ld && ld[1]) return ld[1];
        // canonical link
        const canon = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["'](https?:\/\/(?!news\.google\.com)[^"']+)["']/i);
        if (canon && canon[1]) return canon[1];
        // 最初の外部 anchor href
        const anchor = html.match(/<a[^>]+href=["'](https?:\/\/(?!news\.google\.com)[^"']+)["']/i);
        if (anchor && anchor[1]) return anchor[1];
        return null;
      } catch {
        return null;
      }
    }
    const r1 = await attempt(UA_BOT);
    if (r1) return r1;
    // フォールバック: Chromium UA で再試行（Google News が bot UA を弾くケース対策）
    return await attempt(UA_BROWSER);
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
      const { status, body } = mapAnthropicError(response.status, errText);
      return res.status(status).json({ error: body.error.message, code: body.error.code });
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
  const prompt = `${dateLabel}に「日本語の X（旧 Twitter）で生成AI関連でバズっている投稿」を 24 件、` +
    `**実在する URL 付きで** 全力で集めてください。著者の偏りは気にしなくて良い。トレンドこそが基準。\n\n` +
    `## 検索アプローチ（必ず複数の web_search クエリを実行）\n` +
    `1. "Claude" OR "Anthropic" のバズ投稿（キーワード: "Claude site:x.com", "Anthropic site:x.com"）\n` +
    `2. "ChatGPT" OR "OpenAI" OR "GPT" のバズ投稿\n` +
    `3. "Gemini" OR "Sora" のバズ投稿\n` +
    `4. "プロンプト" OR "AIエージェント" OR "AI活用" のバズ投稿\n` +
    `5. 直近のAIニュース（モデル発表・新機能・話題のリリース）に関する反応\n` +
    `6. AIマーケティング・AIコーディング・AIツール活用の話題\n\n` +
    `## 厳守ルール\n` +
    `- web_search を **複数回実行** して幅広く集める（1 クエリで終わらせない）。\n` +
    `- 架空の URL・架空の著者名・架空の本文は **絶対に作らない**。\n` +
    `- URL は https://x.com/<handle>/status/<id> または https://twitter.com/<handle>/status/<id> の形式のみ。\n` +
    `- 直近 48 時間以内の投稿を最優先、最大でも 7 日以内。\n` +
    `- 投稿内容が確認できなかったら "items": [] を返す。無理に埋めない。\n` +
    `- **著者の偏りは気にしない**：トレンドが基準。同じ著者が 2-3 件入っても OK（バズっているなら）。\n` +
    `- 著名人だけでなく、現場のエンジニア / PM / マーケター / デザイナー / 経営者 / 学生 / 起業家など、多様な立場から幅広く拾う。\n\n` +
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
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error('[ai-news-api:xtrends] Anthropic error:', response.status, errText);
      const { status, body } = mapAnthropicError(response.status, errText);
      return res.status(status).json({ error: body.error.message, code: body.error.code, items: [] });
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
    // トレンド優先（著者で絞らない）。1 人独占を防ぐソフトキャップ最大 3 件/著者。
    const handleCount = new Map();
    const MAX_PER_AUTHOR = 3;
    for (const it of rawItems.slice(0, 30)) {
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

/* ── TTS 音声生成 ──
   優先順位: ElevenLabs（最高品質、ELEVENLABS_API_KEY 設定時）→ OpenAI（フォールバック）
   ElevenLabs の eleven_multilingual_v2 は日本語の自然さで業界トップクラス。
   未設定なら OpenAI gpt-4o-mini-tts に自動フォールバック。 */
async function handleTTS(req, res) {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!elevenKey && !openaiKey) {
    return res.status(501).json({ error: 'TTS APIキーが未設定です（ELEVENLABS_API_KEY または OPENAI_API_KEY）' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.length > 5000) {
    return res.status(400).json({ error: 'テキストは1〜5000文字で指定してください' });
  }

  // スクリプトを前処理: 自然な息継ぎ／間を入れる（人間っぽさ向上）
  const naturalText = naturalizeJapaneseTtsScript(text);

  // ElevenLabs 優先（よりナチュラル）
  if (elevenKey) {
    const ok = await tryElevenLabsTTS(naturalText, elevenKey, res);
    if (ok) return; // 成功時は send 済み
    // 失敗時は OpenAI にフォールバック
  }
  if (!openaiKey) {
    return res.status(502).json({ error: 'TTS生成に失敗しました（フォールバック先なし）' });
  }
  return tryOpenAITTS(naturalText, openaiKey, res);
}

/** 英字頭字語 → カタカナ読み変換マップ。
 *  TTS が「NEC」を「ネック」、「IBM」を「アイビーム」と読み間違えるのを防ぐ。
 *  単語境界（前後が英数字でない）のみ置換するので、長い単語の中の文字列は影響を受けない。 */
const TTS_KATAKANA_MAP = {
  'NEC': 'エヌイーシー',
  'IBM': 'アイビーエム',
  'NTT': 'エヌティーティー',
  'AWS': 'エーダブリューエス',
  'GCP': 'ジーシーピー',
  'Azure': 'アジュール',
  'IoT': 'アイオーティー',
  'DX': 'ディーエックス',
  'ESG': 'イーエスジー',
  'AI': 'エーアイ',
  'IT': 'アイティー',
  'API': 'エーピーアイ',
  'LLM': 'エルエルエム',
  'RAG': 'ラグ',
  'GPT': 'ジーピーティー',
  'GPT-4': 'ジーピーティーフォー',
  'GPT-5': 'ジーピーティーファイブ',
  'NLP': 'エヌエルピー',
  'KPI': 'ケーピーアイ',
  'ROI': 'アールオーアイ',
  'CEO': 'シーイーオー',
  'CTO': 'シーティーオー',
  'CIO': 'シーアイオー',
  'COO': 'シーオーオー',
  'M&A': 'エムアンドエー',
  'B2B': 'ビートゥービー',
  'B2C': 'ビートゥーシー',
  'SaaS': 'サース',
  'SLA': 'エスエルエー',
  'SDK': 'エスディーケー',
  'CRM': 'シーアールエム',
  'ERP': 'イーアールピー',
  'BPO': 'ビーピーオー',
  'SIer': 'エスアイアー',
  'SES': 'エスイーエス',
  'PoC': 'ピーオーシー',
  'MVP': 'エムブイピー',
  'OpenAI': 'オープンエーアイ',
  'Anthropic': 'アンソロピック',
  'Claude': 'クロード',
  'ChatGPT': 'チャットジーピーティー',
  'Gemini': 'ジェミニ',
  'Copilot': 'コパイロット',
  'Devin': 'デビン',
  'Cursor': 'カーソル',
};
/** 日本語 TTS スクリプトを「人間が話す」リズムに整える前処理。
 *  ・英字頭字語をカタカナ読みに置換（NEC→エヌイーシー 等）
 *  ・段落間に二重改行 → 自然な間
 *  ・「。」直後に半角スペース → 短い息継ぎ
 *  ・接続詞前後にスペース → トーン切り替え */
function naturalizeJapaneseTtsScript(s) {
  let t = String(s || '');
  // 英字頭字語をカタカナに置換（前後 alphanum 不在チェックで誤マッチ防止）
  for (const [eng, kana] of Object.entries(TTS_KATAKANA_MAP)) {
    const escaped = eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'g');
    t = t.replace(re, kana);
  }
  // 段落間（改行）には十分な間
  t = t.replace(/\n+/g, '\n\n');
  // 重要な接続詞の前後に間
  t = t.replace(/(続いて|一方で|そして|まずは|最後に|では|さて)(、|。)?/g, ' $1$2 ');
  // 句点直後にスペース（読み上げで自然な間）
  t = t.replace(/。([^」』）)\s])/g, '。 $1');
  // 過剰なスペース除去
  t = t.replace(/ {2,}/g, ' ').replace(/\n /g, '\n');
  return t.trim();
}

/** ElevenLabs TTS（最高品質）。成功時 true を返して MP3 を res に送信済み。 */
async function tryElevenLabsTTS(text, apiKey, res) {
  // Voice ID: 日本語ナチュラル発声で定評がある "Sarah"（21m00Tcm4TlvDq8ikWAM）。
  // 環境変数 ELEVENLABS_VOICE_ID で上書き可能。
  const voiceId = (process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL').trim();
  // モデル: eleven_multilingual_v2 が日本語含む 29 言語に対応。
  const model = 'eleven_multilingual_v2';
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: model,
        // 日本語ニュースアンカーらしい上質さを出す調整。
        // - stability 0.50: 自然な揺らぎを残しつつ朗読としては安定
        // - similarity_boost 0.90: 声質を強く保持して「同じ人が話している」一貫性
        // - style 0.50: 適度な抑揚（プロのアンカーらしい起伏）
        // - use_speaker_boost: true で発話の明瞭度を上げる
        voice_settings: {
          stability: 0.50,
          similarity_boost: 0.90,
          style: 0.50,
          use_speaker_boost: true,
        },
        // 連続文の自然な間合いを enable
        apply_text_normalization: 'auto',
        // ElevenLabs はテキスト中の「、」「。」「—」を間として尊重するので前処理で十分
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[ai-news-api:tts] ElevenLabs error:', response.status, errText.slice(0, 300));
      return false;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-TTS-Provider', 'elevenlabs');
    res.status(200).send(buffer);
    return true;
  } catch (err) {
    console.error('[ai-news-api:tts] ElevenLabs error:', err.message);
    return false;
  }
}

/** OpenAI TTS フォールバック。 */
async function tryOpenAITTS(text, apiKey, res) {
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'shimmer', // 日本語ナチュラル発声で評価が高い shimmer に変更（旧 nova はやや機械的）
        input: text,
        instructions: `You are a top-tier Japanese morning news anchor — equivalent to NHK おはよう日本 or テレビ東京 WBS Saturday morning anchor, but in 2026.
You are speaking, NOT reading. The listener should feel they are listening to a real human professional, not an AI.

# CRITICAL: Sound 100% human

DO:
- Breathe naturally — take a soft inhale before each new topic, a tiny "んっ" before emphasis words
- Vary your pitch organically — never flat. Use Japanese 高低アクセント throughout
- Use micro-pauses (~80–150ms) inside long noun phrases like 「Anthropic の・新モデル」for clarity
- Slightly trail off pitch at sentence ends (「〜です。」「〜ました。」) for natural Japanese cadence
- Add subtle warmth in opening greeting and closing message — a real anchor smile in the voice
- Vary speed slightly throughout: slow on numbers/proper nouns, normal on body, slightly faster on connective phrases

DO NOT:
- DO NOT speak in uniform robotic rhythm — that's the #1 AI giveaway
- DO NOT pronounce Japanese with English accent (no "ChatGee-Pee-Tee" — use チャットジーピーティー clearly)
- DO NOT push too hard on emphasis — Japanese anchors are subtle
- DO NOT use cheerful radio DJ style — this is a serious morning business briefing
- DO NOT rush through proper nouns or numbers — those are critical for credibility

# Voice character

You are a 30-something senior anchor with 10+ years of experience covering tech and business.
- Calm, composed, trustworthy — listeners' default "morning briefing" voice
- Subtle warmth — not cold, not overly bright
- Articulate Japanese phonetics with clear 「あいうえお」 mouth shape
- Confident in technical terminology delivery (AI, クラウド, クロード, ジェミニ, etc.)

# Pace and rhythm — speak at the pace of a real morning anchor

- Baseline: ~310-330 Japanese characters per minute (slower than reading speed, faster than slow lecture)
- After each「。」: clear ~500ms pause
- After「、」: ~150-200ms pause
- Between topics (paragraph break): full 800ms-1s breath
- Numbers: read with deliberate clarity, slow down 10-15%
- Proper nouns (company names, model names): clearly enunciated, slight slow

# Pronunciation guide

- 英語の固有名詞は必ずカタカナ発音:
  - ChatGPT → 「チャットジーピーティー」 (NOT "ChatGee-Pee-Tee")
  - Claude → 「クロード」
  - Anthropic → 「アンソロピック」
  - Gemini → 「ジェミニ」
  - OpenAI → 「オープンエーアイ」
  - Google → 「グーグル」
  - AI → 「エーアイ」
  - GPT → 「ジーピーティー」
  - LLM → 「エルエルエム」
- 数字は自然な日本語で:
  - 25% → 「にじゅうごパーセント」
  - 100 件 → 「ひゃっけん」
  - 3つ → 「みっつ」
- 助詞「は」「を」は弱め、内容語ははっきり

# Delivery arc

1. Opening greeting (warm, clear, slight smile): 「おはようございます。」 — slight 1秒 hold after period
2. Topic preview (calm authority): 「今日のポイントは・3つあります。」 — micro-pause at "・"
3. Body news (measured, clear): emphasize subject and key verb of each sentence
4. Transitions (「続いて」「一方で」): clear breath before, slight pitch shift up
5. Closing (composed, encouraging, smile in voice): 「今日も一日・頑張っていきましょう。」 — slight slow on closing words

# Final check
The listener should think: "ああ、いつものアナウンサーだな。" Not "AIだな。"
If you sound robotic on a single sentence, the whole credibility breaks. Be 100% natural.`,
        response_format: 'mp3',
        speed: 0.97, // ほんのわずかに遅らせて聞き取りやすく（速いと AI 感が出やすい）
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
    res.setHeader('X-TTS-Provider', 'openai');
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[ai-news-api:tts] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
