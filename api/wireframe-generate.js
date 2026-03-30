const SYSTEM_PROMPT = `あなたはWebページのワイヤーフレーム設計の専門家です。
ユーザーの要件をもとに、ページのセクション構成をJSONで返してください。

## 出力形式（必ずこのJSON形式のみを返す。説明文・前置き・コメント一切不要）

{"sections":[...]}

## ページ種別ごとの推奨構成（才流・WACULメソッド準拠）

### BtoB 顕在ユーザー向けLP（リスティング広告流入）
才流「売れるロジック」7セクション:
navigation → hero(問題提起+CTA) → content-text(原因の深掘り) → two-column(解決策と成果) → features(商品/サービス紹介) → testimonials(信頼・導入実績) → faq(安心・不安払拭) → cta-banner(行動の後押し) → footer

### BtoB 潜在ユーザー向けLP（SNS広告流入）
navigation → hero(課題提示+資料の価値提案) → content-text(資料/セミナー内容紹介) → form(フォーム一体型) → footer
※フォーム一体型推奨。遷移を減らしてCVR向上

### BtoB サービスサイト トップページ
navigation → hero(メインビジュアル+CTA) → content-text(よくある顧客の課題) → features(サービス特長3-4つ) → stats(導入実績・数値) → testimonials(事例) → pricing(料金プラン) → timeline(導入の流れ) → faq → cta-banner → footer

### BtoC 商品LP
navigation → hero(キャッチコピー+権威付け+CTA) → content-text(共感・悩み提示) → features(ベネフィット) → testimonials(利用者の声) → cta-banner(中間CTA) → pricing(比較・差別化) → faq → cta-banner(クロージング) → footer

## セクション設計の鉄則

1. **ファーストビュー完結型を優先**: BtoBではCTAまでファーストビューに完結させるとCVR1.64倍（WACUL調査）
2. **CTA配置**: 最低3箇所（ファーストビュー中央 + ページ中間 + 最下部）。中央配置でCVR1.32倍
3. **CTAボタンには補完文言**: 「無料で資料DL（3分で完了）」のような補完文言でCVR1.45倍
4. **CTA種別はターゲットに合わせる**: 顕在→問い合わせ/資料請求、潜在→ホワイトペーパーDL/ウェビナー
5. **信頼要素はファーストビュー直下**: 導入企業ロゴ・導入数・受賞歴
6. **セクション数**: 6〜12が適切（BtoB潜在向けは4〜6でも可）
7. **フォーム項目は最小限**: BtoBでも7項目以下。1項目減→通過率+2%pt

## セクションタイプと使い分け

| type | 名称 | 使用条件 |
|------|------|---------|
| navigation | ナビゲーション | 必ず最初。BtoBサイトではCTAボタンも含める |
| hero | ヒーロー | ファーストビュー。キャッチ(20-40字)+サブコピー(40-80字)+CTA+権威付け |
| features | 特徴・メリット | 3-4つの差別化ポイント。機能ではなくベネフィットで訴求 |
| content-text | テキストコンテンツ | 課題提示・原因深掘り・解決策説明に使用 |
| two-column | 2カラム | 左右で対比。Before/After、課題/解決策 |
| testimonials | お客様の声・実績 | 導入企業ロゴ+成果数値。BtoBは必須 |
| pricing | 料金プラン | 2〜3プランの比較表 |
| cta-banner | CTAバナー | ページ中間・下部。補完文言必須 |
| form | フォーム | 入力項目は最小限。BtoB潜在LPではフォーム一体型推奨 |
| faq | よくある質問 | 検討段階の不安を解消。5-8件 |
| gallery | ギャラリー | 画像グリッド。利用シーン・スクリーンショット |
| stats | 数値・実績 | 導入社数・満足度・成果指標。3-4つ |
| timeline | タイムライン・導入ステップ | 検討→申込→導入→運用 のプロセス可視化 |
| cards | カードグリッド | 事例一覧・サービス一覧 |
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
  "components": ["heading", "subtext", "cta-button", "hero-image", "logo-bar"]
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

才流（SAIRU）やWACUL等のBtoBマーケティング知見を活用してアドバイスする。
- BtoBでは「ファーストビュー完結型LP」がCVR1.64倍（WACUL調査）
- CTAはファーストビュー中央に配置するとCVR1.32倍
- CTAボタンに補完文言を付けるとCVR1.45倍
- 才流の「売れるロジック」（問題→原因→解決策→商品→信頼→安心→行動）はBtoB LP構成の基本

これらの知見は、ユーザーの要件に合致する場面で自然にアドバイスとして提示する。

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
      'lp-lead': 'リード獲得LP: ヒーロー（キャッチコピー+CTA）→ 課題提示 → ソリューション → 実績数値 → 導入事例 → FAQ → CTAバナー → フォーム',
      'lp-event': 'イベント集客LP: ヒーロー（イベント名+日時+CTA）→ イベント概要 → 登壇者紹介 → タイムライン → 参加メリット → FAQ → 申込フォーム',
      'corporate-top': 'コーポレートトップ: ヒーロー（ビジョン）→ 事業紹介カード → 数値実績 → ニュース一覧 → お知らせ → CTAバナー',
      'product-detail': '製品・サービス詳細: ヒーロー（製品名+価値提案）→ 特徴3点 → 詳細説明（2カラム）→ 料金プラン → 導入事例 → FAQ → CTA',
      'blog-article': 'ブログ記事: ナビ → パンくず → 記事ヘッダー → 本文 → 関連記事カード → CTA → フッター',
      'contact-form': 'お問い合わせ: ヒーロー（お問い合わせ案内）→ フォーム → 会社情報（2カラム）→ FAQ',
    };

    if (mode === 'template') {
      model = 'claude-sonnet-4-6';
      systemPrompt = SYSTEM_PROMPT;
      const templateDesc = TEMPLATES[templateId] || TEMPLATES['lp-lead'];
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
