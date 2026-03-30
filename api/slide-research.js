/**
 * Vercel Edge Function: ディープリサーチ（streaming）
 * トピックについてweb検索で徹底調査し、構造化された調査結果をストリーミング返却。
 */

export const config = { runtime: 'edge' };

const RESEARCH_SYSTEM_PROMPT = `あなたは企業向けプレゼン資料のためのリサーチアナリストです。
与えられたトピックについて、Web検索ツールを活用して徹底的に調査してください。

## 調査の方針

1. まず大きなテーマで検索し、全体像を把握する
2. 次に具体的な数値・統計・事例を探す
3. 複数のソースを突き合わせて信頼性を確認する
4. 最新のデータを優先する（2024年以降）

## 調査対象
- 市場規模・成長率・シェア
- 業界トレンド・技術動向
- 成功事例・ベストプラクティス
- 課題・リスク
- 統計データ・KPI
- 競合情報

## 出力形式

調査が完了したら、以下のJSON形式で結果を返してください。

\`\`\`json
{
  "topic": "調査テーマ",
  "sections": [
    {
      "title": "セクションタイトル",
      "findings": [
        {
          "fact": "発見した事実・データ",
          "source_url": "出典URL",
          "source_name": "出典名（例: 総務省 令和6年通信利用動向調査）",
          "confidence": "high|medium|low",
          "data_point": "グラフに使える数値データがあれば記載（例: '2024年: 5.2兆円'）"
        }
      ]
    }
  ],
  "suggested_charts": [
    {
      "title": "チャートタイトル",
      "type": "bar|line|pie",
      "labels": ["ラベル1", "ラベル2"],
      "data": [数値1, 数値2],
      "unit": "単位",
      "source": "出典"
    }
  ],
  "key_insights": ["プレゼンで強調すべきポイント1", "ポイント2", "ポイント3"]
}
\`\`\`

必ず上記JSON形式のみを返してください。各findingには必ずsource_urlを含めてください。
推測データは confidence: "low" とし、fact に「推計」と明記してください。`;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'APIキーが設定されていません' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { topic, context, _user } = await req.json();

  if (!topic) {
    return new Response(JSON.stringify({ error: 'topic is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ログ送信
  const logEndpoint = process.env.LOG_ENDPOINT;
  if (logEndpoint && _user) {
    fetch(logEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: _user,
        action: 'slide-research',
        app: 'slide-maker',
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      }),
    }).catch(() => {});
  }

  const userMessage = context
    ? `以下のトピックについて調査してください。\n\nトピック: ${topic}\n\nコンテキスト:\n${context}`
    : `以下のトピックについて調査してください。\n\nトピック: ${topic}`;

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
        max_tokens: 8192,
        temperature: 0.2,
        system: RESEARCH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 15,
          user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' },
        }],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'しばらく時間をおいて再試行してください。' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
      return new Response(JSON.stringify({ error: `APIエラー (${response.status})` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // SSE形式でストリーミング
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let searchCount = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);

                // Web検索ツール使用の検知
                if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
                  searchCount++;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: `Web検索中... (${searchCount}件目)` })}\n\n`));
                }

                // テキスト差分のストリーミング
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  fullText += event.delta.text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text: event.delta.text })}\n\n`));
                }

                // 完了
                if (event.type === 'message_stop') {
                  // JSONを抽出
                  const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/) || fullText.match(/(\{[\s\S]*\})/);
                  if (jsonMatch) {
                    try {
                      const research = JSON.parse(jsonMatch[1].trim());
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', research, searchCount })}\n\n`));
                    } catch {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', raw: fullText, searchCount })}\n\n`));
                    }
                  } else {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', raw: fullText, searchCount })}\n\n`));
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                }
              } catch {
                // パースエラーは無視
              }
            }
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
