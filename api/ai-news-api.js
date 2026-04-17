/**
 * AI NEWS — 統合API
 *
 * POST /api/ai-news-api
 * Body: { action: "digest" | "tts", ...params }
 *
 * action=digest: Claude Haiku でニュースダイジェストスクリプトを生成
 *   params: { execSummary, mustKnow, thisWeek }
 *   response: { script: "..." }
 *
 * action=tts: OpenAI TTS API で音声生成
 *   params: { text: "..." }
 *   response: audio/mpeg (MP3バイナリ)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action } = req.body || {};

  if (action === 'digest') return handleDigest(req, res);
  if (action === 'tts') return handleTTS(req, res);
  return res.status(400).json({ error: 'action は "digest" または "tts" を指定してください' });
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
        voice: 'shimmer',
        input: text,
        instructions: `You are a warm, charismatic morning radio show host on a Japanese corporate radio program "マーケティング・モーニング". Your audience is marketing professionals commuting to work with headphones.

SPEAKING STYLE:
- Speak as if you are genuinely excited to share this news with a colleague friend
- Use natural breathing pauses between sentences (not mechanical)
- Vary your pitch significantly — rise on important points, soften on details
- Add subtle emotional inflections: slight smile on good news, thoughtful tone on analysis
- Use the natural rhythm of spoken Japanese, not read-aloud flat delivery
- Emphasize key numbers and proper nouns with slightly slower pace and higher pitch
- After transition words like 「では」「続いて」「一方で」, take a brief natural pause
- End statements with genuine warmth, as if speaking to one person directly

AVOID:
- Monotone, robotic reading
- Uniform pace throughout
- Treating every sentence identically
- Sounding like a text-to-speech system

DELIVERY:
- Opening greeting: warm, upbeat, smiling
- News content: engaged, conversational, occasionally emphatic
- Transitions: brief pauses with slightly softer tone
- Closing: friendly, encouraging, leaving listener energized

Think: you are a real human who cares about your audience's day, not a newsreader.`,
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
