/* ==========================================================================
   AI NEWS — 「10分で読める」マーケ動向ダッシュボード
   - 1ファイル完結 / no build / no framework
   - 優先度順レイアウト: TOP STORY (1) / BRIEFING (5) / MORE READS (残り)
   - シードデータ表示（将来は data/news.json から fetch）
   ========================================================================== */
(() => {
  'use strict';

  /* ────────── ① シードデータ ──────────
     importance: 1=top, 2=briefing, 3=more
     readMin: 推定読了時間（分）
     ※ シードの記事は架空だが、url はソース公式サイトの news/blog ページを設定（リンク先は必ず実在する）。
       scraper が実RSSから記事を取得すると、その記事固有のURLで上書きされる。
  */
  const TODAY = '2026-04-17';
  const Y     = '2026-04-17';

  /* ── Executive Summary（シードデータ） ──
     実データが提供されない場合は deriveSummaryLines() が記事タイトルから自動生成する。 */
  let EXEC_SUMMARY = [];

  const NEWS_DATA = [
    {
      id: 'm3', importance: 1, readMin: 2, urgency: 'must_know',
      title: 'B2B購買行動調査2026：意思決定者の73%が「営業より先にAI検索を信頼」',
      summary: 'Gartner調査。B2B購買の比較段階で主要情報源としてChatGPT/Perplexityが営業資料・営業面談を上回った。回答者の73%が「営業と会う前にAI検索で候補を絞る」と回答。',
      whyItMatters: 'AKKODiSのサービスページがAI検索結果に出ていなければ、比較検討の土俵にすら乗れない。SEOとは別軸の対策が必要。',
      actionItem: '来週の定例で自社コンテンツのGEO対策（ChatGPT/Perplexityでの自社表示確認）を議題に入れる。',
      pickerComment: 'GEO（Generative Engine Optimization）はSEOの次の戦場。人材業界では「エンジニア 転職」等のキーワードでAI検索結果に表示されるかが採用数に直結する。早い者勝ちの領域。',
      source: 'Gartner', sourceType: 'media', category: 'marketing',
      url: null,
      image: null,
      publishedAt: `${TODAY}T09:10:00+09:00`,
      tags: ['B2B', 'GEO', '購買行動']
    },
    {
      id: 'a3', importance: 1, readMin: 2, urgency: 'must_know',
      title: 'Google検索の「AI Overviews」、すべての日本語クエリで標準ON化',
      summary: 'Google検索のAI Overviews（AI生成回答）が日本語クエリ全件で標準ON化。従来のオプトインから全面展開へ移行完了。',
      whyItMatters: '自然検索のCTRが20〜40%下落する可能性あり。AKKODiSの採用LP・サービスページへの流入減に直結する。早急にAI Overviewsでの引用状況を確認すべき。',
      actionItem: 'Search Consoleで主要キーワードのCTR変化をモニタリング開始。AI Overviewsに自社が表示されているか確認。',
      pickerComment: 'SEO担当者は今すぐ「site:自社ドメイン」でAI Overviewsに引用されているか確認すべき。構造化データのFAQ・HowToマークアップが引用率を高める傾向がある。',
      source: 'Google Search Central', sourceType: 'media', category: 'ai',
      url: null,
      image: null,
      publishedAt: `${TODAY}T18:40:00+09:00`,
      tags: ['SEO', 'GEO', 'Google']
    },
    {
      id: 'mk2', importance: 2, readMin: 1, urgency: 'this_week',
      title: 'Salesforce、Slack＋AgentforceでCMO向け「収益AIエージェント」発表',
      summary: 'SalesforceがSlack統合のAIエージェント「Agentforce」をCMO向けに正式発表。案件・キャンペーンの優先度を自動再計算し予算配分まで提案。',
      whyItMatters: '現在のMA/CRM契約更新時に「AIエージェント搭載か否か」が選定基準になる。Salesforce利用中なら追加費用なしで使える可能性あり。',
      actionItem: '自社のSalesforce契約でAgentforce利用可否を営業担当に確認する。',
      pickerComment: 'SalesforceのAIエージェント戦略はMarketing Cloud全体に波及する。既存ユーザーは追加費用なしで使える可能性が高いので、営業担当に確認するだけでROIが出る案件。',
      source: 'Salesforce News', sourceType: 'media', category: 'market',
      url: null,
      image: null,
      publishedAt: `${TODAY}T14:45:00+09:00`,
      tags: ['SaaS', 'AIエージェント', 'CMO']
    },
    {
      id: 'a1', importance: 2, readMin: 1, urgency: 'this_week',
      title: 'Anthropic、Claude 4.6 Opusの長文タスク性能を公開（200kコンテキスト維持）',
      summary: 'Anthropic がClaude 4.6 Opusを発表。200kコンテキストで100ページ超の資料を一括処理可能。レポート作成時間が平均1/4に短縮との事例。',
      whyItMatters: '競合分析レポートや市場調査の工数が1/4になるなら、浮いた時間を施策立案に回せる。人材業界の競合レポートで試す価値あり。',
      actionItem: '今抱えているレポート業務で試用し、時間短縮効果を検証する。',
      pickerComment: '200kトークンは文庫本1冊分。競合分析で10社分のIR資料を一括投入して比較表を作れる。レポート業務の「素材集め→構造化」が自動化される。',
      source: 'Anthropic', sourceType: 'media', category: 'ai',
      url: null,
      image: null,
      publishedAt: `${TODAY}T22:00:00+09:00`,
      tags: ['Claude', 'LLM', '要約']
    },
    {
      id: 'm1', importance: 2, readMin: 1, urgency: 'this_week',
      title: 'Google、Performance Max に「ブランド除外」レポート機能を正式追加',
      summary: 'Google Ads Performance Maxに「ブランド除外レポート」が正式追加。ブランドKW除外の効果が配信レポート上で個別に可視化可能に。',
      whyItMatters: 'PMax経由のCPAが高止まりしている場合、ブランドKW流入の混在が原因かもしれない。このレポートで切り分けて改善根拠を示せる。',
      actionItem: 'Google Ads管理画面でブランド除外レポートを確認し、月次レポートに追加。',
      pickerComment: 'PMaxはブラックボックスだった部分にようやく透明性が出てきた。特にBtoBはブランドKWの混在でCPAが歪みやすいので、この機能でROAS改善の根拠を示しやすくなる。',
      source: 'Google Ads Help', sourceType: 'media', category: 'marketing',
      url: null,
      image: null,
      publishedAt: `${TODAY}T08:30:00+09:00`,
      tags: ['広告', 'PMax', 'Google']
    },
    {
      id: 'mk1', importance: 2, readMin: 1, urgency: 'this_week',
      title: '日本のデジタル広告費、初の4兆円突破（電通報告）',
      summary: '電通発表。2025年の日本デジタル広告費は4兆1,200億円（前年比+9.4%）。ネット広告がマス4媒体合計を再び大きく上回り、動画広告が成長を牽引。',
      whyItMatters: '「動画に予算を寄せたい」と社内提案する際の決定的エビデンス。人材業界でも採用動画・サービス紹介動画の優先度を上げる根拠になる。',
      actionItem: '次の予算策定で動画広告枠の比率増を提案する際のエビデンスとしてストック。',
      pickerComment: '動画広告の伸びはショート動画が牽引。採用マーケでは30秒以内の「社員の1日」系コンテンツがCPV最安で成果が出ている企業が多い。',
      source: '電通', sourceType: 'media', category: 'market',
      url: null,
      image: null,
      publishedAt: `${TODAY}T10:00:00+09:00`,
      tags: ['広告費', '日本', '統計']
    },
    {
      id: 'mk3', importance: 2, readMin: 1, urgency: 'this_week',
      title: 'Cookieless時代のIDソリューション、UID2.0採用が前年比3倍に',
      summary: 'The Trade Desk主導のUnified ID 2.0が国内DSP/SSPでも標準対応に。採用数は前年比3倍。Chrome 3rdパーティクッキー段階廃止を見据えた動き。',
      whyItMatters: '現在のリターゲティング施策がクッキー依存なら、配信効率が半減するリスク。人材系のディスプレイ広告は特に影響大。',
      actionItem: '利用中のDSP/SSPがUID2.0対応済みか確認し、未対応なら代替を検討。',
      pickerComment: 'UID2.0はメールアドレスベースなので、会員登録フローを持つ採用サイトとは相性が良い。自社の1st Partyデータ活用戦略と合わせて検討する価値がある。',
      source: 'AdExchanger', sourceType: 'media', category: 'market',
      url: null,
      image: null,
      publishedAt: `${TODAY}T07:50:00+09:00`,
      tags: ['Cookieless', 'AdTech']
    },
    {
      id: 'm2', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'Marketo、生成AIによる「件名A/B自動最適化」を全プランで提供開始',
      summary: 'Marketo Engageが生成AIによる「件名A/B自動最適化」を全プランで提供開始。送信30分のオープン率を学習し残りセグメントに最適件名を自動配信。',
      whyItMatters: '設定をONにするだけでメール開封率+18%の可能性。ナーチャリング施策の費用対効果が設定変更だけで改善できる。',
      actionItem: 'Marketo利用中なら設定画面でAI件名最適化をONにして次回配信でテスト。',
      pickerComment: 'MA各社がAI件名最適化を投入中。設定ONだけで効果が出るので、使わない理由がない。ただし日本語の件名最適化精度は英語より低い傾向があるので、最初の数回は結果を注視すべき。',
      source: 'Adobe Marketo Engage', sourceType: 'media', category: 'marketing',
      url: null,
      image: null,
      publishedAt: `${TODAY}T11:05:00+09:00`,
      tags: ['MA', 'メール', 'AI']
    },
    {
      id: 'a2', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'OpenAI、GPT-5系で「ブランドボイス制約」APIパラメータをβ提供',
      summary: 'OpenAIがGPT-5系で「ブランドボイス制約」APIパラメータをβ提供開始。トーン＆マナーからの逸脱を確率でブロックする機能。',
      whyItMatters: 'AI生成コンテンツで「AKKODiSのトーンと違う」事故を防げる。採用広報やメルマガでAIを使っているなら導入メリット大。',
      actionItem: 'AI活用のコンテンツ制作フローがある場合、β申請を検討。',
      pickerComment: '「ブランドボイス制約」はエンタープライズ向けAI利用の大きなペインポイントを解消する。採用広報でAI生成テキストを使っている企業は導入検討の価値あり。',
      source: 'OpenAI', sourceType: 'media', category: 'ai',
      url: null,
      image: null,
      publishedAt: `${TODAY}T20:15:00+09:00`,
      tags: ['GPT-5', 'API', 'ブランドガバナンス']
    },
    {
      id: 'm5', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'TikTok、Search Adsを日本含む新規10カ国へ拡大',
      summary: 'TikTokがSearch Ads（検索連動型広告）を日本含む新規10カ国で提供開始。検索結果画面に広告枠が新設される。',
      whyItMatters: '新卒・第二新卒の採用ターゲットはTikTok検索が定着済み。採用マーケでのリーチ手段が1つ増える。',
      actionItem: 'ターゲットにZ世代を含む場合、TikTok Search Adsのβ申請を検討。',
      pickerComment: 'TikTok検索は「〇〇 転職」で実際に使われ始めている。新卒採用でTikTokを活用している企業は検索広告も試す価値がある。CPCはまだGoogleより安い。',
      source: 'TikTok for Business', sourceType: 'media', category: 'marketing',
      url: null,
      image: null,
      publishedAt: `${TODAY}T13:00:00+09:00`,
      tags: ['SNS', '検索広告']
    },
    {
      id: 'm4', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'HubSpot、無料CRMに「会話インテリジェンス（録音文字起こし＋要約）」追加',
      summary: 'HubSpot無料CRMに「会話インテリジェンス」追加。Zoom/Google Meetの商談を自動文字起こし・要約しCRMに紐付け。月25時間まで無料。',
      whyItMatters: '商談で聞いた「お客様の課題」が自動でテキスト化される。コンテンツマーケのネタ出しや採用広報の声素材として転用できる。',
      actionItem: 'HubSpot利用中ならZoom連携をONにして、商談要約のコンテンツ活用を試す。',
      pickerComment: '商談の文字起こしをそのままコンテンツマーケのネタ帳にする発想が重要。「お客様がよく使うフレーズ」をLP・広告コピーに反映すると、共感率が上がる。',
      source: 'HubSpot', sourceType: 'media', category: 'marketing',
      url: null,
      image: null,
      publishedAt: `${TODAY}T15:20:00+09:00`,
      tags: ['CRM', 'セールス']
    },
    {
      id: 'mk4', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'Meta、Llama 4をオープンソース化。マーケ特化の軽量版も同時公開',
      summary: 'MetaがLlama 4をオープンソース化。8B/70B/400Bの3サイズに加え、マーケ特化の軽量版（Llama 4 Marketing）も同時公開。自社サーバーでの運用が可能。',
      whyItMatters: 'APIコストを気にせずAI活用できる選択肢が増える。特にコピー生成・キーワード抽出など定型業務の内製化が現実的になる。',
      actionItem: '情シスと連携し、Llama 4 Marketingを社内GPUサーバーで試用できるか検討する。',
      pickerComment: 'オープンソースLLMはコスト削減だけでなく、社内データを外部に出さずAI活用できるのが本質。ガバナンス要件が厳しいBtoBでは特に価値が高い。',
      source: 'Meta AI', sourceType: 'media', category: 'ai',
      url: null,
      image: null,
      publishedAt: `${TODAY}T06:30:00+09:00`,
      tags: ['Llama', 'オープンソース', 'LLM']
    },
    {
      id: 'm6', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'Instagram、Reelsの広告に「自動翻訳＋吹き替え」機能を追加',
      summary: 'InstagramがReels広告で「自動翻訳＋AI吹き替え」機能を追加。1つの動画で多言語展開が可能に。英語→日本語の吹き替え品質が大幅向上。',
      whyItMatters: 'グローバル採用動画を1本作れば多言語展開できる。海外エンジニア採用向けのリーチ手段として有効。',
      actionItem: '海外採用を強化する部署向けに、Reels自動翻訳のPoC企画を提案。',
      pickerComment: 'AI吹き替えは口の動きと声の同期まで処理される。採用動画で「日本人社員が英語を話す」違和感を減らせるので、海外向け発信のハードルが下がる。',
      source: 'Meta Business', sourceType: 'media', category: 'marketing',
      url: null,
      image: null,
      publishedAt: `${TODAY}T12:10:00+09:00`,
      tags: ['SNS', '動画', '多言語']
    },
    {
      id: 'mk5', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'Gartner「2026年のマーケ予算、AIツールへの配分が平均18%に」',
      summary: 'Gartner調査。2026年のマーケ予算でAIツール関連の支出が平均18%（前年比+6pt）。特に「コンテンツ生成」「パーソナライズ」「分析自動化」の3領域で増加。',
      whyItMatters: '予算策定時の「AIツールへの投資は同業他社はどれくらい？」への回答根拠になる。18%を目安にすれば業界水準。',
      actionItem: '来期予算書で AI ツール関連の支出比率を算出し、18%との差分を明記。',
      pickerComment: 'AI投資比率は業界で大きく差がつき始めている。採用領域は「マッチング精度」で直接成果が出やすいので、この18%より高めに寄せる判断も妥当。',
      source: 'Gartner', sourceType: 'media', category: 'market',
      url: null,
      image: null,
      publishedAt: `${TODAY}T09:45:00+09:00`,
      tags: ['予算', '業界統計', 'AI投資']
    },
    {
      id: 'a4', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'Perplexity、企業向け「Enterprise Pro」を日本でも提供開始',
      summary: 'PerplexityがEnterprise Proを日本展開。社内ドキュメントを取り込んで「社内版AI検索」として利用可能。SSO/監査ログ対応。',
      whyItMatters: '社内の過去資料・議事録・営業マニュアルをAI検索できるようになる。属人化した知識の共有コストが劇的に下がる。',
      actionItem: '無料トライアルを申請し、直近1年の営業資料をインポートして検索精度を検証。',
      pickerComment: 'ChatGPT Enterpriseより「社内文書検索」に特化している点が実用的。採用マーケなら「過去の採用資料」「候補者対応テンプレ」を全員が秒で引けるようになる。',
      source: 'Perplexity AI', sourceType: 'media', category: 'ai',
      url: null,
      image: null,
      publishedAt: `${TODAY}T16:00:00+09:00`,
      tags: ['AI検索', 'エンタープライズ', 'ナレッジ']
    }
  ];

  /* ────────── ② Xハイライト（生成AIトレンド収集） ──────────
     目的: Xで話題の生成AI関連ポストを収集し、マーケ実務に活かせるトレンドを提示する。
     ※ シードに入れるのは実在が確認できた本物のポストのみ（URL をクリックして現物が読める状態）。
       scraper が X API 等で実ツイートを取得したら news.json の `xHighlights` に入れ、
       loadRemote() 経由で上書きされる。URL 無しのアイテムは renderX() で除外される。
  */
  let X_HIGHLIGHTS = [
    {
      id: 'x1',
      author: '深津 貴之 / THE GUILD',
      handle: '@fladdict',
      avatar: 'https://unavatar.io/x/fladdict',
      text: 'AI時代の勝負の仕方は、「生成AIで勝負しないことだ」という話をした。「生成AIの実装者」としては世界上位1%に入れないが、「生成AI利活用に詳しいUXデザイナ」なら世界上位1%に入れる。ブルーオーシャン。',
      tag: 'AI戦略',
      url: 'https://x.com/fladdict/status/1894169837339119800'
    },
    {
      id: 'x2',
      author: '深津 貴之 / THE GUILD',
      handle: '@fladdict',
      avatar: 'https://unavatar.io/x/fladdict',
      text: '2025年としては正しい意見なのだけど、2027年ぐらいのAIはそのクソ負債を解決してくれる…と投機運用も一定アリだと考えるす',
      tag: 'AI技術負債',
      url: 'https://x.com/fladdict/status/1955257798364635570'
    },
    {
      id: 'x3',
      author: 'Kaz Ataka / 安宅和人',
      handle: '@kaz_ataka',
      avatar: 'https://unavatar.io/x/kaz_ataka',
      text: 'すべてのブラウザはAI化することは確実だと思っていたが、これはなかなかの代物だな。LLMのヘビーユーザの場合、Webへのアクセスは多くがAI bot経由になる時代になりそうだ。',
      tag: 'AIブラウザ',
      url: 'https://x.com/kaz_ataka/status/1980753665540632636'
    },
    {
      id: 'x4',
      author: 'Kaz Ataka / 安宅和人',
      handle: '@kaz_ataka',
      avatar: 'https://unavatar.io/x/kaz_ataka',
      text: '生成AIに向かい合う際に求められるプロ側のスキルと、一人ひとりの心と知覚の育成について。生成AIを使えるかどうかはイシューではない。',
      tag: '生成AIスキル',
      url: 'https://x.com/kaz_ataka/status/1736184101693215195'
    },
    {
      id: 'x5',
      author: '落合陽一 Yoichi OCHIAI',
      handle: '@ochyai',
      avatar: 'https://unavatar.io/x/ochyai',
      text: 'AIが歌詞を書いて、AIが作曲をして、AIがストーリーボードを作って、AIがPVを作って、AIが過去の単語からアーティスト名を決めて、AIが歌詞からタイトルを決めて…と「人間の関与性」をどんどん減らしていく音楽というのを楽しめるように感覚が変容するのは面白い。',
      tag: 'AIクリエイティブ',
      url: 'https://x.com/ochyai/status/1868445856304967827'
    },
    {
      id: 'x6',
      author: '落合陽一 Yoichi OCHIAI',
      handle: '@ochyai',
      avatar: 'https://unavatar.io/x/ochyai',
      text: 'AI音楽＋AI PVが一日に50万回くらい再生されちゃうし、あとは魅力的な演出がされたAIと人間の中間地点あたりに感情移入できる仕組みの構築、名付け・設定・タイトルかな。',
      tag: 'AIコンテンツ',
      url: 'https://x.com/ochyai/status/1868140518653497657'
    },
    {
      id: 'x7',
      author: '成田 悠輔',
      handle: '@narita_yusuke',
      avatar: 'https://unavatar.io/x/narita_yusuke',
      text: '格闘ゲームでは大昔から人間はゲームAIの足元にも及ばないらしい。けど人間ゲーマーは消えずむしろ金と愛が流れ込んでる。「人がAIに勝つか」で騒ぎがちだけど、大事なのは「AIに惨敗した人間に私達は憧れられるか」だ。',
      tag: 'AIと人間',
      url: 'https://x.com/narita_yusuke/status/1239392108751937537'
    },
    {
      id: 'x8',
      author: 'KAJI | 梶谷健人',
      handle: '@kajikent',
      avatar: 'https://unavatar.io/x/kajikent',
      text: 'AIを使いこなせない人に決定的に欠けてるのは「AI活用力」ではなく「マネジメントスキル」である',
      tag: 'AIマネジメント',
      url: 'https://x.com/kajikent/status/2036958690390270431'
    },
    {
      id: 'x9',
      author: 'KAJI | 梶谷健人',
      handle: '@kajikent',
      avatar: 'https://unavatar.io/x/kajikent',
      text: 'AIの進化によって、仕事において「人の良さ」はベター要件からマスト要件になった',
      tag: 'AI×人間性',
      url: 'https://x.com/kajikent/status/2029051141192073288'
    }
  ];

  /* ────────── ③ メタ ──────────  */
  const CATEGORIES = [
    { key: 'all',       label: 'すべて' },
    { key: 'marketing', label: 'マーケ' },
    { key: 'market',    label: '市場' },
    { key: 'ai',        label: 'AI' }
  ];
  const CAT_LABEL = { marketing: 'マーケ', market: '市場', ai: 'AI' };

  const STORE_KEY_FAV   = 'ai-news:fav:v1';
  const STORE_KEY_READ  = 'ai-news:read:v1';
  const STORE_KEY_PREFS = 'ai-news:prefs:v1';

  function loadSet(k) {
    try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); }
    catch { return new Set(); }
  }
  function saveSet(k, set) {
    try { localStorage.setItem(k, JSON.stringify([...set])); } catch {}
  }
  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY_PREFS) || '{}') || {}; }
    catch { return {}; }
  }
  function savePrefs() {
    try {
      localStorage.setItem(STORE_KEY_PREFS, JSON.stringify({
        activeCat: state.activeCat,
        favOnly: state.favOnly,
        unreadOnly: state.unreadOnly
      }));
    } catch {}
  }

  /* ────────── ④ 状態 ──────────  */
  const _prefs = loadPrefs();
  const state = {
    activeCat: ['all','marketing','market','ai'].includes(_prefs.activeCat) ? _prefs.activeCat : 'all',
    favOnly: !!_prefs.favOnly,
    unreadOnly: !!_prefs.unreadOnly,
    keyword: '',
    fav:  loadSet(STORE_KEY_FAV),
    read: loadSet(STORE_KEY_READ)
  };

  /* ────────── ⑤ ユーティリティ ──────────  */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    })[c]);
  }
  const WEEKDAYS = ['日','月','火','水','木','金','土'];
  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const wd = WEEKDAYS[d.getDay()];
    return `${m}/${day}(${wd}) ${hh}:${mm}`;
  }
  function fmtBriefDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const wd = WEEKDAYS[d.getDay()];
    return `${d.getMonth()+1}/${d.getDate()}(${wd})`;
  }
  function fmtRelative(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    const wd = WEEKDAYS[d.getDay()];
    if (diff < 60) return 'たった今';
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
    if (diff < 172800) return `昨日(${wd})`;
    return `${d.getMonth()+1}/${d.getDate()}(${wd})`;
  }
  /** 直近 FRESH_HOURS 時間以内なら true（「新着」表示に使う） */
  const FRESH_HOURS = 3;
  function isFresh(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return false;
    return (Date.now() - d.getTime()) < FRESH_HOURS * 3600 * 1000;
  }
  function totalReadTime(items) {
    return items.reduce((a, n) => a + (n.readMin || 1), 0);
  }
  function openExternal(url) {
    if (!url || typeof url !== 'string') return;
    if (!/^https?:\/\//.test(url)) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  let _toastTimer;
  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(_toastTimer);
    el.textContent = msg;
    el.classList.add('show');
    _toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }
  async function shareArticle(title, url) {
    const text = `${title}\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch {}
    }
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(text); showToast('リンクをコピーしました'); return; } catch {}
    }
    showToast('共有に失敗しました');
  }
  /** 画像URLが安全かチェック（https のみ許可） */
  function safeImgUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const u = url.trim();
    if (u.startsWith('https://')) return u;
    if (u.startsWith('data:image/')) return u;
    return '';
  }
  /** img onerror: 壊れた画像を非表示にし、親にフォールバッククラスを付与 */
  /**
   * 画像読み込み失敗時のリトライ戦略:
   * 1st failure → picsum.photos のシード画像に切り替え（ほぼ100%ロードできる）
   * 2nd failure → navy グラデーションのフォールバック背景
   */
  const IMG_ONERROR = "if(this.dataset.fbk!=='1'){this.dataset.fbk='1';this.src='https://picsum.photos/seed/'+encodeURIComponent(this.dataset.seed||this.alt||Date.now())+'/800/450';}else{this.onerror=null;this.style.display='none';this.parentElement.classList.add('img-fallback');}";
  const IMG_ONLOAD = "this.classList.add('loaded');";

  /**
   * テーマ別フォールバック画像（Unsplash、固定ID = CORSフリー）。
   * 記事のタグ・カテゴリから最適な画像を選ぶ。
   * OGP画像が無い場合にカードが空にならないよう自動マッピング。
   */
  const THEMED_IMAGES = {
    ai: [
      'photo-1677442136019-21780ecad995',
      'photo-1620712943543-bcc4688e7485',
      'photo-1485827404703-89b55fcc595e',
      'photo-1526374965328-7f61d4dc18c5',
    ],
    marketing: [
      'photo-1460925895917-afdab827c52f',
      'photo-1551288049-bebda4e38f71',
      'photo-1552664730-d307ca884978',
      'photo-1552664688-cf412ec27db2',
    ],
    market: [
      'photo-1553877522-43269d4ea984',
      'photo-1554224155-6726b3ff858f',
      'photo-1498050108023-c5249f4df085',
      'photo-1504384308569-01cfe5e3268d',
    ],
  };

  // タグ別の関連画像（タグ優先マッチ）
  const TAG_IMAGES = {
    'SEO': 'photo-1573804633927-bfcbcd909acd',
    'Google': 'photo-1573804633927-bfcbcd909acd',
    'GEO': 'photo-1562577309-4932fdd64cd1',
    'メール': 'photo-1596526131083-e8c633c948d2',
    'MA': 'photo-1596526131083-e8c633c948d2',
    '動画': 'photo-1611162617213-7d7a39e9b1d7',
    'Cookie': 'photo-1563986768609-322da13575f2',
    'Cookieless': 'photo-1563986768609-322da13575f2',
    'SNS': 'photo-1611605698335-8b1569810432',
    'TikTok': 'photo-1611605698335-8b1569810432',
    'Claude': 'photo-1677442136019-21780ecad995',
    'LLM': 'photo-1620712943543-bcc4688e7485',
    'GPT-5': 'photo-1620712943543-bcc4688e7485',
    'CRM': 'photo-1556761175-5973dc0f32e7',
    'セールス': 'photo-1556761175-5973dc0f32e7',
    'B2B': 'photo-1556761175-5973dc0f32e7',
    '広告費': 'photo-1551288049-bebda4e38f71',
    '広告': 'photo-1551288049-bebda4e38f71',
    'PMax': 'photo-1551288049-bebda4e38f71',
    'AdTech': 'photo-1551288049-bebda4e38f71',
    'Claude Code': 'photo-1517180102446-f3ece451e9d8',
    'AIエージェント': 'photo-1485827404703-89b55fcc595e',
    'SaaS': 'photo-1498050108023-c5249f4df085',
    'ブランドガバナンス': 'photo-1517841905240-472988babdf9',
  };

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < (str || '').length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function themedImageUrl(article) {
    // 1. タグ優先マッチ
    for (const tag of (article.tags || [])) {
      if (TAG_IMAGES[tag]) {
        return `https://images.unsplash.com/${TAG_IMAGES[tag]}?w=800&h=450&fit=crop&auto=format&q=80`;
      }
    }
    // 2. カテゴリからローテーション選択
    const cat = article.category || 'ai';
    const pool = THEMED_IMAGES[cat] || THEMED_IMAGES.ai;
    const idx = hashStr(article.id || article.title || '') % pool.length;
    return `https://images.unsplash.com/${pool[idx]}?w=800&h=450&fit=crop&auto=format&q=80`;
  }

  /** 実画像（OGP）があればそれを返し、無ければテーマ別Unsplash画像を返す */
  function pickImage(article) {
    return safeImgUrl(article.image) || themedImageUrl(article);
  }

  /** ソースドメインから favicon URL を生成（Google Favicon API は CORS なし） */
  function sourceFavicon(url, size = 64) {
    if (!url) return null;
    try {
      const u = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=${size}`;
    } catch { return null; }
  }

  /**
   * 記事リンク: scraper が RSS から取得した実URL (n.url) を使う。
   * URLが無い記事は要素自体を描画しない（検索フォールバックは混乱を招くため廃止）。
   */
  function articleLink(n) {
    return (n && n.url) ? n.url : null;
  }
  function articleLinkLabel() {
    return '元記事を読む →';
  }


  /** OGP画像をクライアントサイドで取得し、記事データとDOMを更新 */
  const ogpCache = {};
  async function fetchOgpImage(url) {
    if (!url || ogpCache[url] !== undefined) return ogpCache[url] || null;
    ogpCache[url] = null;
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const html = await resp.text();
      const m = html.match(/<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image(?::src)?)["'][^>]*content\s*=\s*["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]*(?:property|name)\s*=\s*["'](?:og:image|twitter:image(?::src)?)["']/i);
      if (!m) return null;
      const imgUrl = m[1].trim();
      if (!imgUrl.startsWith('https://')) return null;
      ogpCache[url] = imgUrl;
      return imgUrl;
    } catch { return null; }
  }

  async function enrichOgpImages() {
    const tasks = NEWS_DATA.filter(n => n.url && !n.image).map(async (n) => {
      const img = await fetchOgpImage(n.url);
      if (!img) return;
      n.image = img;
      document.querySelectorAll(`[data-id="${n.id}"]`).forEach(card => {
        const topVisual = card.querySelector('.top-visual');
        if (topVisual) {
          const hero = document.createElement('div');
          hero.className = 'top-hero';
          hero.innerHTML = `<img src="${img}" alt="" loading="lazy" onload="${IMG_ONLOAD}" onerror="${IMG_ONERROR}"><div class="top-hero-overlay"><span class="hero-chip cat-${n.category}">${escapeHtml(CAT_LABEL[n.category] || n.category)}</span><span class="hero-source">${escapeHtml(n.source)} · ${escapeHtml(fmtRelative(n.publishedAt))}${isFresh(n.publishedAt) ? '<span class="fresh-dot" aria-label="新着">●</span>' : ''}</span></div>`;
          topVisual.replaceWith(hero);
        }
        const briefVisual = card.querySelector('.brief-card-visual');
        if (briefVisual) {
          const thumb = document.createElement('div');
          thumb.className = 'brief-card-thumb';
          thumb.innerHTML = `<img src="${img}" alt="" loading="lazy" onload="${IMG_ONLOAD}" onerror="${IMG_ONERROR}">`;
          briefVisual.replaceWith(thumb);
        }
        const fyiVisual = card.querySelector('.fyi-visual');
        if (fyiVisual) {
          const thumb = document.createElement('div');
          thumb.className = 'fyi-thumb';
          thumb.innerHTML = `<img src="${img}" alt="" loading="lazy" onload="${IMG_ONLOAD}" onerror="${IMG_ONERROR}">`;
          fyiVisual.replaceWith(thumb);
        }
      });
    });
    await Promise.allSettled(tasks);
  }
  function toggleRead(id, el) {
    if (state.read.has(id)) {
      state.read.delete(id);
      if (el) el.classList.remove('read');
    } else {
      state.read.add(id);
      if (el) el.classList.add('read');
    }
    saveSet(STORE_KEY_READ, state.read);
    updateProgress();
  }
  function markRead(id, el) {
    state.read.add(id);
    saveSet(STORE_KEY_READ, state.read);
    if (el) el.classList.add('read');
    updateProgress();
  }
  function toggleFav(id, btn) {
    if (state.fav.has(id)) state.fav.delete(id);
    else state.fav.add(id);
    saveSet(STORE_KEY_FAV, state.fav);
    if (btn) {
      btn.classList.toggle('starred', state.fav.has(id));
      btn.setAttribute('aria-pressed', state.fav.has(id));
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
    }
  }

  /* ────────── ⑤b トレンド抽出 ──────────  */
  function extractTrends() {
    const freq = {};
    for (const n of NEWS_DATA) {
      for (const t of (n.tags || [])) {
        freq[t] = (freq[t] || 0) + 1;
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
  }

  function renderTrends() {
    const bar = document.getElementById('trend-bar');
    if (!bar) return;
    const trends = extractTrends();
    const label = '<span class="trend-label">HOT TOPICS</span>';
    const pills = trends.map(t =>
      `<button class="trend-pill" data-trend="${escapeHtml(t.tag)}">#${escapeHtml(t.tag)}</button>`
    ).join('');
    bar.innerHTML = label + pills;
    bar.querySelectorAll('.trend-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.trend;
        const search = document.getElementById('search');
        if (search) {
          const isActive = btn.classList.contains('active');
          bar.querySelectorAll('.trend-pill').forEach(b => b.classList.remove('active'));
          if (isActive) {
            search.value = '';
            state.keyword = '';
          } else {
            btn.classList.add('active');
            search.value = tag;
            state.keyword = tag;
          }
          renderMore(_moreRef);
        }
      });
    });
  }

  /* ────────── ⑥ 仕分け（urgency ベース） ──────────  */
  const URG_ORDER = { must_know: 0, this_week: 1, fyi: 2 };
  function partition() {
    const sorted = [...NEWS_DATA].sort((a, b) => {
      const ua = URG_ORDER[a.urgency] ?? 2, ub = URG_ORDER[b.urgency] ?? 2;
      if (ua !== ub) return ua - ub;
      // 同urgency内: importance昇順 → 新しい順
      if (a.importance !== b.importance) return a.importance - b.importance;
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });
    let mustKnow = sorted.filter(n => n.urgency === 'must_know').slice(0, 2);
    // 重要ニュースが空の場合、次点（this_week → fyi）から1件繰り上げる
    if (mustKnow.length === 0 && sorted.length > 0) {
      mustKnow = sorted.slice(0, 1);
    }
    const usedIds1 = new Set(mustKnow.map(n => n.id));
    let thisWeek = sorted.filter(n => n.urgency === 'this_week' && !usedIds1.has(n.id)).slice(0, 4);
    // 注目ニュースも空なら fyi から繰り上げ（最大3件）
    if (thisWeek.length === 0) {
      thisWeek = sorted.filter(n => !usedIds1.has(n.id)).slice(0, 3);
    }
    const usedIds = new Set([...mustKnow.map(n => n.id), ...thisWeek.map(n => n.id)]);
    const fyi = sorted.filter(n => !usedIds.has(n.id));
    return { mustKnow, thisWeek, fyi };
  }

  /* ────────── ⑦ レンダリング ──────────  */
  function animateCount(el, target, suffix) {
    if (!el) return;
    const duration = 600;
    const start = performance.now();
    const from = 0;
    function step(ts) {
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (target - from) * ease) + (suffix || '');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function timeAwareGreeting() {
    const h = new Date().getHours();
    if (h >= 4 && h < 11) return 'おはようございます ☕ 今朝のマーケ動向です';
    if (h >= 11 && h < 17) return 'こんにちは ☀️ 昼休みにキャッチアップ';
    if (h >= 17 && h < 22) return 'お疲れさまです 🌙 今日のニュースまとめ';
    return 'こんばんは ✨ 明日に向けた情報ブリーフ';
  }

  function renderHero() {
    const total = NEWS_DATA.length;
    const read  = totalReadTime(NEWS_DATA);
    const mustCount  = NEWS_DATA.filter(n => n.urgency === 'must_know').length;
    const weekCount  = NEWS_DATA.filter(n => n.urgency === 'this_week').length;
    const fyiCount   = NEWS_DATA.filter(n => !['must_know','this_week'].includes(n.urgency)).length;
    document.getElementById('stat-date').textContent = fmtBriefDate(Y);
    animateCount(document.getElementById('stat-total'), total, '');
    animateCount(document.getElementById('stat-read'), read, '分');
    const bd = document.getElementById('stat-breakdown');
    if (bd) bd.innerHTML = `<b>${mustCount}</b>重要 · <b>${weekCount}</b>注目 · <b>${fyiCount}</b>その他`;
    // スタックバーの各セグメントに flex 比を割り当てて可視化
    const hsbMust = document.getElementById('hsb-must');
    const hsbWeek = document.getElementById('hsb-week');
    const hsbFyi  = document.getElementById('hsb-fyi');
    if (hsbMust) hsbMust.style.flex = String(mustCount || 0);
    if (hsbWeek) hsbWeek.style.flex = String(weekCount || 0);
    if (hsbFyi)  hsbFyi.style.flex  = String(fyiCount  || 0);
    const greet = document.getElementById('hero-greeting');
    if (greet) greet.textContent = timeAwareGreeting();
    // LIVE インジケーター: 最終更新を相対表記で
    const live = document.getElementById('hero-live-updated');
    if (live) {
      const ts = dataMeta.updatedAt || dataMeta.generatedFor || new Date().toISOString();
      live.textContent = `最終更新 ${fmtRelative(ts)}`;
    }
  }

  /* ── Executive Summary ── */
  /** 実データで EXEC_SUMMARY が空の時、top記事 3件のタイトル+影響でサマリーを生成 */
  function deriveSummaryLines() {
    const { mustKnow, thisWeek, fyi } = partition();
    const pick = [...mustKnow, ...thisWeek, ...fyi].slice(0, 3);
    return pick.map(n => {
      const base = n.whyItMatters && n.whyItMatters.length > 8 ? n.whyItMatters : n.summary;
      if (base && base.length > 10) return base.length > 80 ? base.slice(0, 78) + '…' : base;
      return n.title;
    });
  }
  function renderExecSummary() {
    const root = document.getElementById('exec-summary');
    if (!root) return;
    let lines = EXEC_SUMMARY;
    if (!lines || !lines.length || lines.every(l => !String(l || '').trim())) {
      lines = deriveSummaryLines();
    }
    if (!lines || !lines.length) {
      root.innerHTML = '<div class="empty" style="border:none;"><div class="empty-text">サマリーはまだ生成されていません</div></div>';
      return;
    }
    // 各サマリー行に対応する記事（must-know → this-week の順でフラット化）を推定してソース表記を付ける
    const { mustKnow, thisWeek } = partition();
    const refs = [...mustKnow, ...thisWeek];
    root.innerHTML = lines.map((line, i) => {
      const n = refs[i];
      let sourceHtml = '';
      if (n) {
        const src = escapeHtml(n.source || '');
        if (n.url && /^https?:\/\//.test(n.url)) {
          sourceHtml = `<a class="exec-src" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">${src} →</a>`;
        } else {
          sourceHtml = `<a class="exec-src" href="#sec-must-know" data-scroll="sec-must-know">${src} →</a>`;
        }
      }
      return `<div class="exec-line"><span class="exec-bullet" aria-hidden="true"></span><div class="exec-line-body"><span class="exec-text">${escapeHtml(line)}</span>${sourceHtml ? `<span class="exec-ref">${sourceHtml}</span>` : ''}</div></div>`;
    }).join('');
    // スクロールリンク
    root.querySelectorAll('.exec-src[data-scroll]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const el = document.getElementById(a.dataset.scroll);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ── MUST-KNOW レンダリング ── */
  function renderMustKnow(items) {
    const root = document.getElementById('must-know');
    if (!items.length) {
      root.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">重要ニュースはありません</div></div>';
      return;
    }
    root.innerHTML = items.map((n, idx) => {
      const isRead = state.read.has(n.id);
      const isFav  = state.fav.has(n.id);
      const cat = n.category;
      const hasUrl = !!n.url;
      const isTopStory = idx === 0;
      const imgSrc = pickImage(n);
      const titleHtml = hasUrl
        ? `<a class="top-title-link" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.title)}</a>`
        : escapeHtml(n.title);
      const favicon = sourceFavicon(n.url) || '';
      const initials = (n.source || '').substring(0, 2).toUpperCase();
      return `
      <article class="top-card${isRead ? ' read' : ''}${isTopStory ? ' top-story' : ''}" data-id="${n.id}" data-url="${hasUrl ? escapeHtml(n.url) : ''}" data-cat="${cat}" tabindex="0" aria-label="${escapeHtml(n.title)}">
        ${isTopStory ? '<div class="top-story-ribbon" aria-hidden="true"><span class="top-story-ribbon-num">#1</span><span class="top-story-ribbon-label">TOP STORY</span></div>' : ''}
        ${imgSrc ? `
        <div class="top-hero">
          <img src="${escapeHtml(imgSrc)}" alt="" data-seed="${escapeHtml(n.id)}" loading="lazy" onload="${IMG_ONLOAD}" onerror="${IMG_ONERROR}">
          <div class="top-hero-overlay">
            <span class="hero-chip ${'cat-' + cat}">${escapeHtml(CAT_LABEL[cat] || cat)}</span>
            <span class="hero-source">${escapeHtml(n.source)} · ${escapeHtml(fmtRelative(n.publishedAt))}${isFresh(n.publishedAt) ? '<span class="fresh-dot" aria-label="新着">●</span>' : ''}</span>
          </div>
        </div>` : `
        <div class="top-visual ${'cat-' + cat}">
          <div class="top-visual-bg">${escapeHtml(CAT_LABEL[cat] || cat).toUpperCase()}</div>
          <div class="top-visual-top">
            <span class="hero-chip ${'cat-' + cat}">${escapeHtml(CAT_LABEL[cat] || cat)}</span>
            <span class="top-visual-breaking">BREAKING</span>
          </div>
          <div class="top-visual-bottom">
            <div class="top-visual-source">
              ${favicon ? `<img class="source-logo" src="${favicon}" alt="" onerror="this.style.display='none';">` : `<span class="source-initials">${escapeHtml(initials)}</span>`}
              <div class="top-visual-source-text">
                <div class="top-visual-source-name">${escapeHtml(n.source)}</div>
                <div class="top-visual-source-time">${escapeHtml(fmtRelative(n.publishedAt))}${isFresh(n.publishedAt) ? '<span class="fresh-dot" aria-label="新着">●</span>' : ''}</div>
              </div>
            </div>
          </div>
        </div>`}
        <div class="top-content">
          <h2 class="top-title">${titleHtml}</h2>
          <p class="top-summary">${escapeHtml(n.summary)}</p>
          ${n.whyItMatters ? `<div class="top-impact"><span class="top-impact-label">⚡ なぜ重要か（マーケ視点）</span><span class="top-impact-text">${escapeHtml(n.whyItMatters)}</span></div>` : ''}
          ${n.actionItem ? `<div class="top-action"><span class="top-action-label">🎯 マーケとして何をすべきか</span><span class="top-action-text">${escapeHtml(n.actionItem)}</span></div>` : ''}
          ${n.pickerComment || (n.tags && n.tags.length) ? `
          <details class="intel-details">
            <summary class="intel-toggle">▼ 専門家の視点を読む</summary>
            <div class="intel-body">
              ${n.pickerComment ? `<div class="picker-comment"><span class="picker-icon">💡</span><div class="picker-content"><div class="picker-label">専門家の視点</div><div class="picker-text">${escapeHtml(n.pickerComment)}</div></div></div>` : ''}
              ${(n.tags && n.tags.length) ? `<div class="intel-tags">${n.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
              ${hasUrl ? `<a class="intel-source-link" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">元記事を読む（${escapeHtml(n.source)}） →</a>` : ''}
            </div>
          </details>` : ''}
          <div class="top-foot">
            <button class="read-toggle" data-read-id="${n.id}" title="既読/未読を切替">${isRead ? '↩ 未読' : '✓ 既読'}</button>
            <button class="star-btn${isFav ? ' starred' : ''}" data-fav="${n.id}" aria-label="お気に入り" aria-pressed="${isFav}">★</button>
            ${hasUrl ? `<button class="share-btn" data-share-title="${escapeHtml(n.title)}" data-share-url="${escapeHtml(n.url)}" aria-label="共有">↗ 共有</button>` : ''}
            ${hasUrl ? `<a class="ext-btn" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">元記事を読む →</a>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');
    root.querySelectorAll('.read-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.readId;
        const card = btn.closest('.top-card');
        toggleRead(id, card);
        btn.textContent = state.read.has(id) ? '↩ 未読に戻す' : '✓ 既読にする';
      });
    });
    root.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); toggleFav(btn.dataset.fav, btn); });
    });
    root.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        shareArticle(btn.dataset.shareTitle, btn.dataset.shareUrl);
      });
    });
  }

  function renderThisWeek(items) {
    const root = document.getElementById('this-week');
    if (!items.length) {
      root.innerHTML = '<div class="empty" style="border:none;"><div class="empty-text">注目ニュースはありません</div></div>';
      return;
    }
    root.innerHTML = items.map((n, i) => {
      const isRead = state.read.has(n.id);
      const isFav  = state.fav.has(n.id);
      const cat = n.category;
      const hasUrl = !!n.url;
      const imgSrc = pickImage(n);
      const hasDetail = !!(n.whyItMatters || n.actionItem || n.pickerComment);
      const bFavicon = sourceFavicon(n.url) || '';
      const bInitials = (n.source || '').substring(0, 2).toUpperCase();
      return `
        <div class="brief-card${isRead ? ' read' : ''}" data-id="${n.id}" data-url="${hasUrl ? escapeHtml(n.url) : ''}" data-cat="${cat}" tabindex="0" role="button" aria-label="${escapeHtml(n.title)}">
          ${imgSrc ? `
          <div class="brief-card-thumb">
            <img src="${escapeHtml(imgSrc)}" alt="" data-seed="${escapeHtml(n.id)}" loading="lazy" onload="${IMG_ONLOAD}" onerror="${IMG_ONERROR}">
          </div>` : `
          <div class="brief-card-visual ${'cat-' + cat}">
            <div class="brief-visual-bg">${escapeHtml(CAT_LABEL[cat] || cat).toUpperCase()}</div>
            <div class="brief-visual-source">
              ${bFavicon ? `<img class="source-logo-sm" src="${bFavicon}" alt="" onerror="this.style.display='none';">` : `<span class="source-initials-sm">${escapeHtml(bInitials)}</span>`}
              <span class="brief-visual-source-name">${escapeHtml(n.source)}</span>
            </div>
          </div>`}
          <div class="brief-card-content">
            <div class="brief-card-head">
              <span class="meta-pill ${'cat-' + cat}">${escapeHtml(CAT_LABEL[cat] || cat)}</span>
              <span class="meta-source">${escapeHtml(n.source)}</span>
              <span class="meta-time">${escapeHtml(fmtRelative(n.publishedAt))}${isFresh(n.publishedAt) ? '<span class="fresh-dot" aria-label="新着">●</span>' : ''}</span>
            </div>
            <div class="brief-card-title">${escapeHtml(n.title)}</div>
            <div class="brief-card-summary">${escapeHtml(n.summary)}</div>
            ${n.whyItMatters ? `<div class="brief-card-impact">⚡ ${escapeHtml(n.whyItMatters)}</div>` : ''}
            ${n.actionItem ? `<div class="brief-card-action">→ ${escapeHtml(n.actionItem)}</div>` : ''}
            ${hasDetail || (n.tags && n.tags.length) ? `
            <details class="intel-details brief">
              <summary class="intel-toggle">▼ 詳しく読む</summary>
              <div class="intel-body">
                ${n.whyItMatters ? `<div class="intel-block impact"><div class="intel-label"><span class="intel-step">1</span>なぜ重要か</div><div class="intel-text">${escapeHtml(n.whyItMatters)}</div></div>` : ''}
                ${n.actionItem ? `<div class="intel-block action"><div class="intel-label"><span class="intel-step">2</span>何をすべきか</div><div class="intel-text">${escapeHtml(n.actionItem)}</div></div>` : ''}
                ${n.pickerComment ? `<div class="picker-comment"><span class="picker-icon">💡</span><div class="picker-content"><div class="picker-label"><span class="intel-step light">3</span>専門家の視点</div><div class="picker-text">${escapeHtml(n.pickerComment)}</div></div></div>` : ''}
                ${(n.tags && n.tags.length) ? `<div class="intel-tags">${n.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                ${hasUrl ? `<a class="intel-source-link" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">元記事を読む（${escapeHtml(n.source)}） →</a>` : ''}
              </div>
            </details>` : ''}
            <div class="brief-card-foot">
              <button class="brief-read-toggle" data-read-id="${n.id}">${isRead ? '↩ 未読' : '✓ 既読'}</button>
              <button class="star-btn${isFav ? ' starred' : ''}" data-fav="${n.id}" aria-label="お気に入り" aria-pressed="${isFav}">★</button>
              ${hasUrl ? `<button class="share-btn" data-share-title="${escapeHtml(n.title)}" data-share-url="${escapeHtml(n.url)}" aria-label="共有">↗</button>` : ''}
              ${hasUrl ? `<a class="brief-ext-link" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">元記事 →</a>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
    root.querySelectorAll('.brief-card').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.star-btn') || e.target.closest('.brief-ext-link') || e.target.closest('.brief-read-toggle')) return;
        markRead(el.dataset.id, el);
        if (el.dataset.cat) recordClick(el.dataset.cat);
        openExternal(el.dataset.url);
      });
    });
    root.querySelectorAll('.brief-read-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.readId;
        const card = btn.closest('.brief-card');
        toggleRead(id, card);
        btn.textContent = state.read.has(id) ? '↩ 未読' : '✓ 既読';
      });
    });
    root.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); toggleFav(btn.dataset.fav, btn); });
    });
    root.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        shareArticle(btn.dataset.shareTitle, btn.dataset.shareUrl);
      });
    });
  }

  function renderTabs(fyi) {
    const root = document.getElementById('tabs');
    root.innerHTML = CATEGORIES.map(c => {
      const count = c.key === 'all' ? fyi.length : fyi.filter(n => n.category === c.key).length;
      const active = c.key === state.activeCat ? ' active' : '';
      return `<button class="tab${active}" role="tab" data-cat="${c.key}" aria-selected="${c.key === state.activeCat}">
        ${escapeHtml(c.label)}<span class="tab-count">${count}</span>
      </button>`;
    }).join('');
    root.querySelectorAll('.tab').forEach(el => {
      el.addEventListener('click', () => {
        state.activeCat = el.dataset.cat;
        savePrefs();
        renderTabs(fyi);
        renderMore(fyi);
      });
    });
  }

  function renderMore(allMore) {
    const root = document.getElementById('more-list');
    const kw = state.keyword.trim().toLowerCase();
    const items = allMore.filter(n => {
      if (state.activeCat !== 'all' && n.category !== state.activeCat) return false;
      if (state.favOnly && !state.fav.has(n.id)) return false;
      if (state.unreadOnly && state.read.has(n.id)) return false;
      if (kw) {
        const hay = (n.title + ' ' + n.summary + ' ' + (n.tags||[]).join(' ') + ' ' + n.source).toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
    // パーソナライズ: カテゴリフィルタがallの場合、閲覧傾向で並び替え
    const sorted = state.activeCat === 'all' ? getPersonalizedOrder(items) : items;
    if (!sorted.length) {
      root.innerHTML = '<div class="empty" style="border:none;"><div class="empty-icon">📭</div><div class="empty-text">条件に一致するニュースがありません</div></div>';
      return;
    }
    root.innerHTML = sorted.map(n => {
      const isRead = state.read.has(n.id);
      const isFav = state.fav.has(n.id);
      const cat = n.category;
      const hasUrl = !!n.url;
      const imgSrc = pickImage(n);
      const fFavicon = sourceFavicon(n.url) || '';
      const fInitials = (n.source || '').substring(0, 2).toUpperCase();
      return `
        <article class="fyi-card${isRead ? ' read' : ''}" data-id="${n.id}" data-url="${hasUrl ? escapeHtml(n.url) : ''}" data-cat="${cat}" tabindex="0" role="button" aria-label="${escapeHtml(n.title)}">
          ${imgSrc ? `<div class="fyi-thumb"><img src="${escapeHtml(imgSrc)}" alt="" data-seed="${escapeHtml(n.id)}" loading="lazy" onload="${IMG_ONLOAD}" onerror="${IMG_ONERROR}"></div>` : `<div class="fyi-visual ${'cat-' + cat}">${fFavicon ? `<img class="source-logo-xs" src="${fFavicon}" alt="" onerror="this.style.display='none';">` : `<span class="source-initials-xs">${escapeHtml(fInitials)}</span>`}</div>`}
          <div class="fyi-body">
            <div class="fyi-meta">
              <span class="meta-pill ${'cat-' + cat}">${escapeHtml(CAT_LABEL[cat] || cat)}</span>
              <span class="meta-source">${escapeHtml(n.source)}</span>
              <span class="meta-time">${escapeHtml(fmtRelative(n.publishedAt))}${isFresh(n.publishedAt) ? '<span class="fresh-dot" aria-label="新着">●</span>' : ''}</span>
            </div>
            <div class="fyi-title">${escapeHtml(n.title)}</div>
            ${n.whyItMatters ? `<div class="fyi-why">${escapeHtml(n.whyItMatters)}</div>` : (n.summary ? `<div class="fyi-why">${escapeHtml(n.summary)}</div>` : '')}
            ${n.actionItem ? `<div class="fyi-action">→ ${escapeHtml(n.actionItem)}</div>` : ''}
            <div class="fyi-foot">
              <div class="fyi-tags">${(n.tags||[]).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>
              <div style="display:flex;align-items:center;gap:8px;">
                <button class="brief-read-toggle" data-read-id="${n.id}">${isRead ? '↩ 未読' : '✓ 既読'}</button>
                <button class="star-btn${isFav ? ' starred' : ''}" data-fav="${n.id}" aria-label="お気に入り">★</button>
                ${hasUrl ? `<a class="brief-ext-link" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">元記事 →</a>` : ''}
              </div>
            </div>
          </div>
        </article>`;
    }).join('');
    root.querySelectorAll('.fyi-card').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.star-btn') || e.target.closest('.brief-read-toggle') || e.target.closest('.brief-ext-link')) return;
        markRead(el.dataset.id, el);
        if (el.dataset.cat) recordClick(el.dataset.cat);
        openExternal(el.dataset.url);
      });
    });
    root.querySelectorAll('.brief-read-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.readId;
        const item = btn.closest('.fyi-card');
        toggleRead(id, item);
        btn.textContent = state.read.has(id) ? '↩ 未読' : '✓ 既読';
      });
    });
    root.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); toggleFav(btn.dataset.fav, btn); });
    });
  }

  function renderX() {
    const section = document.querySelector('.x-section');
    const sectionHead = section ? section.previousElementSibling : null; // sec-head
    const root = document.getElementById('x-grid');
    // 実ツイートURL がある投稿のみ表示（URL 無し = 本物のポストとして扱えない）
    const validItems = X_HIGHLIGHTS.filter(x => x && x.url && /^https?:\/\//.test(x.url));
    if (!validItems.length) {
      // Xハイライトが空なら section 自体を非表示（偽情報を出さない）
      if (section) section.style.display = 'none';
      if (sectionHead && sectionHead.classList && sectionHead.classList.contains('sec-head')) {
        sectionHead.style.display = 'none';
      }
      return;
    }
    if (section) section.style.display = '';
    if (sectionHead && sectionHead.classList && sectionHead.classList.contains('sec-head')) {
      sectionHead.style.display = '';
    }
    root.innerHTML = validItems.map(x => {
      const safeAvatar = safeImgUrl(x.avatar);
      const avatarHtml = safeAvatar
        ? `<img class="x-avatar" src="${escapeHtml(safeAvatar)}" alt="" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';">
           <span class="x-avatar-fallback" style="display:none;">${escapeHtml(x.author.charAt(0))}</span>`
        : `<span class="x-avatar-fallback">${escapeHtml(x.author.charAt(0))}</span>`;
      return `
      <a class="x-item linked" href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">
        <div class="x-head">
          ${avatarHtml}
          <div class="x-head-info">
            <span class="x-author">${escapeHtml(x.author)}</span>
            <span class="x-handle">${escapeHtml(x.handle)}</span>
          </div>
        </div>
        <div class="x-text">${escapeHtml(x.text)}</div>
        <div class="x-foot">
          <span class="x-foot-tag">${escapeHtml(x.tag)}</span>
          <span class="x-foot-link">↗ ポストを開く</span>
        </div>
      </a>`;
    }).join('');
  }

  /* ────────── ⑧ 配線 ──────────  */
  function wireUp(more) {
    const search = document.getElementById('search');
    const clearBtn = document.getElementById('search-clear');
    let t;
    function updateClearBtn() {
      if (clearBtn) clearBtn.hidden = !search.value;
    }
    updateClearBtn();
    search.addEventListener('input', () => {
      clearTimeout(t);
      updateClearBtn();
      t = setTimeout(() => { state.keyword = search.value; renderMore(more); }, 120);
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        search.value = '';
        state.keyword = '';
        updateClearBtn();
        renderMore(more);
        search.focus();
      });
    }
    const fav = document.getElementById('toggle-fav');
    if (fav) {
      // 永続化されたactive状態を復元
      fav.classList.toggle('active', state.favOnly);
      fav.setAttribute('aria-pressed', state.favOnly);
      fav.addEventListener('click', () => {
        state.favOnly = !state.favOnly;
        fav.classList.toggle('active', state.favOnly);
        fav.setAttribute('aria-pressed', state.favOnly);
        savePrefs();
        renderMore(more);
      });
    }
    const unread = document.getElementById('toggle-unread');
    if (unread) {
      unread.classList.toggle('active', state.unreadOnly);
      unread.setAttribute('aria-pressed', state.unreadOnly);
      unread.addEventListener('click', () => {
        state.unreadOnly = !state.unreadOnly;
        unread.classList.toggle('active', state.unreadOnly);
        unread.setAttribute('aria-pressed', state.unreadOnly);
        savePrefs();
        renderMore(more);
      });
    }
  }

  /* ────────── ⑨ データ取得（自動更新JSON → 失敗時シード） ──────────  */
  let dataMeta = { updatedAt: null, generatedFor: null };

  async function loadRemote() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch('./data/news.json', { cache: 'no-cache', signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json || !Array.isArray(json.items) || json.items.length === 0) {
        throw new Error('empty payload');
      }
      // 受信データで NEWS_DATA を置換
      // URL が無い記事も表示するが、UI 側で元記事ボタンは非表示にする（サンプル混入時の誤遷移を避ける）
      NEWS_DATA.length = 0;
      const VALID_URG = ['must_know', 'this_week', 'fyi'];
      for (const it of json.items) {
        const safeUrl = String(it.url || '').startsWith('http') ? String(it.url) : '';
        const imp = Number(it.importance) || 3;
        const urg = VALID_URG.includes(it.urgency) ? it.urgency
                  : imp === 1 ? 'must_know' : imp === 2 ? 'this_week' : 'fyi';
        NEWS_DATA.push({
          id: it.id || ('n_' + Math.random().toString(36).slice(2, 10)),
          importance: imp,
          readMin:    Number(it.readMin) || 1,
          title:      String(it.title || '').trim(),
          summary:    String(it.summary || '').trim(),
          whyItMatters: String(it.whyItMatters || '').trim(),
          actionItem:   String(it.actionItem || '').trim(),
          pickerComment: String(it.pickerComment || '').trim(),
          urgency:    urg,
          source:     String(it.source || '').trim(),
          sourceType: it.sourceType || 'media',
          category:   ['marketing','market','ai'].includes(it.category) ? it.category : 'marketing',
          url:        safeUrl,
          image:      safeImgUrl(it.image) || null,
          publishedAt: it.publishedAt || new Date().toISOString(),
          tags: Array.isArray(it.tags) ? it.tags.map(String) : []
        });
      }
      if (NEWS_DATA.length === 0) throw new Error('no items with valid URL');
      // Executive Summary を更新
      if (Array.isArray(json.executiveSummary) && json.executiveSummary.length) {
        EXEC_SUMMARY = json.executiveSummary.map(String);
      }
      // X Highlights を更新（将来 scraper が収集した場合）
      if (Array.isArray(json.xHighlights) && json.xHighlights.length) {
        X_HIGHLIGHTS = json.xHighlights.map((x, i) => ({
          id: x.id || ('x_' + i),
          author: String(x.author || ''),
          handle: String(x.handle || ''),
          avatar: String(x.avatar || ''),
          text: String(x.text || ''),
          tag: String(x.tag || ''),
          url: String(x.url || '')
        }));
      }
      dataMeta = { updatedAt: json.updatedAt || null, generatedFor: json.generatedFor || null };
      return true;
    } catch (e) {
      console.info('[ai-news] using bundled seed data:', e.message);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  function applyMeta(isRemote) {
    // Brief 日付（generatedFor がなければシードのYのまま）
    const dateStr = dataMeta.generatedFor || Y;
    const el = document.getElementById('stat-date');
    if (el) el.textContent = fmtBriefDate(dateStr);

    // 日付表示（cmd-bar内）
    const upd = document.getElementById('cmd-updated');
    if (!upd) return;
    // URL が埋まっている記事の割合を計算（半分未満なら「サンプル」と表示）
    const withUrl = NEWS_DATA.filter(n => n.url && /^https?:\/\//.test(n.url)).length;
    const total = NEWS_DATA.length || 1;
    const isSample = (withUrl / total) < 0.5;
    if (isRemote && dataMeta.updatedAt && !isSample) {
      upd.textContent = fmtBriefDate(dataMeta.generatedFor || dataMeta.updatedAt);
      upd.classList.remove('seed');
    } else {
      upd.textContent = fmtBriefDate(dataMeta.generatedFor || Y) + '（サンプル）';
      upd.classList.add('seed');
    }
  }

  /* ────────── ⑨b 日付ナビゲーション ──────────  */
  let currentViewDate = null; // null = 最新（today）

  function fmtISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function shiftDate(days) {
    const base = currentViewDate ? new Date(currentViewDate + 'T00:00:00+09:00') : new Date();
    base.setDate(base.getDate() + days);
    const target = fmtISODate(base);
    const today = fmtISODate(new Date());
    if (target > today) return; // 未来には進めない
    loadArchive(target);
  }

  let _archiveLoading = false;
  async function loadArchive(dateStr) {
    if (_archiveLoading) return;
    _archiveLoading = true;
    try { await _loadArchiveInner(dateStr); } finally { _archiveLoading = false; }
  }
  async function _loadArchiveInner(dateStr) {
    const today = fmtISODate(new Date());
    const isToday = dateStr >= today;
    const btnToday = document.getElementById('btn-today');
    const btnNext = document.getElementById('btn-next-date');

    if (isToday) {
      // 最新に戻す
      currentViewDate = null;
      if (btnToday) btnToday.style.display = 'none';
      if (btnNext) btnNext.disabled = true;
      const isRemote = await loadRemote();
      renderHero();
      applyMeta(isRemote);
      fullRender();
      renderX();
      rewireMore();
      return;
    }

    currentViewDate = dateStr;
    if (btnToday) btnToday.style.display = '';
    if (btnNext) btnNext.disabled = false;

    try {
      const res = await fetch(`./data/archives/${dateStr}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json || !Array.isArray(json.items) || json.items.length === 0) {
        throw new Error('empty');
      }
      // NEWS_DATA を置換（URLが無い記事は除外して信憑性を担保）
      NEWS_DATA.length = 0;
      const VALID_URG = ['must_know', 'this_week', 'fyi'];
      for (const it of json.items) {
        const safeUrl = String(it.url || '').startsWith('http') ? String(it.url) : '';
        if (!safeUrl) continue;
        const imp = Number(it.importance) || 3;
        const urg = VALID_URG.includes(it.urgency) ? it.urgency
                  : imp === 1 ? 'must_know' : imp === 2 ? 'this_week' : 'fyi';
        NEWS_DATA.push({
          id: it.id || ('n_' + Math.random().toString(36).slice(2, 10)),
          importance: imp, readMin: Number(it.readMin) || 1,
          title: String(it.title || '').trim(), summary: String(it.summary || '').trim(),
          whyItMatters: String(it.whyItMatters || '').trim(),
          actionItem: String(it.actionItem || '').trim(),
          pickerComment: String(it.pickerComment || '').trim(), urgency: urg,
          source: String(it.source || '').trim(), sourceType: it.sourceType || 'media',
          category: ['marketing','market','ai'].includes(it.category) ? it.category : 'marketing',
          url: safeUrl, image: it.image || null,
          publishedAt: it.publishedAt || new Date().toISOString(),
          tags: Array.isArray(it.tags) ? it.tags.map(String) : []
        });
      }
      if (NEWS_DATA.length === 0) throw new Error('no items with valid URL');
      if (Array.isArray(json.executiveSummary) && json.executiveSummary.length) {
        EXEC_SUMMARY = json.executiveSummary.map(String);
      }
      dataMeta = { updatedAt: json.updatedAt || null, generatedFor: json.generatedFor || dateStr };
      renderHero();
      applyMeta(true);
      fullRender();
      renderX();
      rewireMore();
    } catch (e) {
      // アーカイブが見つからない場合
      const upd = document.getElementById('cmd-updated');
      if (upd) {
        upd.textContent = `${fmtBriefDate(dateStr)} — データなし`;
        upd.classList.add('seed');
      }
    }
  }

  function wireDateNav() {
    const prev = document.getElementById('btn-prev-date');
    const next = document.getElementById('btn-next-date');
    const today = document.getElementById('btn-today');
    if (prev) prev.addEventListener('click', () => shiftDate(-1));
    if (next) {
      next.addEventListener('click', () => shiftDate(1));
      next.disabled = true; // 初期状態は最新なので翌日は無効
    }
    if (today) today.addEventListener('click', () => loadArchive(fmtISODate(new Date())));
  }

  /* ────────── ⑩ 進捗 / 全部既読 / 次の未読 ──────────  */
  function getNavItems() {
    return Array.from(document.querySelectorAll('[data-id][tabindex]'));
  }
  function updateProgress() {
    // 母数は NEWS_DATA 全件（MORE のフィルタで分母が変動しないように）
    const total = NEWS_DATA.length;
    const read  = NEWS_DATA.filter(n => state.read.has(n.id)).length;
    const unread = total - read;
    const txt = document.getElementById('progress-read');
    const tot = document.getElementById('progress-total');
    const fill = document.getElementById('progress-fill');
    if (txt) txt.textContent = read;
    if (tot) tot.textContent = total;
    const pct = total ? (read / total * 100) : 0;
    if (fill) fill.style.width = pct + '%';
    // ヒーローの既読進捗も同期
    const heroProg = document.getElementById('stat-read-progress');
    const heroFill = document.getElementById('hero-progress-fill');
    if (heroProg) heroProg.textContent = `${read}/${total}`;
    if (heroFill) heroFill.style.width = pct + '%';
    // 「次の未読」ボタンに残り数を表示
    const btnNext = document.getElementById('btn-next-unread');
    if (btnNext) {
      btnNext.textContent = unread > 0 ? `↓ 未読 ${unread}` : '✓ 全て読了';
      btnNext.disabled = unread === 0;
    }
    const btnAll = document.getElementById('btn-all-read');
    if (btnAll) btnAll.disabled = unread === 0;
  }
  function jumpToNextUnread() {
    const items = getNavItems();
    const target = items.find(el => !state.read.has(el.dataset.id));
    if (!target) {
      // 全件既読
      const upd = document.getElementById('cmd-updated');
      if (upd) {
        const orig = upd.textContent;
        upd.textContent = '🎉 全て読了';
        setTimeout(() => { upd.textContent = orig; }, 1800);
      }
      return;
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function markAllRead() {
    NEWS_DATA.forEach(n => state.read.add(n.id));
    saveSet(STORE_KEY_READ, state.read);
    document.querySelectorAll('[data-id][tabindex]')
      .forEach(el => el.classList.add('read'));
    updateProgress();
  }
  function moveFocus(dir) {
    const items = getNavItems();
    if (!items.length) return;
    const cur = document.activeElement;
    const idx = items.indexOf(cur);
    let next;
    if (idx === -1) next = dir > 0 ? items[0] : items[items.length - 1];
    else next = items[Math.min(items.length - 1, Math.max(0, idx + dir))];
    if (next) {
      next.focus({ preventScroll: true });
      next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  function toggleFavOnFocused() {
    const cur = document.activeElement;
    if (!cur || !cur.dataset || !cur.dataset.id) return;
    const btn = cur.querySelector('.star-btn');
    toggleFav(cur.dataset.id, btn);
  }
  function openFocused() {
    const cur = document.activeElement;
    if (!cur || !cur.dataset || !cur.dataset.url) return;
    markRead(cur.dataset.id, cur);
    openExternal(cur.dataset.url);
  }

  /* ────────── ⑪ キーボードショートカット ──────────  */
  function isTypingTarget(t) {
    if (!t) return false;
    const tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
  }
  function showHelp(show) {
    const m = document.getElementById('kbd-modal');
    if (!m) return;
    if (show) m.removeAttribute('hidden'); else m.setAttribute('hidden', '');
  }
  function wireKeyboard() {
    document.addEventListener('keydown', e => {
      // モーダル: Escで閉じる
      const modal = document.getElementById('kbd-modal');
      const modalOpen = modal && !modal.hasAttribute('hidden');
      if (modalOpen && (e.key === 'Escape' || e.key === '?')) {
        e.preventDefault();
        showHelp(false);
        return;
      }
      // 入力欄ではショートカット無効（Escでblurだけ許可）
      if (isTypingTarget(e.target)) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      switch (e.key) {
        case '/':
          e.preventDefault();
          const s = document.getElementById('search');
          if (s) { s.focus(); s.select(); }
          break;
        case 'j': e.preventDefault(); moveFocus(1); break;
        case 'k': e.preventDefault(); moveFocus(-1); break;
        case 'Enter': openFocused(); break;
        case 'f': toggleFavOnFocused(); break;
        case 'n': e.preventDefault(); jumpToNextUnread(); break;
        case 'm': e.preventDefault(); markAllRead(); showToast('全記事を既読にしました'); break;
        case '?': e.preventDefault(); showHelp(true); break;
      }
    });
    const help = document.getElementById('btn-help');
    if (help) help.addEventListener('click', () => showHelp(true));
    const close = document.getElementById('kbd-close');
    if (close) close.addEventListener('click', () => showHelp(false));
    const modal = document.getElementById('kbd-modal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) showHelp(false); });
  }

  /* ────────── ⑪b 音声ダイジェスト（AI要約 → TTS読み上げ） ──────────  */
  const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2];
  const DEFAULT_SPEED = 1.25;
  const STORE_KEY_SPEED = 'ai-news:speed:v2';
  function loadSpeed() {
    const v = parseFloat(localStorage.getItem(STORE_KEY_SPEED) || String(DEFAULT_SPEED));
    return SPEED_OPTIONS.includes(v) ? v : DEFAULT_SPEED;
  }
  let speechState = { playing: false, audio: null, speed: loadSpeed() };
  function setSpeed(v) {
    const next = SPEED_OPTIONS.includes(v) ? v : DEFAULT_SPEED;
    speechState.speed = next;
    try { localStorage.setItem(STORE_KEY_SPEED, String(next)); } catch {}
    if (speechState.audio) speechState.audio.playbackRate = next;
    const sel = document.getElementById('speed-select');
    if (sel && sel.value !== String(next)) sel.value = String(next);
  }

  function buildArticlePayload() {
    const { mustKnow, thisWeek } = partition();
    return {
      execSummary: EXEC_SUMMARY,
      mustKnow: mustKnow.map(n => ({
        title: n.title, summary: n.summary,
        whyItMatters: n.whyItMatters, actionItem: n.actionItem
      })),
      thisWeek: thisWeek.map(n => ({
        title: n.title, summary: n.summary, actionItem: n.actionItem
      }))
    };
  }

  // フォールバック用スクリプト（ラジオ番組構成、APIキーなしでも高品質）
  function buildFallbackScript() {
    const lines = [];
    const dateLabel = dataMeta.generatedFor || Y;
    const d = new Date(dateLabel + 'T00:00:00+09:00');
    const dateStr = isNaN(d) ? dateLabel : `${d.getMonth()+1}月${d.getDate()}日`;

    // 冒頭：挨拶 + 3つのポイント予告
    lines.push(`おはようございます。${dateStr}のマーケティング・ニュースダイジェストです。`);
    if (EXEC_SUMMARY.length >= 3) {
      lines.push('今日のポイントは3つ。');
      lines.push(`1つ目、${EXEC_SUMMARY[0]}`);
      lines.push(`2つ目、${EXEC_SUMMARY[1]}`);
      lines.push(`3つ目、${EXEC_SUMMARY[2]}`);
    } else if (EXEC_SUMMARY.length) {
      lines.push('今日のポイントです。');
      for (const s of EXEC_SUMMARY) lines.push(s);
    }

    lines.push('では、詳しく見ていきましょう。');

    // 本編：重要ニュース
    const { mustKnow, thisWeek } = partition();
    if (mustKnow.length) {
      lines.push('まず最も重要なニュースです。');
      mustKnow.forEach((n, i) => {
        if (i > 0) lines.push('続いて。');
        lines.push(`${n.title}。`);
        lines.push(n.summary);
        if (n.whyItMatters) lines.push(`これがなぜ重要かというと、${n.whyItMatters}`);
        if (n.actionItem) lines.push(`具体的には、${n.actionItem}`);
      });
    }

    // 本編：注目ニュース
    if (thisWeek.length) {
      lines.push('次に、チェックしておきたいニュースです。');
      for (const n of thisWeek) {
        lines.push(`${n.title}。`);
        lines.push(n.summary);
        if (n.actionItem) lines.push(`アクションとしては、${n.actionItem}`);
      }
    }

    // まとめ
    lines.push('最後にまとめです。');
    if (EXEC_SUMMARY.length >= 3) {
      const kw = EXEC_SUMMARY.map(s => {
        const m = s.match(/[「『]([^」』]+)[」』]/);
        return m ? m[1] : s.slice(0, 20);
      });
      lines.push(`今日押さえるべきは、${kw[0]}、${kw[1]}、${kw[2]}の3つです。`);
    }
    lines.push('今日も頑張りましょう。');
    return lines;
  }

  async function generateDigest() {
    try {
      const res = await fetch('/api/ai-news-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'digest', ...buildArticlePayload() }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.script || null;
    } catch { return null; }
  }

  function setBtnState(label, playing) {
    const btn = document.getElementById('btn-listen');
    if (!btn) return;
    // 新しいボタン構造（icon + label + meta）の label/meta を更新。古いテキストボタンとも互換。
    const iconEl = btn.querySelector('.audio-btn-icon');
    const labelEl = btn.querySelector('.audio-btn-label');
    const metaEl = btn.querySelector('.audio-btn-meta');
    if (iconEl && labelEl && metaEl) {
      // label のパース: "⏹ 残り 2:34" / "▶ 今日のダイジェスト（約5分 · 準備完了）" / "🔊 聴く（約5分）"
      if (playing) {
        iconEl.textContent = '■';
        labelEl.textContent = '停止';
        const m = label.match(/残り\s*([0-9:]+)/);
        metaEl.textContent = m ? `残り ${m[1]}` : label;
      } else if (/準備完了/.test(label)) {
        iconEl.textContent = '▶';
        labelEl.textContent = 'AI音声ダイジェスト';
        const m = label.match(/約(\d+)分/);
        metaEl.textContent = m ? `約${m[1]}分 · 準備完了` : '準備完了';
      } else if (/ダイジェスト生成中|音声変換中/.test(label)) {
        iconEl.textContent = '…';
        labelEl.textContent = '準備中';
        metaEl.textContent = '少々お待ちください';
      } else {
        iconEl.textContent = '▶';
        labelEl.textContent = 'AI音声ダイジェスト';
        const m = label.match(/約(\d+)分/);
        metaEl.textContent = m ? `約${m[1]}分` : '約5分';
      }
    } else {
      btn.textContent = label;
    }
    btn.classList.toggle('playing', playing);
  }

  /** ミニプレイヤーの表示/更新 */
  function fmtMMSS(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function showAudioPlayer() {
    const ap = document.getElementById('audio-player');
    if (ap) ap.removeAttribute('hidden');
  }
  function hideAudioPlayer() {
    const ap = document.getElementById('audio-player');
    if (ap) ap.setAttribute('hidden', '');
  }
  function updateAudioPlayer(audio) {
    if (!audio) return;
    const rate = audio.playbackRate || 1;
    const d = (audio.duration || 0) / rate;
    const c = (audio.currentTime || 0) / rate;
    const rem = Math.max(0, d - c);
    const elapsed = document.getElementById('ap-elapsed');
    const total = document.getElementById('ap-total');
    const remain = document.getElementById('ap-remain');
    const fill = document.getElementById('ap-progress-fill');
    if (elapsed) elapsed.textContent = fmtMMSS(c);
    if (total) total.textContent = fmtMMSS(d);
    if (remain) remain.textContent = fmtMMSS(rem);
    if (fill) fill.style.width = d > 0 ? (c / d * 100) + '%' : '0%';
  }

  async function tryOpenAITTS(text) {
    try {
      const res = await fetch('/api/ai-news-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tts', text: text.slice(0, 4800) }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch { return null; }
  }

  // ── 事前生成（バックグラウンドプリロード）──
  // アプリ起動時に自動的にダイジェスト＋音声を生成しておき、ユーザーがクリックしたら即再生
  let preloadPromise = null;
  let preloadedAudioUrl = null;
  let preloadedDigest = null;

  async function preloadDigestAudio() {
    if (preloadPromise) return preloadPromise;
    preloadPromise = (async () => {
      const digest = await generateDigest();
      if (!digest) return null;
      preloadedDigest = digest;
      const audioUrl = await tryOpenAITTS(digest);
      if (audioUrl) {
        preloadedAudioUrl = audioUrl;
        const btn = document.getElementById('btn-listen');
        if (btn && !speechState.playing) {
          const estMin = Math.ceil((preloadedDigest || '').length / 300);
          btn.textContent = `▶ 今日のダイジェスト（約${estMin}分 · 準備完了）`;
          btn.classList.add('ready');
        }
      }
      return audioUrl;
    })();
    return preloadPromise;
  }

  async function startSpeech() {
    stopSpeech();
    speechState.playing = true;

    if (preloadedAudioUrl) {
      const audio = new Audio(preloadedAudioUrl);
      speechState.audio = audio;
      audio.playbackRate = speechState.speed;
      setBtnState(`⏹ 再生中`, true);
      showAudioPlayer();
      audio.ontimeupdate = () => {
        if (!speechState.playing) return;
        updateAudioPlayer(audio);
        const d = audio.duration || 0;
        const c = audio.currentTime || 0;
        const remSec = Math.max(0, Math.ceil((d - c) / (audio.playbackRate || 1)));
        const btn = document.getElementById('btn-listen');
        if (btn) btn.textContent = `⏹ 残り ${fmtMMSS(remSec)}`;
      };
      audio.onended = () => stopSpeech();
      audio.onerror = () => { fallbackWebSpeech((preloadedDigest || '').split(/[。\n]+/).filter(Boolean)); };
      audio.play().catch(() => { fallbackWebSpeech((preloadedDigest || '').split(/[。\n]+/).filter(Boolean)); });
      return;
    }

    setBtnState('⏳ ダイジェスト生成中…', true);
    // プリロード進行中ならそれを待つ
    if (preloadPromise) {
      await preloadPromise;
      if (!speechState.playing) return;
      if (preloadedAudioUrl) return startSpeech();  // もう一度呼ぶと即再生ルートに入る
    }

    // まだ開始してない場合は即生成
    const digest = preloadedDigest || await generateDigest();
    if (!speechState.playing) return;

    if (digest) {
      setBtnState('⏳ 音声変換中…', true);
      const audioUrl = await tryOpenAITTS(digest);
      if (!speechState.playing) return;

      if (audioUrl) {
        preloadedAudioUrl = audioUrl;
        const audio = new Audio(audioUrl);
        speechState.audio = audio;
        audio.playbackRate = speechState.speed;
        setBtnState(`⏹ 再生中`, true);
        showAudioPlayer();
        audio.ontimeupdate = () => {
          if (!speechState.playing) return;
          updateAudioPlayer(audio);
          const d = audio.duration || 0;
          const c = audio.currentTime || 0;
          const remSec = Math.max(0, Math.ceil((d - c) / (audio.playbackRate || 1)));
          const btn = document.getElementById('btn-listen');
          if (btn) btn.textContent = `⏹ 残り ${fmtMMSS(remSec)}`;
        };
        audio.onended = () => stopSpeech();
        audio.onerror = () => { fallbackWebSpeech(digest.split(/[。\n]+/).filter(Boolean)); };
        audio.play().catch(() => { fallbackWebSpeech(digest.split(/[。\n]+/).filter(Boolean)); });
        return;
      }
      fallbackWebSpeech(digest.split(/[。\n]+/).filter(Boolean));
    } else {
      fallbackWebSpeech(buildFallbackScript());
    }
  }

  function findBestJapaneseVoice() {
    const voices = window.speechSynthesis.getVoices();
    const jaVoices = voices.filter(v => v.lang.startsWith('ja'));
    const preferred = ['Google 日本語', 'Microsoft Nanami', 'Kyoko', 'O-Ren', 'Hattori'];
    for (const name of preferred) {
      const v = jaVoices.find(jv => jv.name.includes(name));
      if (v) return v;
    }
    return jaVoices[0] || null;
  }

  function fallbackWebSpeech(lines) {
    if (!('speechSynthesis' in window) || !speechState.playing) { stopSpeech(); return; }
    const estMin = Math.ceil(lines.join('').length / 300);
    setBtnState(`⏹ 停止（約${estMin}分）`, true);
    let idx = 0;
    const voice = findBestJapaneseVoice();
    function speakNext() {
      if (idx >= lines.length || !speechState.playing) { stopSpeech(); return; }
      const u = new SpeechSynthesisUtterance(lines[idx++]);
      u.lang = 'ja-JP';
      u.rate = 0.95 * (speechState.speed || 1);
      u.pitch = 1.05;
      if (voice) u.voice = voice;
      u.onend = speakNext;
      u.onerror = speakNext;
      window.speechSynthesis.speak(u);
    }
    speakNext();
  }

  function stopSpeech() {
    speechState.playing = false;
    if (speechState.audio) {
      speechState.audio.pause();
      speechState.audio = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    hideAudioPlayer();
    const estMin = preloadedDigest ? Math.ceil(preloadedDigest.length / 300) : 5;
    setBtnState(`🔊 聴く（約${estMin}分）`, false);
  }

  function wireSpeech() {
    const btn = document.getElementById('btn-listen');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (speechState.playing) stopSpeech();
      else startSpeech();
    });
    const speedSelect = document.getElementById('speed-select');
    if (speedSelect) {
      speedSelect.value = String(speechState.speed);
      speedSelect.addEventListener('change', e => setSpeed(parseFloat(e.target.value)));
    }
    // ミニプレイヤー停止ボタン
    const apStop = document.getElementById('ap-stop');
    if (apStop) apStop.addEventListener('click', () => stopSpeech());
    // 起動時にバックグラウンドで音声を事前生成（ネットワーク待機なしで即再生できる）
    // ユーザー操作をブロックしないよう requestIdleCallback / setTimeout で遅延実行
    const kickoff = () => { preloadDigestAudio().catch(() => {}); };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(kickoff, { timeout: 3000 });
    } else {
      setTimeout(kickoff, 1500);
    }
  }

  /* ────────── ⑪c パーソナライズ（閲覧傾向ベース） ──────────  */
  const STORE_KEY_CLICKS = 'ai-news:clicks:v1';

  function loadClickHistory() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY_CLICKS) || '{}'); }
    catch { return {}; }
  }
  function recordClick(category) {
    const hist = loadClickHistory();
    hist[category] = (hist[category] || 0) + 1;
    try { localStorage.setItem(STORE_KEY_CLICKS, JSON.stringify(hist)); } catch {}
  }
  function getPersonalizedOrder(items) {
    const hist = loadClickHistory();
    const total = Object.values(hist).reduce((a, b) => a + b, 0);
    if (total < 5) return items; // 5クリック未満はパーソナライズしない
    return [...items].sort((a, b) => {
      const sa = hist[a.category] || 0;
      const sb = hist[b.category] || 0;
      if (sb !== sa) return sb - sa; // よく読むカテゴリを上に
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });
  }

  /* ────────── ⑪d スワイプ（モバイルカードナビ） ──────────  */
  function wireSwipe() {
    let startX = 0, startY = 0;
    const shell = document.querySelector('.news-shell');
    if (!shell) return;
    shell.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    shell.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      // 横スワイプが十分大きく、縦スクロールより横が大きい場合のみ
      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) {
          // 左スワイプ → 翌日
          shiftDate(1);
        } else {
          // 右スワイプ → 前日
          shiftDate(-1);
        }
      }
    }, { passive: true });
  }

  /* ────────── ⑪e クイックアクションボタン ──────────  */
  function wireQuickActions() {
    const btnNext = document.getElementById('btn-next-unread');
    if (btnNext) btnNext.addEventListener('click', jumpToNextUnread);
    const btnAll = document.getElementById('btn-all-read');
    if (btnAll) btnAll.addEventListener('click', () => {
      markAllRead();
      showToast('全記事を既読にしました');
    });
  }

  /* ────────── ⑫ 起動 ──────────
     方針: ファーストペイント最優先。
     1) まずシードデータで即座にrender（fetch完了を待たない）
     2) バックグラウンドで loadRemote()
     3) 成功したら NEWS_DATA を上書きしてリストだけ再render（ヒーロー/Xはそのまま）
  ────────────────────────────  */
  let _moreRef = []; // wireUp が掴む fyi 配列の最新参照（再renderで差し替える）

  function fullRender() {
    const { mustKnow, thisWeek, fyi } = partition();
    _moreRef = fyi;
    renderExecSummary();
    renderTrends();
    renderMustKnow(mustKnow);
    renderThisWeek(thisWeek);
    renderTabs(fyi);
    renderMore(fyi);
    updateProgress();
    // 各セクション見出しに件数バッジを設定（初期は 0、初めて見えた時にカウントアップ）
    setCountTarget('count-must-know', mustKnow.length);
    setCountTarget('count-this-week', thisWeek.length);
    setCountTarget('count-more', fyi.length);
  }

  // セクションが見えたらカウントアップする
  const _countState = new Map(); // id → { target, animated }
  let _countObserver = null;
  function setCountTarget(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = _countState.get(id);
    if (prev && prev.target === target) return;
    _countState.set(id, { target, animated: false });
    el.textContent = '0';
    if (!('IntersectionObserver' in window)) { el.textContent = target; return; }
    if (!_countObserver) {
      _countObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const head = entry.target;
          const countEl = head.querySelector('.sec-count');
          if (!countEl) return;
          const state = _countState.get(countEl.id);
          if (!state || state.animated) return;
          state.animated = true;
          animateCount(countEl, state.target, '');
          _countObserver.unobserve(head);
        });
      }, { threshold: 0.4 });
    }
    const head = el.closest('.sec-head');
    if (head) _countObserver.observe(head);
  }

  async function init() {
    // ── 1. シードデータで即時パーティション + render（ブロックなし） ──
    renderHero();
    applyMeta(false);   // とりあえず「シードデータ表示中」
    fullRender();
    renderX();
    wireUp(_moreRef);
    wireKeyboard();
    wireDateNav();
    wireSpeech();
    wireSwipe();
    wireQuickActions();

    // ── 2. バックグラウンドで実データ取得（最大8秒） ──
    // ローディング表示をセット
    const upd = document.getElementById('cmd-updated');
    // ローディング表示は出さない（バックグラウンドで取得）
    const isRemote = await loadRemote();
    if (isRemote) {
      renderHero();
      applyMeta(true);
      fullRender();
      renderX();
      rewireMore();
    }
    // OGP画像をバックグラウンドで取得（URLがある記事のみ）
    enrichOgpImages().catch(() => {});
  }
  function rewireMore() {
    // wireUp 内で more を closure キャプチャしているため、検索/★絞り込みも最新リストで再評価できるよう
    // ハンドラを掛け直す。重複を避けるためノードごと差し替え。
    const oldSearch = document.getElementById('search');
    if (oldSearch) {
      const ns = oldSearch.cloneNode(true);
      oldSearch.parentNode.replaceChild(ns, oldSearch);
    }
    const oldFav = document.getElementById('toggle-fav');
    if (oldFav) {
      const nf = oldFav.cloneNode(true);
      oldFav.parentNode.replaceChild(nf, oldFav);
    }
    wireUp(_moreRef);
  }
  /* ────────── ⑫b セクションナビ（PC ≥1280px） ──────────  */
  function wireSectionNav() {
    const nav = document.getElementById('section-nav');
    if (!nav) return;
    const mql = window.matchMedia('(min-width: 1280px)');
    function updateVisibility() {
      if (mql.matches) nav.removeAttribute('hidden');
      else nav.setAttribute('hidden', '');
    }
    updateVisibility();
    mql.addEventListener?.('change', updateVisibility);

    const items = nav.querySelectorAll('.sn-item');
    // スムーススクロール（視差効果オフの環境は瞬間スクロール）
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    items.forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const id = a.dataset.target;
        const el = document.getElementById(id);
        if (!el) return;
        const y = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: prefersReduced ? 'auto' : 'smooth' });
      });
    });

    // IntersectionObserver で active なセクションをハイライト
    const targets = Array.from(items).map(a => document.getElementById(a.dataset.target)).filter(Boolean);
    if ('IntersectionObserver' in window && targets.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          items.forEach(a => a.classList.toggle('active', a.dataset.target === id));
        });
      }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
      targets.forEach(t => io.observe(t));
    }
  }

  /* ────────── ⑬ スクロール進捗 + トップへ戻る ──────────  */
  function wireScrollUI() {
    const progressBar = document.getElementById('scroll-progress');
    const backToTop = document.getElementById('back-to-top');
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? Math.min(scrollTop / docHeight * 100, 100) : 0;
        if (progressBar) progressBar.style.width = pct + '%';
        if (backToTop) backToTop.classList.toggle('visible', scrollTop > 600);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    if (backToTop) {
      backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); wireScrollUI(); wireSectionNav(); });
  } else {
    init();
    wireScrollUI();
    wireSectionNav();
  }
})();
