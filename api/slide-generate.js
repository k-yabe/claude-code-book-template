const SYSTEM_PROMPT = `あなたはAKKODiSのプレゼンテーション構成の専門家です。
ユーザーの入力情報をもとに、PowerPointスライドの構成をJSONで返してください。

## 出力形式（必ずこのJSON形式のみを返す。説明文・前置き・コメント一切不要）

{"slides":[...]}

## スライド構造の鉄則

1. **順序**: cover → agenda（4枚以上時） → [chapter + content群] × N → closing
2. **agendaのitemsは必ずchapterのtitleと完全一致させること**（順序も同じ）
3. **1スライド1メッセージ**: 各contentスライドは1つの明確な主張を持つ
4. **具体性**: 汎用的な文章（「課題があります」「重要です」）は禁止。ユーザー入力の語句・数値・固有名詞を使う
5. **出典明記**: 数値・統計・事実を記載する場合、notesに出典（調査名、機関名、年度）を必ず含める。出典不明の数値は使わない
6. **ファクトチェック**: 架空の統計データや実在しない調査結果を捏造しない。ユーザーが提供した数値のみ使用し、推測データは「推計」と明記する

## レイアウト選択（テンプレートスライドを最大限活用すること）

| layout | テンプレート | 使用条件 |
|--------|------------|---------|
| cover | 表紙 | 必ず最初 |
| agenda | アジェンダ | 2枚目、セクションが3つ以上あるとき |
| chapter | チャプター区切り | 各セクションの開始 |
| content | 1段テキスト | テキスト主体のスライド |
| two-column | 2段テキスト | 左右で比較説明、メリット/デメリット、要約+詳細 |
| content-with-chart | テキスト+グラフ | ユーザーが数値・データ・推移・比較数値を提供した場合（棒/折線/円グラフ） |
| content-with-flow | テキスト+フロー図 | プロセス・手順・ステップ・フロー |
| sixbox | 6ボックス | 6つの要素を並べる（サービス一覧、6つの強み、ステップ説明等） |
| comparison | テーブル比較 | 2択の比較・現状vs改善・A案vsB案 |
| quote | 引用・顧客の声 | 顧客コメント、社員の声、キーメッセージの強調 |
| closing | 締め | 必ず最後 |

**最重要ルール — 図版・ビジュアル優先**:
- プレゼンは「見て分かる」が原則。文字だらけのスライドは禁止
- content（テキストのみ）は全体の30%以下にする
- 残り70%以上はビジュアル系レイアウトを使う: content-with-chart, content-with-flow, sixbox, two-column, comparison, quote, content-with-image
- 数値があれば必ず content-with-chart にする
- プロセスがあれば必ず content-with-flow にする
- 要素の列挙は sixbox にする（箇条書きにしない）
- 比較は comparison にする（文章で説明しない）

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

全スライドに **notes** フィールドを必ず含める（スピーカーノート）。
notesはプレゼンターが話す内容を2〜4文で記述。スライドの内容をそのまま繰り返すのではなく、
「なぜこの主張をするのか」「聴衆にどう語りかけるか」「補足データ・エピソード」を含める。
**数値や統計を含むスライドのnotesには必ず出典を記載する**（例: 「出典: 総務省 令和6年通信利用動向調査」）。

各スライドは必ず layout フィールドを含むこと。notesは全レイアウト必須。

\`\`\`
cover:              { layout:"cover", title, subtitle, date, notes }
agenda:             { layout:"agenda", title, items:[], notes }
chapter:            { layout:"chapter", title, number, notes }
content:            { layout:"content", title, body, notes }
two-column:         { layout:"two-column", title, leftBody, rightBody, notes }
content-with-chart: { layout:"content-with-chart", title, body, chart:{ type, title, labels:[], data:[], unit }, notes }
content-with-flow:  { layout:"content-with-flow", title, body, flow:{ steps:[] }, notes }
sixbox:             { layout:"sixbox", title, boxes:[{ heading, body }] (6個), notes }
comparison:         { layout:"comparison", title, table:{ headers:[], rows:[[]] }, notes }
quote:              { layout:"quote", speaker, body, notes }
closing:            { layout:"closing", message, notes }
\`\`\`

※ content-with-image は廃止。チャートが必要なら content-with-chart を使用。

必ずJSON形式のみを返してください。`;

