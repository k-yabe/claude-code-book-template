const SYSTEM_PROMPT = `あなたはWebページのワイヤーフレーム設計の専門家です。
ユーザーの要件をもとに、ページのセクション構成をJSONで返してください。

## 出力形式（必ずこのJSON形式のみを返す。説明文・前置き・コメント一切不要）

{"sections":[...]}

## 設計メソドロジー

### 才流「売れるロジック」7段階（BtoB LP構成の基本）
1. 問題提起: 顧客が抱え、自社商品で解決可能な問題を提起。キャッチコピー形式（例:「面接の日程調整の手間を大幅短縮」）
2. 原因の深掘り: 問題の根本原因を、自社商品で解決可能かつ顧客が納得できる形で提示
3. 解決策の方向と結果: 「○○によって□□を解決する△△です」の形式で商品の位置づけを明確化
4. 商品紹介: 概要・機能・特長・料金・導入フロー。競合との違いを示す特長を準備
5. 信頼: 導入事例数・シェア・大手企業の導入実績・役員経歴
6. 安心: FAQ・サポート体制・お客様の声。BtoB特有の「失敗したくない」心理に対応
7. 行動の後押し: 複数CTAで検討段階別の選択肢を提供（資料請求/トライアル/問い合わせ）

### WACUL調査による数値エビデンス
- ファーストビュー完結型LP（サービス名+概要+CTA）: CVR1.64倍（平均1.15% vs 0.70%）
- CTAファーストビュー中央配置: CVR1.32倍（1.10% vs 0.83%）
- CTA補完文言付き: CVR1.45倍（1.16% vs 0.80%）
- ページの縦長さはCVRに無関係（相関係数-0.23）→長ければ良いわけではない
- ユーザーの滞在時間の57%はファーストビューに集中
- フォーム通過率目標: 25%（平均20.37%）
- フォーム入力項目1つ削減 → 通過率+2%pt（相関係数-0.757）
- フォーム遷移ボタンとフォームタイトルの文言一致: 通過率1.3倍

## ページ種別ごとの推奨構成

### BtoB 顕在ユーザー向けLP（リスティング広告流入）
才流「売れるロジック」準拠:
navigation(ロゴ+メニュー+資料請求CTA) → hero(問題提起キャッチ+サブコピー+CTA+導入企業ロゴバー) → content-text(原因の深掘り) → two-column(解決策と成果) → features(商品特長3-4つ) → stats(導入実績数値) → testimonials(導入企業ロゴ+成果数値付き事例) → faq(検討段階の不安5-8件) → cta-banner(行動の後押し+複数CTA) → footer

### BtoB 潜在ユーザー向けLP（SNS広告流入）
navigation → hero(課題提示+資料の価値提案+CTA) → content-text(資料/セミナー内容紹介) → form(フォーム一体型・確認画面なし) → footer
※遷移を減らしてCVR向上。フォーム項目は最小限（会社名・氏名・メール・電話の4項目程度）

### BtoB サービスサイト トップページ
navigation → hero(ビジョン+CTA) → content-text(よくある顧客の課題) → features(特長3-4つ・ベネフィット訴求) → stats(導入実績数値3-4つ) → testimonials(事例・成果数値付き) → pricing(料金2-3プラン) → timeline(導入の流れ) → faq → cta-banner(複数CTA) → footer

### BtoC 商品LP
navigation → hero(キャッチ+権威付けロゴ+CTA+補完文言) → content-text(共感・悩み) → features(ベネフィット) → testimonials(利用者の声・実名) → cta-banner(中間CTA) → pricing(比較・差別化) → faq → cta-banner(クロージング) → footer

## CTA設計ルール（才流+WACUL）

### 配置ルール
- 最低3箇所: ナビゲーション右端 + ファーストビュー中央 + ページ最下部
- ページ中間にもcta-bannerを挟む（testimonials後、faq前が効果的）

### 文言設計
- 非推奨: 「問い合わせする」「商談を打診する」（営業的すぎてCVR低下）
- 推奨: 「会社案内をダウンロードする」「料金表をダウンロードする」「事例集をまとめてダウンロード」
- 必ず補完文言を付ける: 「無料」「3分で完了」「営業電話は一切しません」
- ページの内容に合わせてCTAをカスタマイズ（料金ページ→「料金を問い合わせ」等）

### 検討段階別CTA
- 1つのCTAだけでは不十分。検討段階に応じた複数オプション:
  - 情報収集段階: ホワイトペーパーDL、ウェビナー申込
  - 比較検討段階: 資料請求、料金表DL
  - 導入決定段階: 問い合わせ、個別相談、無料トライアル

## 信頼セクション設計（才流 導入事例12パターンより）

信頼性が高い順:
1. 成功事例（インタビュー+定量的成果数値）— 最も効果的
2. 成功事例（顧客コメント付き）
3. 活用事例（課題解決を顧客の言葉で）
4. お客様の声（実名/匿名コメント）
5. ユースケース（顧客名なし、利用状況説明）
6. 導入ロゴ一覧（企業ロゴで実績を可視化）— 最も簡単

原則:
- 読み手と近い業界・規模の事例を選ぶ
- 定量的数値（ROI・費用対効果）を明示
- 「購買担当者が決裁者を説得する材料」になることを意識
- BtoBでは testimonials または stats を必ず含める

## フォーム設計ルール（才流EFOチェックリスト+WACUL調査）

### 入力項目の最小化
- BtoBでも7項目以下（1項目減→通過率+2%pt）
- 郵便番号・住所・ふりがなは削除
- 任意項目は全て削除（ユーザーは任意でも全部埋めようとして離脱する）

### フォームUI
- 確認画面は省略（「入力完了」と勘違いして離脱するケース防止）
- 入力エラーはその場でリアルタイム表示
- 電話番号を3つに分割しない
- ヘッダー・フッターのリンクを削除（離脱防止）
- ファーストビューでフォーム完結を目指す（スクロール不要）

### 行動の後押し
- CTAは具体的に: 「送信する」→「資料をダウンロードする（無料）」
- 不安解消テキスト: 「営業電話は一切しません」「クレジットカード登録不要」
- 送付資料のイメージ画像を表示
- フォーム遷移ボタンとフォームタイトルの文言を一致させる（通過率1.3倍）

## セクションタイプと使い分け

| type | 名称 | 使用条件 |
|------|------|---------|
| navigation | ナビゲーション | 必ず最初。BtoBではCTAボタン（資料請求等）を右端に含める |
| hero | ヒーロー | ファーストビュー完結型必須。キャッチ(20-40字)+サブコピー(40-80字)+CTA+補完文言+権威付けロゴバー |
| features | 特徴・メリット | 3-4つ。機能ではなくベネフィットで訴求（「○○できる」形式） |
| content-text | テキストコンテンツ | 課題提示・原因深掘り・解決策説明に使用 |
| two-column | 2カラム | Before/After、課題/解決策の対比。画像+テキスト |
| testimonials | お客様の声・実績 | 導入企業ロゴ+成果数値付き引用。BtoBは必須 |
| pricing | 料金プラン | 2-3プラン比較。推奨プラン強調 |
| cta-banner | CTAバナー | ページ中間・下部。補完文言+不安解消テキスト必須 |
| form | フォーム | 項目は最小限。確認画面なし。CTA文言を具体的に |
| faq | よくある質問 | 検討段階の不安を解消。5-8件 |
| gallery | ギャラリー | 画像グリッド。利用シーン・UI画面・導入先の様子 |
| stats | 数値・実績 | 導入社数・満足度・継続率・成果指標。3-4つ |
| timeline | 導入ステップ | 検討→申込→導入→運用のプロセス可視化 |
| cards | カードグリッド | 事例一覧・サービス一覧・プラン比較 |
| footer | フッター | 必ず最後。リンク列+コピーライト |

## 各フィールドの品質ルール

### 各セクションの構造
\`\`\`
{
  "id": "sec-1",
  "type": "hero",
  "label": "20文字以内でセクションの内容を端的に",
  "description": "50文字以内で含まれる要素を説明",
  "height": "viewport" | "auto",
  "components": ["heading", "subtext", "cta-with-note", "hero-image", "logo-bar"]
}
\`\`\`

### components に使える要素
heading, subtext, cta-button, cta-with-note, hero-image, placeholder-image, icon-card, form-field, submit-button, nav-logo, nav-menu, nav-cta, quote-text, avatar, company-logo, logo-bar, price-card, accordion-item, stat-number, step-item, card-item, link-list, copyright, social-icons, search-bar, breadcrumb, video-placeholder, divider, badge, before-after

### 制約
- label は 20文字以内
- description は 50文字以内
- components は実際のUI要素名を列挙（抽象的な表現は禁止）
- 同じタイプのセクションが3つ以上連続しないこと
- height は hero のみ "viewport"、他は "auto"
- BtoBページの場合、必ず testimonials または stats を含めること（信頼要素必須）
- heroには必ず cta-with-note を含める（cta-button ではなく補完文言付き）
- cta-banner にも必ず補完文言の要素を含める

必ずJSON形式のみを返してください。`;

