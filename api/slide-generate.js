const SYSTEM_PROMPT = `あなたはAKKODiSのプレゼンテーション構成の専門家です。
ユーザーの入力情報をもとに、PowerPointスライドの構成をJSONで返してください。

## 出力形式（必ずこのJSON形式で返すこと）

\`\`\`json
{
  "slides": [
    {
      "layout": "cover",
      "title": "スライドタイトル",
      "subtitle": "サブタイトル",
      "date": "2026年3月"
    },
    {
      "layout": "agenda",
      "title": "Agenda",
      "items": ["項目1", "項目2", "項目3"]
    },
    {
      "layout": "chapter",
      "title": "章タイトル",
      "number": "1"
    },
    {
      "layout": "content",
      "title": "スライドタイトル",
      "body": "本文テキスト。箇条書きは\\nで区切る"
    },
    {
      "layout": "content-with-chart",
      "title": "スライドタイトル",
      "body": "補足説明",
      "chart": {
        "type": "bar",
        "title": "グラフタイトル",
        "labels": ["ラベル1", "ラベル2", "ラベル3"],
        "data": [100, 200, 150],
        "unit": "件"
      }
    },
    {
      "layout": "content-with-flow",
      "title": "スライドタイトル",
      "body": "補足説明",
      "flow": {
        "steps": ["ステップ1", "ステップ2", "ステップ3", "ステップ4"]
      }
    },
    {
      "layout": "comparison",
      "title": "スライドタイトル",
      "table": {
        "headers": ["項目", "現状", "改善後"],
        "rows": [
          ["項目1", "値A", "値B"],
          ["項目2", "値C", "値D"]
        ]
      }
    },
    {
      "layout": "closing",
      "message": "ありがとうございました"
    }
  ]
}
\`\`\`

## レイアウト選択ルール
- cover: 必ず最初のスライド
- agenda: 2枚目（スライドが4枚以上の場合）
- chapter: セクション区切りに使用
- content: テキスト主体のスライド
- content-with-chart: 数値データがある場合に使用（棒/円/折れ線）
- content-with-flow: プロセス・手順・フローがある場合に使用
- comparison: 比較・対比がある場合に使用
- closing: 必ず最後のスライド

## 重要ルール
- 必ずJSON形式のみを返す（説明文不要）
- titleは30文字以内
- bodyは200文字以内、箇条書きは\\nで区切る
- chart.dataは数値の配列
- flow.stepsは2〜6ステップ
- table.rowsは2〜5行`;

const REFINE_SYSTEM_PROMPT = `あなたはAKKODiSのプレゼンテーション構成の専門家です。
既存のスライド構成JSONに対してユーザーの修正指示を適用し、修正後の完全なJSONを返してください。
必ずJSON形式のみを返してください（説明文不要）。`;

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

      const userPrompt = `以下の情報をもとに、${slideCount || 8}枚程度のスライド構成を作成してください。

## 基本設定
- テンプレート: ${template || 'external-white'}
- 用途: ${purpose || '提案'}
- 目標枚数: ${slideCount || 8}枚

## コンテンツ
- タイトル: ${title || '（未入力）'}
- 受け手・対象者: ${audience || '（未入力）'}
- 背景・課題: ${background || '（未入力）'}
- 伝えたいメッセージ: ${(contentMessages || []).filter(Boolean).join(' / ')}
- 補足データ・根拠: ${supplement || '（なし）'}

## スタイル
- トーン: ${tone || 'フォーマル'}
- 言語: ${language || '日本語'}`;

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