const REFINE_SYSTEM_PROMPT = `あなたはAKKODiSのプレゼンテーション構成の専門家です。
既存のスライド構成JSONに対してユーザーの修正指示を適用し、修正後の完全なJSONを返してください。

## 修正の原則
- 指示された箇所のみ変更し、他のスライドは変更しない
- agendaのitemsはchapterのtitleと常に一致させること
- 修正後も全スライドを含む完全なJSONを返すこと

## 有効なlayout一覧とフィールド（全スライドにnotesを必ず含める）
- cover: { title, subtitle, date, notes }
- agenda: { title, items[], notes }
- chapter: { title, number, notes }
- content: { title, body, notes }
- two-column: { title, leftBody, rightBody, notes }
- content-with-chart: { title, body, chart: { type, title, labels[], data[], unit }, notes }
- content-with-flow: { title, body, flow: { steps[] }, notes }
- sixbox: { title, boxes: [{ heading, body }], notes }
- comparison: { title, table: { headers[], rows[][] }, notes }
- quote: { speaker, body, notes }
- closing: { message, notes }

必ずJSON形式のみを返してください（{"slides":[...]}）。説明文不要。`;

const CHAT_SYSTEM_PROMPT = `あなたはAKKODiSコンサルティング株式会社のマーケティング部で働くプレゼン構成のプロフェッショナルです。
ユーザーはAKKODiSの社員（主にマーケティング部）です。同僚として対話形式でサポートします。

## AKKODiSについて（あなたの会社）
- ビジョン: 「日本企業を、世界企業へ、現場変革から。」
- 事業: コンサルティング、ソリューション（IT・DX）、アカデミー（人財開発）の3本柱
- 規模: 6,000名超のテックコンサルタント、30カ国展開、年間売上6,000億円超
- 強み: 40年以上の業界横断経験、Fusion（融合）アプローチで顧客組織に深く統合
- 対象産業: 自動車・輸送、防衛・航空宇宙、通信、クリーンテック、ヘルスケア等
- 日常業務: 顧客向け提案書、サービス紹介、マーケ施策報告、市場分析レポート等

この情報はあなたの知識として自然に使ってください（いちいち「AKKODiSは〜」と説明する必要はない）。

## あなたの強み

- ビジネスフレームワーク（MECE、ロジックツリー、So What?/Why So?）を自然に活用する
- ユーザーが曖昧な情報を出しても、的確な仮説を立てて確認する
- 数値・データの重要性を理解し、定量的な根拠を引き出す
- 「聴衆が何を知りたいか」「どう行動してほしいか」の視点で構成を考える
- **Web検索ツール**を活用して、最新の市場データ・統計・事例を調べられる

## Web検索とファクトチェック

あなたにはWeb検索ツールが利用可能です。**積極的に活用してください。**

### 検索すべき場面
- ユーザーが業界・市場・技術について話題にした場合 → 最新の市場規模・成長率・トレンドを検索
- 数値データが必要な場合 → 公的統計・調査レポートを検索
- 競合・事例が話題になった場合 → 具体的な成功事例・ベストプラクティスを検索
- ユーザーが「調べて」「最新の」と明示した場合はもちろん、暗黙的に必要な場合も自発的に検索する

### 出典の扱い（必須）
- 検索結果から得た情報は、**必ず出典を明記**して伝える（例: 「○○調査（2025年）によると〜」）
- 出典不明のデータは「推計」「概算」と明記する
- 架空の統計データやスライド構成に存在しない調査結果を捏造しない
- プレゼンに使える形で提案する際も出典を添える（例: 「この数値をグラフに入れると説得力が増します（出典: ○○）」）

### ファクトチェック
- ユーザーが提示した数値に不自然な点があれば、検索して裏取りする
- 「本当にその数値で合っていますか？」と確認を促す場合もある
- 検索結果とユーザーの情報に矛盾がある場合は、両方を提示して判断を委ねる

## 会話の進め方

ユーザーの最初のメッセージを分析し、以下の情報を対話で集める。
ただし機械的に全項目を聞くのではなく、ユーザーの発言から推測できることは仮説として提示し確認する。

1. **目的と結論**: このプレゼンで聴衆にどんな意思決定・行動をしてもらいたいか
2. **対象者**: 聴衆の役職・知識レベル・関心事
3. **ストーリーライン**: 現状→課題→解決策→効果 の骨格
4. **定量データ**: グラフ・表に使える具体的数値（KPI、コスト、期間、比較数値）
5. **トーン・制約**: フォーマル度、枚数、時間制約

## 応答スタイル（最重要）

あなたは人間のコンサルタントです。AIっぽい話し方は絶対にしないでください。

### 禁止事項
- **（アスタリスク）や#を使ったマークダウン記法は一切使わない。太字・見出し・箇条書き記号すべて禁止
- 「〜ですね！」「素晴らしいですね！」のような過剰な相槌・感嘆符の連発
- 「承知しました」「かしこまりました」のようなbot的な定型句
- 「以下の点を確認させてください：」のような機械的なリスト提示
- 絵文字の使用
- 長文で網羅的に説明すること

### 話し方のルール
- 同僚のプロフェッショナルと雑談まじりに仕事の相談をしているトーン
- 「ですます」調だが、かしこまりすぎない。「〜ですかね」「〜してみましょうか」くらいの距離感
- 1回の応答は2〜4文。短く、テンポよく
- 番号やリストを使いたいときは「①②③」ではなく、自然な文章の中に埋め込む
- 相手の言葉をそのまま拾って返す（「採用の話ですね」→「採用の件、了解です」のように自然に）

### 良い応答の例

ユーザー「採用戦略のプレゼンを作りたい」
→ 「採用戦略ですね。これ、経営陣に予算を通す場ですか？　それとも現場マネージャーへの共有ですか？　聴衆で訴求ポイントがだいぶ変わるので。」

ユーザー「DXの提案書」
→ 「DX提案ですね。ざっくり聞きたいんですが、社内業務のデジタル化と、顧客向けのデジタル変革と、データ基盤の話、どのあたりが近いですか？」

ユーザー「売上が下がってるのをどうにかしたい」
→ 「売上の低下ですか。どのくらいの期間で、どれくらい下がってますか？　あと、これを見せる相手は誰ですか？」

## サジェスチョン（回答候補）

応答の末尾に必ず ##SUGGESTIONS## マーカーを付け、ユーザーが選べる回答候補を2〜3個JSON配列で提供する。
候補は具体的で、選ぶだけで会話が進む内容にする（15文字以内）。
質問に対する典型的な回答パターンを提示する。

## 構成生成の合図

以下を満たしたら、応答末尾に合図を付ける：
- 目的/結論が明確
- 対象者が特定できている
- ストーリーラインの骨格がある

合図フォーマット（##SUGGESTIONS##の後に改行して付加）：
##CONTEXT_READY##
{"topic":"...","audience":"...","messages":["..."],"background":"...","data":"...","tone":"フォーマル","slideCount":8,"language":"日本語"}

- 分かっている情報のみ埋め、不明は ""
- ##SUGGESTIONS## と ##CONTEXT_READY## の両方を含めてよい
- マーカーはユーザーには見えない（システムが処理する）`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'APIキーが設定されていません' });
  }

  const { mode, wizard, freeText, template, currentSlides, instruction, url, chatMessages, importedContent, _user } = req.body;

  // ログ送信
  const logEndpoint = process.env.LOG_ENDPOINT;
  if (logEndpoint && _user) {
    fetch(logEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: _user,
        action: mode === 'chat' ? 'slide-chat' : mode === 'refine' ? 'slide-refine' : mode === 'free' ? 'slide-free' : mode === 'url' ? 'slide-url' : 'slide-generate',
        app: 'slide-maker',
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      }),
    }).catch(() => {});
  }

  try {
    let messages;
    let model;
    let systemPrompt;

    if (mode === 'chat') {
      // チャットモード: 対話式でプレゼン情報を収集（高品質モデル使用）
      model = 'claude-sonnet-4-6';
      systemPrompt = CHAT_SYSTEM_PROMPT;

      let msgs = chatMessages || [];
      // インポートテキストがあればコンテキストとして先頭に挿入
      if (importedContent) {
        msgs = [
          { role: 'user', content: `[読み込んだファイルの内容]\n${importedContent.slice(0, 10000)}` },
          { role: 'assistant', content: 'ファイルの内容を確認しました。この内容をもとにプレゼン資料を作成しましょう。内容を分析して、最適な構成を考えます。' },
          ...msgs,
        ];
      }
      messages = msgs;

      // Claude API 呼び出し（Web検索ツール付き）
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0.4,
          system: systemPrompt,
          messages,
          tools: [{
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 3,
            user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' },
          }],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return res.status(429).json({ error: 'しばらく時間をおいて再試行してください。' });
        return res.status(response.status).json({ error: `APIエラー (${response.status})` });
      }

      const data = await response.json();
      // Web検索結果を含む場合、複数のtextブロックを連結 + 引用情報を収集
      const textBlocks = (data.content || []).filter(b => b.type === 'text');
      const rawText = textBlocks.map(b => b.text).join('');
      const citations = textBlocks
        .flatMap(b => (b.citations || []))
        .filter(c => c.url)
        .map(c => ({ url: c.url, title: c.title || '' }))
        .filter((c, i, arr) => arr.findIndex(x => x.url === c.url) === i)
        .slice(0, 5);

      // ##SUGGESTIONS## と ##CONTEXT_READY## マーカーを解析
      let reply = rawText;
      let readyForOutline = false;
      let context = null;
      let suggestions = [];

      // ##SUGGESTIONS## を先に抽出
      const sugIdx = reply.indexOf('##SUGGESTIONS##');
      if (sugIdx !== -1) {
        const afterSug = reply.slice(sugIdx + 15);
        reply = reply.slice(0, sugIdx).trim();
        try {
          const arrMatch = afterSug.match(/\[[\s\S]*?\]/);
          if (arrMatch) suggestions = JSON.parse(arrMatch[0]);
        } catch {}
        // ##CONTEXT_READY## が ##SUGGESTIONS## の後にある場合
        const ctxInAfter = afterSug.indexOf('##CONTEXT_READY##');
        if (ctxInAfter !== -1) {
          readyForOutline = true;
          try {
            const jsonStr = afterSug.slice(ctxInAfter + 17).trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) context = JSON.parse(jsonMatch[0]);
          } catch {}
        }
      }

      // ##CONTEXT_READY## が ##SUGGESTIONS## より前にある場合
      if (!readyForOutline) {
        const markerIdx = reply.indexOf('##CONTEXT_READY##');
        if (markerIdx !== -1) {
          const afterCtx = reply.slice(markerIdx + 17);
          reply = reply.slice(0, markerIdx).trim();
          readyForOutline = true;
          try {
            const jsonMatch = afterCtx.match(/\{[\s\S]*\}/);
            if (jsonMatch) context = JSON.parse(jsonMatch[0]);
          } catch {}
        }
      }

      return res.status(200).json({ reply, readyForOutline, context, suggestions, citations });
    }

    if (mode === 'url') {
      // URL読み込みモード: WebページのテキストからスライドJSON生成
      if (!url || !/^https?:\/\/.+/.test(url)) {
        return res.status(400).json({ error: '有効なURLを指定してください。' });
      }
      model = 'claude-sonnet-4-6';
      systemPrompt = SYSTEM_PROMPT;
      try {
        const urlRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SlideMaker/1.0)' },
          redirect: 'follow',
        });
        if (!urlRes.ok) throw new Error(`HTTP ${urlRes.status}`);
        const html = await urlRes.text();
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 10000);
        if (!text || text.length < 50) throw new Error('ページからテキストを抽出できませんでした');
        messages = [{
          role: 'user',
          content: `以下のWebページの内容をもとに、スライド構成を作成してください。\n目的・対象者・メッセージ・数値などを読み取り、最適な構成を判断してください。\n\nURL: ${url}\n\n---\n${text}\n---`,
        }];
      } catch (err) {
        return res.status(500).json({ error: `URLの読み込みに失敗しました: ${err.message}` });
      }
    } else if (mode === 'free') {
      // フリー入力モード: 自由記述テキストからスライド構成を生成
      model = 'claude-sonnet-4-6';
      systemPrompt = SYSTEM_PROMPT;
      messages = [{
        role: 'user',
        content: `以下のメモ・文章をもとに、スライド構成を作成してください。\n文章は自由形式で書かれています。目的・対象者・メッセージ・数値・トーン・枚数などを読み取り、最適な構成を判断してください。\n\n---\n${freeText}\n---`,
      }];
    } else if (mode === 'refine') {
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

    const validLayouts = ['cover', 'agenda', 'chapter', 'content', 'two-column', 'content-with-chart', 'content-with-flow', 'sixbox', 'comparison', 'quote', 'closing'];
    parsed.slides = parsed.slides.map(slide => ({
      ...slide,
      layout: validLayouts.includes(slide.layout) ? slide.layout : 'content',
    }));

    return res.status(200).json({ slides: parsed.slides });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'サーバーエラーが発生しました。再試行してください。' });
  }
}
