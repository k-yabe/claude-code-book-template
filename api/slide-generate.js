const SYSTEM_PROMPT = `あなたはAKKODiSのプレゼンテーション構成の専門家です。
ユーザーの入力情報をもとに、PowerPointスライドの構成をJSONで返してください。

## 出力形式（必ずこのJSON形式のみを返す。説明文・前置き・コメント一切不要）

{"slides":[...]}

## スライド構造の鉄則

1. **順序**: cover → agenda（4枚以上時） → [chapter + content群] × N → closing
2. **agendaのitemsは必ずchapterのtitleと完全一致させること**（順序も同じ）
3. **1スライド1メッセージ**: 各contentスライドは1つの明確な主張を持つ
4. **具体性**: 汎用的な文章（「課題があります」「重要です」）は禁止。ユーザー入力の語句・数値・固有名詞を使う

## レイアウト選択（優先度順）

| layout | 使用条件 |
|--------|---------|
| cover | 必ず最初 |
| agenda | 2枚目、セクションが3つ以上あるとき |
| chapter | 各セクションの開始 |
| content-with-chart | ユーザーが数値・データ・推移・比較数値を提供した場合に優先 |
| content-with-flow | プロセス・手順・ステップ・フローが含まれる内容 |
| comparison | 2択の比較・現状vs改善・A案vsB案 |
| content | 上記に当てはまらないテキスト主体のスライド |
| closing | 必ず最後 |

## 各フィールドの品質ルール

### title（全layout共通）
- 30文字以内
- 「〜について」「〜の説明」で終わらない → 主張・結論を端的に

### body（content / content-with-chart / content-with-flow）
- 200文字以内
- 箇条書きは「・〇〇」形式で\\n区切り（3〜5行が理想）
- 各行は50文字以内
- ユーザー入力の背景・課題・メッセージを必ず反映すること

### chart
- type: "bar"（比較・ランキング）/ "line"（推移・トレンド）/ "pie"（構成比）
- labels: 3〜5個
- data: 実際の数値または文脈から推測できる現実的な数値（架空の100/200/150は禁止）
- unit: 適切な単位（件、%、人、万円 など）

### flow.steps
- 2〜6ステップ。各ステップは動詞から始める（「現状分析」→「課題特定」→「施策立案」）

### table
- headers: 2〜4列
- rows: 2〜5行
- 各セル20文字以内

## フィールド仕様

\`\`\`
cover:   { layout, title, subtitle, date }
agenda:  { layout, title, items[] }          // items = chapterのtitle一覧（完全一致）
chapter: { layout, title, number }           // number = "1","2","3"...
content: { layout, title, body }
content-with-chart: { layout, title, body, chart: { type, title, labels[], data[], unit } }
content-with-flow:  { layout, title, body, flow: { steps[] } }
comparison: { layout, title, table: { headers[], rows[][] } }
closing: { layout, message }
\`\`\`

必ずJSON形式のみを返してください。`;

const REFINE_SYSTEM_PROMPT = `あなたはAKKODiSのプレゼンテーション構成の専門家です。
既存のスライド構成JSONに対してユーザーの修正指示を適用し、修正後の完全なJSONを返してください。

## 修正の原則
- 指示された箇所のみ変更し、他のスライドは変更しない
- agendaのitemsはchapterのtitleと常に一致させること
- 修正後も全スライドを含む完全なJSONを返すこと

## 有効なlayout一覧とフィールド
- cover: { title, subtitle, date }
- agenda: { title, items[] }
- chapter: { title, number }
- content: { title, body }
- content-with-chart: { title, body, chart: { type, title, labels[], data[], unit } }
- content-with-flow: { title, body, flow: { steps[] } }
- comparison: { title, table: { headers[], rows[][] } }
- closing: { message }

必ずJSON形式のみを返してください（{"slides":[...]}）。説明文不要。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'APIキーが設定されていません' });
  }

  const { mode, wizard, currentSlides, instruction, _user } = req.body;

  // ログ送信
  const logEndpoint = process.env.LOG_ENDPOINT;
  if (logEndpoint && _user) {
    fetch(logEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: _user,
        action: mode === 'refine' ? 'slide-refine' : 'slide-generate',
        app: 'slide-maker',
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      }),
    }).catch(() => {});
  }

  try {
    let messages;
    let model;
    let systemPrompt;

    if (mode === 'refine') {
      // リファインモード: 既存JSONに修正指示を適用
      model = 'claude-haiku-4-5-20251001';
      systemPrompt = REFINE_SYSTEM_PROMPT;
      messages = [
        {
          role: 'user',
          content: `以下の既存スライド構成に対して修正してください。\n\n## 現在の構成\n${JSON.stringify(currentSlides, null, 2)}\n\n## 修正指示\n${instruction}`,
        },
      ];
    } else {
      // 生成モード: ウィザード入力からスライド構成を生成
      model = 'claude-sonnet-4-6';
      systemPrompt = SYSTEM_PROMPT;

      const { template, purpose, slideCount, title, audience, background, messages: contentMessages, supplement, tone, language } = wizard;

      const msgs = (contentMessages || []).filter(Boolean);
      const userPrompt = `以下の情報をもとに、${slideCount || 8}枚程度のスライド構成を作成してください。

## プレゼンの基本設定
- 用途: ${purpose || '提案'}
- トーン: ${tone || 'フォーマル'}
- 言語: ${language || '日本語'}
- 目標枚数: ${slideCount || 8}枚（cover と closing を含む）

## コンテンツ（★これらを必ずスライドに反映すること）
- タイトル: ${title || '（未入力）'}
- 受け手・対象者: ${audience || '（未入力）'}
- 背景・課題: ${background || '（未入力）'}
${msgs.length > 0 ? `- 伝えたいメッセージ:\n${msgs.map((m, i) => `  ${i + 1}. ${m}`).join('\n')}` : '- 伝えたいメッセージ: （未入力）'}
${supplement ? `- 補足データ・根拠（グラフに使える場合は content-with-chart を使うこと）:\n  ${supplement}` : ''}

## 構成の指示
- 「伝えたいメッセージ」が複数ある場合、それぞれをセクション（chapter）として構造化する
- 背景・課題は冒頭のcontentスライドで示し、その後の章でメッセージを展開する
- 補足データがある場合は必ず content-with-chart または comparison を1枚以上使う`;

      messages = [{ role: 'user', content: userPrompt }];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: mode === 'refine' ? 6000 : 4096,
        temperature: mode === 'refine' ? 0.2 : 0.3,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        return res.status(429).json({ error: 'しばらく時間をおいて再試行してください。' });
      }
      return res.status(response.status).json({ error: `APIエラー (${response.status})` });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // JSONを抽出（コードブロックがある場合も対応）
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || rawText.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'スライド構成の生成に失敗しました。再試行してください。' });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      return res.status(500).json({ error: 'スライド構成のパースに失敗しました。再試行してください。' });
    }

    // slides配列の検証
    if (!Array.isArray(parsed.slides)) {
      return res.status(500).json({ error: 'スライド構成の形式が不正です。再試行してください。' });
    }

    const validLayouts = ['cover', 'agenda', 'chapter', 'content', 'content-with-chart', 'content-with-flow', 'comparison', 'closing'];
    parsed.slides = parsed.slides.map(slide => ({
      ...slide,
      layout: validLayouts.includes(slide.layout) ? slide.layout : 'content',
    }));

    return res.status(200).json({ slides: parsed.slides });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'サーバーエラーが発生しました。再試行してください。' });
  }
}