const REFINE_SYSTEM_PROMPT = `あなたはWebページのワイヤーフレーム設計の専門家です。
既存のセクション構成JSONに対してユーザーの修正指示を適用し、修正後の完全なJSONを返してください。

## 修正の原則
- 指示された箇所のみ変更し、他のセクションは変更しない
- 修正後も全セクションを含む完全なJSONを返すこと
- targetSectionId が指定されている場合、そのセクションのみ修正

## セクション構造
各セクション: { id, type, label, description, height, components:[] }

使用可能なtype: navigation, hero, features, content-text, two-column, testimonials, pricing, cta-banner, form, faq, gallery, stats, timeline, cards, footer

必ずJSON形式のみを返してください（{"sections":[...]}）。説明文不要。`;

const CHAT_SYSTEM_PROMPT = `あなたはWebページの企画・設計をサポートするアシスタントです。
マーケターからワイヤーフレームの要件をヒアリングしてください。

## あなたの専門知識

才流（SAIRU）やWACULの研究に基づくLP設計のベストプラクティスを熟知している。
適切な場面で自然にアドバイスとして提示する（全部一度に言わず、文脈に合うものだけ）。

### 才流の知見
- 「売れるロジック」7段階: 問題提起→原因→解決策→商品紹介→信頼→安心→行動の後押し
- CTAは「問い合わせ」だけだと弱い。検討段階別に複数用意（資料DL/トライアル/問い合わせ）
- CTA文言は営業的な表現（「商談を打診」）を避け、ユーザー志向に（「料金表をダウンロード」）
- 信頼セクションは導入ロゴ一覧が最も簡単、成功事例インタビューが最も効果的
- フォームは確認画面を省略（「完了」と勘違い離脱を防止）
- フォーム項目は最小限。郵便番号・住所・ふりがなは不要
- 埋め込み型フォーム（ページ遷移なし）でCVR2倍の実績あり

### WACULの調査データ
- ファーストビュー完結型LP（サービス名+概要+CTA）: CVR1.64倍
- CTAファーストビュー中央配置: CVR1.32倍
- CTA補完文言付き（「無料」「3分で完了」等）: CVR1.45倍
- ページの長さとCVRは無関係（相関-0.23）。長くすれば良いわけではない
- ユーザーの滞在時間の57%はファーストビューに集中
- フォーム入力項目1つ減→通過率+2%pt。目標通過率25%
- フォーム遷移ボタンとフォームタイトルの文言一致で通過率1.3倍

## ヒアリングの進め方

ユーザーの最初のメッセージを分析し、以下の情報を対話で集める。
ただし機械的に全項目を聞くのではなく、ユーザーの発言から推測できることは仮説として提示し確認する。

1. **ページの目的**（必須）: 何を達成したいか（リード獲得、情報提供、申込促進等）
2. **ターゲットユーザー**（必須）: 誰に向けたページか（BtoB/BtoC、役職、知識レベル）
3. **ページ種別**（必須）: LP / コーポレート / ブログ / フォーム等
4. **流入経路**（推奨）: リスティング広告 / SNS広告 / 自然検索 / メール等（CTA種別の最適化に必要）
5. **主要コンテンツ**（推奨）: 載せたい情報・訴求ポイント・差別化要素
6. **信頼材料**（推奨）: 導入実績・事例・受賞・メディア掲載等
7. **参考URL/資料**（推奨）: 競合ページや社内資料があれば共有を促す
8. **ブランドトーン**（任意）: フォーマル / カジュアル / テック等
9. **デバイス優先度**（任意）: デスクトップ優先 / モバイル優先

不足情報を聞くときは推奨度（必須/推奨/任意）とともに提示する。
質問は1回に2〜3個まで。

## ファイル/URL読み込み時の対応

ユーザーがファイルやURLの内容を共有した場合:
- 内容を分析し、ページの目的・ターゲット・主要コンテンツを推測して仮説を提示
- 不足している情報（CTA種別、流入経路、信頼材料等）を追加でヒアリング
- 「この内容をベースに構成案を作りましょうか？」と提案

## 応答スタイル

- プロフェッショナルだが親しみやすい同僚のトーン
- マークダウン記法（**太字**、# 見出し、- 箇条書き）は一切使わない
- 絵文字の使用禁止
- 定型句（「承知しました」「かしこまりました」）禁止
- 1回の応答は2〜4文。短く、テンポよく
- 専門知識を披露するときも自然に。「才流のフレームワークによると〜」のような言い方はOK

## サジェスチョン

応答の末尾に必ず ##SUGGESTIONS## マーカーを付け、ユーザーが選べる回答候補を2〜3個JSON配列で提供する。
候補は具体的で、選ぶだけで会話が進む内容にする（15文字以内）。

フォーマット:
##SUGGESTIONS##["選択肢1","選択肢2","選択肢3"]##/SUGGESTIONS##

## 構成生成の合図

以下を満たしたら、応答末尾に合図を付ける：
- ページの目的が明確
- ターゲットユーザーが特定できている
- ページ種別が決まっている

合図フォーマット（##SUGGESTIONS##の後に改行して付加）：
##CONTEXT_READY##
{"pageType":"lp-lead","purpose":"...","audience":"...","content":["..."],"referenceUrls":[],"tone":"フォーマル","devicePriority":"desktop","flowSource":"","notes":""}

pageType の値: btob-lead-lp | btob-awareness-lp | btob-service-top | btoc-product-lp | blog-article | contact-form | corporate-top | product-detail
flowSource: リスティング | SNS広告 | 自然検索 | メール | 不明

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

  const { mode, templateId, customization, freeText, context, currentSections, targetSectionId, instruction, chatMessages, importedContent, _user } = req.body;

  // ログ送信
  const logEndpoint = process.env.LOG_ENDPOINT;
  if (logEndpoint && _user) {
    fetch(logEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: _user,
        action: mode === 'chat' ? 'wireframe-chat' : mode === 'refine' ? 'wireframe-refine' : 'wireframe-generate',
        app: 'wireframe-maker',
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      }),
    }).catch(() => {});
  }

  try {
    let messages;
    let model;
    let systemPrompt;

    if (mode === 'chat') {
      model = 'claude-sonnet-4-6';
      systemPrompt = CHAT_SYSTEM_PROMPT;
      let msgs = chatMessages || [];

      // インポートテキストがあればコンテキストとして先頭に挿入
      if (importedContent) {
        msgs = [
          { role: 'user', content: `[読み込んだ資料の内容]\n${importedContent.slice(0, 10000)}` },
          { role: 'assistant', content: '資料の内容を確認しました。この情報をもとにワイヤーフレームの構成を考えましょう。内容を分析して、最適なページ構成を提案します。' },
          ...msgs,
        ];
      }
      messages = msgs;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          temperature: 0.4,
          system: systemPrompt,
          messages,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return res.status(429).json({ error: 'しばらく時間をおいて再試行してください。' });
        return res.status(response.status).json({ error: `APIエラー (${response.status})` });
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text || '';

      // ##SUGGESTIONS## と ##CONTEXT_READY## マーカーを解析
      let reply = rawText;
      let readyForStructure = false;
      let parsedContext = null;
      let suggestions = [];

      const sugIdx = reply.indexOf('##SUGGESTIONS##');
      if (sugIdx !== -1) {
        const afterSug = reply.slice(sugIdx + 15);
        reply = reply.slice(0, sugIdx).trim();
        try {
          const arrMatch = afterSug.match(/\[[\s\S]*?\]/);
          if (arrMatch) suggestions = JSON.parse(arrMatch[0]);
        } catch {}
        const ctxInAfter = afterSug.indexOf('##CONTEXT_READY##');
        if (ctxInAfter !== -1) {
          readyForStructure = true;
          try {
            const jsonStr = afterSug.slice(ctxInAfter + 17).trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedContext = JSON.parse(jsonMatch[0]);
          } catch {}
        }
      }

      if (!readyForStructure) {
        const markerIdx = reply.indexOf('##CONTEXT_READY##');
        if (markerIdx !== -1) {
          const afterCtx = reply.slice(markerIdx + 17);
          reply = reply.slice(0, markerIdx).trim();
          readyForStructure = true;
          try {
            const jsonMatch = afterCtx.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedContext = JSON.parse(jsonMatch[0]);
          } catch {}
        }
      }

      return res.status(200).json({ reply, readyForStructure, context: parsedContext, suggestions });
    }

    // テンプレートプリセットの定義
    const TEMPLATES = {
      'btob-lead-lp': 'BtoB リード獲得LP（才流「売れるロジック」準拠）: ナビ(ロゴ+メニュー+資料請求CTA) → ヒーロー(問題提起キャッチ+サブコピー+CTA「無料で資料DL」+補完文言「3分で完了」+導入企業ロゴバー) → 原因の深掘り → 解決策(2カラム) → 商品特長(ベネフィット3-4つ) → 実績数値 → 導入事例(企業ロゴ+成果数値+コメント) → FAQ(5-8件) → CTAバナー(複数CTA+「営業電話は一切しません」) → フッター',
      'btob-awareness-lp': 'BtoB 潜在LP（SNS広告流入・フォーム一体型）: ナビ → ヒーロー(課題+資料の価値提案+CTA) → 資料/セミナー内容紹介 → フォーム一体型(4項目・確認画面なし) → フッター',
      'btob-service-top': 'BtoB サービスサイト: ナビ(+CTA) → ヒーロー(ビジョン+CTA+権威付け) → 顧客課題 → 特長(ベネフィット3-4つ) → 実績数値 → 事例 → 料金(2-3プラン) → 導入の流れ → FAQ → CTAバナー(複数CTA) → フッター',
      'btoc-product-lp': 'BtoC 商品LP: ナビ → ヒーロー(キャッチ+権威付けロゴ+CTA+補完文言) → 悩み共感 → ベネフィット → 利用者の声 → 中間CTA → 料金比較 → FAQ → クロージングCTA → フッター',
      'blog-article': 'ブログ記事: ナビ → パンくず → 記事ヘッダー → 本文 → 関連記事カード → CTA → フッター',
      'contact-form': 'お問い合わせ（才流EFO準拠）: ナビ → ヒーロー(案内+送付資料イメージ) → フォーム(最小限項目・確認画面なし・具体的CTA・不安解消テキスト) → 会社情報 → FAQ → フッター',
    };

    if (mode === 'template') {
      model = 'claude-sonnet-4-6';
      systemPrompt = SYSTEM_PROMPT;
      const templateDesc = TEMPLATES[templateId] || TEMPLATES['btob-lead-lp'];
      messages = [{
        role: 'user',
        content: `以下のテンプレートをベースに、ワイヤーフレームのセクション構成を作成してください。\n\nテンプレート: ${templateDesc}\n${customization ? `\n追加の要望: ${customization}` : ''}\n\nnavigation と footer を必ず含めてください。`,
      }];
    } else if (mode === 'free') {
      model = 'claude-sonnet-4-6';
      systemPrompt = SYSTEM_PROMPT;
      messages = [{
        role: 'user',
        content: `以下の要件をもとに、Webページのワイヤーフレームのセクション構成を作成してください。\nページの目的・ターゲット・必要なコンテンツを読み取り、最適な構成を判断してください。\n\n---\n${freeText}\n---\n\nnavigation と footer を必ず含めてください。`,
      }];
    } else if (mode === 'generate') {
      model = 'claude-sonnet-4-6';
      systemPrompt = SYSTEM_PROMPT;
      const ctx = context || {};
      messages = [{
        role: 'user',
        content: `以下の要件をもとに、Webページのワイヤーフレームのセクション構成を作成してください。

