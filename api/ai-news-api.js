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
  if (!Array.isArray(execSummary) && !Array.isArray(mustKnow)) {
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

  const systemPrompt = `あなたはマーケティングチーム向けの朝の社内ラジオ番組のパーソナリティです。
毎朝5分で、昨日のニュースをわかりやすくダイジェストで伝えます。

## ルール
- 話し言葉で書く。「〜ですね」「〜なんですが」のような自然な口語体
- 難しい専門用語は使わない。使う場合は必ず噛み砕いて説明する
- 「おはようございます」から始め「今日も頑張りましょう」で締める
- 個別の記事を羅列するのではなく、全体の流れ・つながりを意識してストーリーにまとめる
- 「なぜそれが自分たちに関係あるのか」を必ず入れる
- 800〜1200字程度（読み上げで約3〜5分）
- マーケティング部門のメンバーが通勤中に聴く想定

出力はダイジェストの本文のみ。見出しやマークダウンは不要。`;

  const userPrompt = `以下のニュースデータを元に、5分ダイジェストの読み上げスクリプトを作成してください。\n\n${articleLines.join('\n')}`;

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
        max_tokens: 2000,
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
        model: 'tts-1',
        voice: 'nova',
        input: text,
        response_format: 'mp3',
        speed: 1.1,
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