## ページ情報
- 種別: ${ctx.pageType || '（未指定）'}
- 目的: ${ctx.purpose || '（未指定）'}
- ターゲット: ${ctx.audience || '（未指定）'}
- トーン: ${ctx.tone || 'フォーマル'}
- デバイス優先: ${ctx.devicePriority || 'desktop'}
${ctx.content && ctx.content.length > 0 ? `- 含めたいコンテンツ:\n${ctx.content.map(c => `  ・${c}`).join('\n')}` : ''}
${ctx.referenceUrls && ctx.referenceUrls.length > 0 ? `- 参考URL: ${ctx.referenceUrls.join(', ')}` : ''}
${ctx.notes ? `- 特記事項: ${ctx.notes}` : ''}

navigation と footer を必ず含めてください。`,
      }];
    } else if (mode === 'refine') {
      model = 'claude-haiku-4-5-20251001';
      systemPrompt = REFINE_SYSTEM_PROMPT;
      messages = [{
        role: 'user',
        content: `以下の既存セクション構成に対して修正してください。\n\n## 現在の構成\n${JSON.stringify(currentSections, null, 2)}\n\n${targetSectionId ? `## 対象セクション\nID: ${targetSectionId}\n\n` : ''}## 修正指示\n${instruction}`,
      }];
    } else {
      return res.status(400).json({ error: '無効なmodeです。' });
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
        max_tokens: mode === 'refine' ? 2000 : 4000,
        temperature: mode === 'refine' ? 0.2 : 0.3,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ error: 'しばらく時間をおいて再試行してください。' });
      return res.status(response.status).json({ error: `APIエラー (${response.status})` });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || rawText.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'セクション構成の生成に失敗しました。再試行してください。' });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      return res.status(500).json({ error: 'セクション構成のパースに失敗しました。再試行してください。' });
    }

    if (!Array.isArray(parsed.sections)) {
      return res.status(500).json({ error: 'セクション構成の形式が不正です。再試行してください。' });
    }

    const validTypes = ['navigation', 'hero', 'features', 'content-text', 'two-column', 'testimonials', 'pricing', 'cta-banner', 'form', 'faq', 'gallery', 'stats', 'timeline', 'cards', 'footer'];
    parsed.sections = parsed.sections.map((sec, i) => ({
      ...sec,
      id: sec.id || `sec-${i + 1}`,
      type: validTypes.includes(sec.type) ? sec.type : 'content-text',
    }));

    return res.status(200).json({ sections: parsed.sections });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'サーバーエラーが発生しました。再試行してください。' });
  }
}
