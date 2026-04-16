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
  */
  const TODAY = '2026-04-15';
  const Y     = '2026-04-14';

  /* ── Executive Summary（シードデータ） ── */
  let EXEC_SUMMARY = [
    '企業の比較検討にChatGPTを使う人が7割超え → 自社サイトがAI検索で表示されるか確認が必要',
    '日本のネット広告費が初の4兆円超え。特に動画広告の伸びが大きく、予算配分を見直す材料に',
    'Salesforce等が「AIが自動で提案する」機能を続々発表 → 今使っているツールのAI機能をチェック'
  ];

  const NEWS_DATA = [
    {
      id: 'm3', importance: 1, readMin: 2, urgency: 'must_know',
      title: 'B2B購買行動調査2026：意思決定者の73%が「営業より先にAI検索を信頼」',
      summary: 'Gartner調査。B2B購買の比較段階で主要情報源としてChatGPT/Perplexityが営業資料・営業面談を上回った。回答者の73%が「営業と会う前にAI検索で候補を絞る」と回答。',
      whyItMatters: 'AKKODiSのサービスページがAI検索結果に出ていなければ、比較検討の土俵にすら乗れない。SEOとは別軸の対策が必要。',
      actionItem: '来週の定例で自社コンテンツのGEO対策（ChatGPT/Perplexityでの自社表示確認）を議題に入れる。',
      source: 'Gartner', sourceType: 'media', category: 'marketing',
      url: 'https://www.gartner.com/en/newsroom/press-releases/2026-04-16-b2b-buying-behavior-survey',
      publishedAt: `${Y}T09:10:00+09:00`,
      tags: ['B2B', 'GEO', '購買行動']
    },
    {
      id: 'a3', importance: 1, readMin: 2, urgency: 'must_know',
      title: 'Google検索の「AI Overviews」、すべての日本語クエリで標準ON化',
      summary: 'Google検索のAI Overviews（AI生成回答）が日本語クエリ全件で標準ON化。従来のオプトインから全面展開へ移行完了。',
      whyItMatters: '自然検索のCTRが20〜40%下落する可能性あり。AKKODiSの採用LP・サービスページへの流入減に直結する。早急にAI Overviewsでの引用状況を確認すべき。',
      actionItem: 'Search Consoleで主要キーワードのCTR変化をモニタリング開始。AI Overviewsに自社が表示されているか確認。',
      source: 'Google Search Central', sourceType: 'media', category: 'ai',
      url: 'https://developers.google.com/search/blog/2026/04/ai-overviews-japan-default',
      publishedAt: `${Y}T18:40:00+09:00`,
      tags: ['SEO', 'GEO', 'Google']
    },
    {
      id: 'mk2', importance: 2, readMin: 1, urgency: 'this_week',
      title: 'Salesforce、Slack＋AgentforceでCMO向け「収益AIエージェント」発表',
      summary: 'SalesforceがSlack統合のAIエージェント「Agentforce」をCMO向けに正式発表。案件・キャンペーンの優先度を自動再計算し予算配分まで提案。',
      whyItMatters: '現在のMA/CRM契約更新時に「AIエージェント搭載か否か」が選定基準になる。Salesforce利用中なら追加費用なしで使える可能性あり。',
      actionItem: '自社のSalesforce契約でAgentforce利用可否を営業担当に確認する。',
      source: 'Salesforce News', sourceType: 'media', category: 'market',
      url: 'https://www.salesforce.com/news/press-releases/2026/04/agentforce-cmo-revenue-agent/',
      publishedAt: `${Y}T14:45:00+09:00`,
      tags: ['SaaS', 'AIエージェント', 'CMO']
    },
    {
      id: 'a1', importance: 2, readMin: 1, urgency: 'this_week',
      title: 'Anthropic、Claude 4.6 Opusの長文タスク性能を公開（200kコンテキスト維持）',
      summary: 'Anthropic がClaude 4.6 Opusを発表。200kコンテキストで100ページ超の資料を一括処理可能。レポート作成時間が平均1/4に短縮との事例。',
      whyItMatters: '競合分析レポートや市場調査の工数が1/4になるなら、浮いた時間を施策立案に回せる。人材業界の競合レポートで試す価値あり。',
      actionItem: '今抱えているレポート業務で試用し、時間短縮効果を検証する。',
      source: 'Anthropic', sourceType: 'media', category: 'ai',
      url: 'https://www.anthropic.com/news/claude-4-6-opus-long-context',
      publishedAt: `${Y}T22:00:00+09:00`,
      tags: ['Claude', 'LLM', '要約']
    },
    {
      id: 'm1', importance: 2, readMin: 1, urgency: 'this_week',
      title: 'Google、Performance Max に「ブランド除外」レポート機能を正式追加',
      summary: 'Google Ads Performance Maxに「ブランド除外レポート」が正式追加。ブランドKW除外の効果が配信レポート上で個別に可視化可能に。',
      whyItMatters: 'PMax経由のCPAが高止まりしている場合、ブランドKW流入の混在が原因かもしれない。このレポートで切り分けて改善根拠を示せる。',
      actionItem: 'Google Ads管理画面でブランド除外レポートを確認し、月次レポートに追加。',
      source: 'Google Ads Help', sourceType: 'media', category: 'marketing',
      url: 'https://blog.google/products/ads-commerce/performance-max-brand-exclusion-report/',
      publishedAt: `${Y}T08:30:00+09:00`,
      tags: ['広告', 'PMax', 'Google']
    },
    {
      id: 'mk1', importance: 2, readMin: 1, urgency: 'this_week',
      title: '日本のデジタル広告費、初の4兆円突破（電通報告）',
      summary: '電通発表。2025年の日本デジタル広告費は4兆1,200億円（前年比+9.4%）。ネット広告がマス4媒体合計を再び大きく上回り、動画広告が成長を牽引。',
      whyItMatters: '「動画に予算を寄せたい」と社内提案する際の決定的エビデンス。人材業界でも採用動画・サービス紹介動画の優先度を上げる根拠になる。',
      actionItem: '次の予算策定で動画広告枠の比率増を提案する際のエビデンスとしてストック。',
      source: '電通', sourceType: 'media', category: 'market',
      url: 'https://www.dentsu.co.jp/news/release/2026/0416-digital-ad-spending/',
      publishedAt: `${Y}T10:00:00+09:00`,
      tags: ['広告費', '日本', '統計']
    },
    {
      id: 'mk3', importance: 2, readMin: 1, urgency: 'this_week',
      title: 'Cookieless時代のIDソリューション、UID2.0採用が前年比3倍に',
      summary: 'The Trade Desk主導のUnified ID 2.0が国内DSP/SSPでも標準対応に。採用数は前年比3倍。Chrome 3rdパーティクッキー段階廃止を見据えた動き。',
      whyItMatters: '現在のリターゲティング施策がクッキー依存なら、配信効率が半減するリスク。人材系のディスプレイ広告は特に影響大。',
      actionItem: '利用中のDSP/SSPがUID2.0対応済みか確認し、未対応なら代替を検討。',
      source: 'AdExchanger', sourceType: 'media', category: 'market',
      url: 'https://www.adexchanger.com/data-driven-thinking/uid2-adoption-triples-in-japan/',
      publishedAt: `${Y}T07:50:00+09:00`,
      tags: ['Cookieless', 'AdTech']
    },
    {
      id: 'm2', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'Marketo、生成AIによる「件名A/B自動最適化」を全プランで提供開始',
      summary: 'Marketo Engageが生成AIによる「件名A/B自動最適化」を全プランで提供開始。送信30分のオープン率を学習し残りセグメントに最適件名を自動配信。',
      whyItMatters: '設定をONにするだけでメール開封率+18%の可能性。ナーチャリング施策の費用対効果が設定変更だけで改善できる。',
      actionItem: 'Marketo利用中なら設定画面でAI件名最適化をONにして次回配信でテスト。',
      source: 'Adobe Marketo Engage', sourceType: 'media', category: 'marketing',
      url: 'https://business.adobe.com/blog/the-latest/marketo-ai-subject-line-optimization-all-plans',
      publishedAt: `${Y}T11:05:00+09:00`,
      tags: ['MA', 'メール', 'AI']
    },
    {
      id: 'a2', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'OpenAI、GPT-5系で「ブランドボイス制約」APIパラメータをβ提供',
      summary: 'OpenAIがGPT-5系で「ブランドボイス制約」APIパラメータをβ提供開始。トーン＆マナーからの逸脱を確率でブロックする機能。',
      whyItMatters: 'AI生成コンテンツで「AKKODiSのトーンと違う」事故を防げる。採用広報やメルマガでAIを使っているなら導入メリット大。',
      actionItem: 'AI活用のコンテンツ制作フローがある場合、β申請を検討。',
      source: 'OpenAI', sourceType: 'media', category: 'ai',
      url: 'https://openai.com/blog/gpt-5-brand-voice-constraint-api',
      publishedAt: `${Y}T20:15:00+09:00`,
      tags: ['GPT-5', 'API', 'ブランドガバナンス']
    },
    {
      id: 'm5', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'TikTok、Search Adsを日本含む新規10カ国へ拡大',
      summary: 'TikTokがSearch Ads（検索連動型広告）を日本含む新規10カ国で提供開始。検索結果画面に広告枠が新設される。',
      whyItMatters: '新卒・第二新卒の採用ターゲットはTikTok検索が定着済み。採用マーケでのリーチ手段が1つ増える。',
      actionItem: 'ターゲットにZ世代を含む場合、TikTok Search Adsのβ申請を検討。',
      source: 'TikTok for Business', sourceType: 'media', category: 'marketing',
      url: 'https://newsroom.tiktok.com/ja-jp/tiktok-search-ads-japan-launch',
      publishedAt: `${Y}T13:00:00+09:00`,
      tags: ['SNS', '検索広告']
    },
    {
      id: 'm4', importance: 3, readMin: 1, urgency: 'fyi',
      title: 'HubSpot、無料CRMに「会話インテリジェンス（録音文字起こし＋要約）」追加',
      summary: 'HubSpot無料CRMに「会話インテリジェンス」追加。Zoom/Google Meetの商談を自動文字起こし・要約しCRMに紐付け。月25時間まで無料。',
      whyItMatters: '商談で聞いた「お客様の課題」が自動でテキスト化される。コンテンツマーケのネタ出しや採用広報の声素材として転用できる。',
      actionItem: 'HubSpot利用中ならZoom連携をONにして、商談要約のコンテンツ活用を試す。',
      source: 'HubSpot', sourceType: 'media', category: 'marketing',
      url: 'https://blog.hubspot.com/news/free-crm-conversation-intelligence-launch',
      publishedAt: `${Y}T15:20:00+09:00`,
      tags: ['CRM', 'セールス']
    }
  ];

  /* ────────── ② Xハイライト（生成AIトレンド収集） ──────────
     目的: Xで話題の生成AI関連ポストを収集し、マーケ実務に活かせるトレンドを提示する。
     将来的にはX APIで自動収集。現在はシードデータ。
  */
  let X_HIGHLIGHTS = [
    {
      id: 'x1', author: '深津貴之', handle: '@fladdict',
      text: 'Claude Codeが本当にやばい。プロンプト1行で「設計→実装→テスト→デプロイ」まで全部やる。エンジニアの仕事の定義が変わりつつある。',
      tag: 'Claude Code', url: 'https://x.com/fladdict'
    },
    {
      id: 'x2', author: '安宅和人', handle: '@klozan',
      text: '生成AIで「知的生産のコスト」が限りなくゼロに近づく。差別化は「何を作るか」ではなく「何を問うか」に完全シフトした。',
      tag: 'AI戦略', url: 'https://x.com/klozan'
    },
    {
      id: 'x3', author: '松尾豊', handle: '@ymatsuo',
      text: '日本企業のAI導入率がようやく50%を超えた。だが「導入した」と「成果が出ている」の間には巨大なギャップがある。プロンプト教育だけでは不十分で、業務プロセス自体の再設計が必須。',
      tag: 'AI導入', url: 'https://x.com/ymatsuo'
    },
    {
      id: 'x4', author: '落合陽一', handle: '@ochyai',
      text: 'マルチモーダルAIの進化で「テキストだけのマーケティング」は確実に価値が下がる。画像・動画・音声を横断的に生成・最適化できるチームが勝つ。',
      tag: 'マルチモーダルAI', url: 'https://x.com/ochyai'
    },
    {
      id: 'x5', author: '成田悠輔', handle: '@naaboron',
      text: 'AIが「平均的な仕事」を代替するスピードが想定より速い。採用市場では「AIを使いこなせる人」のプレミアムが月単位で上がっている感覚。',
      tag: 'AI×採用', url: 'https://x.com/naaboron'
    },
    {
      id: 'x6', author: '梶谷健人', handle: '@kajiken0630',
      text: 'Claude CodeでLP制作を試したら、デザインからコーディングまで30分で完了した。マーケのABテスト用ページ量産に使える。非エンジニアでもここまでできる時代。',
      tag: 'Claude Code', url: 'https://x.com/kajiken0630'
    },
    {
      id: 'x7', author: '石角友愛', handle: '@TomoePalanoia',
      text: 'GoogleのGemini、OpenAIのGPT、AnthropicのClaude。3社の競争が激しすぎて毎週アップデートがある。企業のAI選定は「今ベストか」より「乗り換えやすいか」が重要になった。',
      tag: '生成AI比較', url: 'https://x.com/TomoePalanoia'
    },
    {
      id: 'x8', author: '田中邦裕', handle: '@kunihirotanaka',
      text: 'さくらインターネットのGPUクラウド、想定の3倍の申し込みが来ている。日本企業が自社でAIを動かしたい需要がここまで大きいとは。国産クラウドの出番。',
      tag: 'AI基盤', url: 'https://x.com/kunihirotanaka'
    },
    {
      id: 'x9', author: '緒方憲太郎', handle: '@ogatakentaro',
      text: 'Voicyでも生成AI音声の活用が始まっている。テキストを入れるだけで自然な日本語ナレーションが作れる。ポッドキャスト・動画ナレーションのコストが10分の1になる世界。',
      tag: 'AI音声', url: 'https://x.com/ogatakentaro'
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
  function totalReadTime(items) {
    return items.reduce((a, n) => a + (n.readMin || 1), 0);
  }
  function openExternal(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
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
    const label = '<span class="trend-label">トレンド</span>';
    const pills = trends.map(t =>
      `<button class="trend-pill" data-trend="${escapeHtml(t.tag)}">#${escapeHtml(t.tag)}<span class="trend-count">${t.count}</span></button>`
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
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });
    const mustKnow  = sorted.filter(n => n.urgency === 'must_know').slice(0, 2);
    const thisWeek  = sorted.filter(n => n.urgency === 'this_week').slice(0, 6);
    const usedIds   = new Set([...mustKnow.map(n => n.id), ...thisWeek.map(n => n.id)]);
    const fyi       = sorted.filter(n => !usedIds.has(n.id));
    return { mustKnow, thisWeek, fyi };
  }

  /* ────────── ⑦ レンダリング ──────────  */
  function renderHero() {
    const total = NEWS_DATA.length;
    const read  = totalReadTime(NEWS_DATA);
    document.getElementById('stat-date').textContent  = fmtBriefDate(Y);
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-read').textContent  = `${read}分`;
  }

  /* ── Executive Summary ── */
  function renderExecSummary() {
    const root = document.getElementById('exec-summary');
    if (!root) return;
    const lines = EXEC_SUMMARY;
    if (!lines || !lines.length) {
      root.innerHTML = '<div class="empty" style="border:none;"><div class="empty-text">サマリーはまだ生成されていません</div></div>';
      return;
    }
    root.innerHTML = lines.map(line =>
      `<div class="exec-line"><span class="exec-arrow">▸</span><span>${escapeHtml(line)}</span></div>`
    ).join('');
  }

  /* ── MUST-KNOW レンダリング ── */
  function renderMustKnow(items) {
    const root = document.getElementById('must-know');
    if (!items.length) {
      root.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">重要ニュースはありません</div></div>';
      return;
    }
    root.innerHTML = items.map(n => {
      const isRead = state.read.has(n.id);
      const isFav  = state.fav.has(n.id);
      const cat = n.category;
      return `
      <article class="top-card${isRead ? ' read' : ''}" data-id="${n.id}" data-url="${escapeHtml(n.url)}" tabindex="0" aria-label="${escapeHtml(n.title)}">
        <div class="top-meta">
          <span class="meta-pill ${'cat-' + cat}">${escapeHtml(CAT_LABEL[cat] || cat)}</span>
          <span class="meta-source">${escapeHtml(n.source)}</span>
          <span class="meta-time">${escapeHtml(fmtRelative(n.publishedAt))}</span>
        </div>
        <h2 class="top-title"><a class="top-title-link" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.title)}</a></h2>
        <p class="top-summary">${escapeHtml(n.summary)}</p>
        ${n.whyItMatters ? `<div class="intel-block impact"><div class="intel-label">マーケへの影響</div><div class="intel-text">${escapeHtml(n.whyItMatters)}</div></div>` : ''}
        ${n.actionItem ? `<div class="intel-block action"><div class="intel-label">💡 推奨アクション</div><div class="intel-text">${escapeHtml(n.actionItem)}</div></div>` : ''}
        <div class="top-foot">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${(n.tags||[]).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join(' ')}
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <button class="read-toggle" data-read-id="${n.id}" title="既読/未読を切替">${isRead ? '↩ 未読に戻す' : '✓ 既読にする'}</button>
            <button class="star-btn${isFav ? ' starred' : ''}" data-fav="${n.id}" aria-label="お気に入り" aria-pressed="${isFav}">★</button>
            <a class="ext-btn" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">元記事を読む →</a>
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
      return `
        <div class="brief-card${isRead ? ' read' : ''}" data-id="${n.id}" data-url="${escapeHtml(n.url)}" tabindex="0" role="button" aria-label="${escapeHtml(n.title)}">
          <div class="brief-card-head">
            <span class="brief-card-num">${String(i+1).padStart(2,'0')}</span>
            <span class="meta-pill ${'cat-' + cat}">${escapeHtml(CAT_LABEL[cat] || cat)}</span>
            <span class="meta-source">${escapeHtml(n.source)}</span>
            <span class="meta-time">${escapeHtml(fmtRelative(n.publishedAt))}</span>
          </div>
          <div class="brief-card-title">${escapeHtml(n.title)}</div>
          <div class="brief-card-summary">${escapeHtml(n.summary)}</div>
          ${n.whyItMatters ? `<div class="brief-card-impact">⚡ ${escapeHtml(n.whyItMatters)}</div>` : ''}
          ${n.actionItem ? `<div class="brief-card-action">→ ${escapeHtml(n.actionItem)}</div>` : ''}
          <div class="brief-card-foot">
            <div class="brief-card-tags">${(n.tags||[]).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button class="brief-read-toggle" data-read-id="${n.id}">${isRead ? '↩ 未読' : '✓ 既読'}</button>
              <button class="star-btn${isFav ? ' starred' : ''}" data-fav="${n.id}" aria-label="お気に入り" aria-pressed="${isFav}">★</button>
              <a class="brief-ext-link" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">元記事 →</a>
            </div>
          </div>
        </div>`;
    }).join('');
    root.querySelectorAll('.brief-card').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.star-btn') || e.target.closest('.brief-ext-link') || e.target.closest('.brief-read-toggle')) return;
        markRead(el.dataset.id, el);
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
    if (!items.length) {
      root.innerHTML = '<div class="empty" style="border:none;"><div class="empty-icon">📭</div><div class="empty-text">条件に一致するニュースがありません</div></div>';
      return;
    }
    root.innerHTML = items.map(n => {
      const isRead = state.read.has(n.id);
      const cat = n.category;
      return `
        <div class="more-item${isRead ? ' read' : ''}" data-id="${n.id}" data-url="${escapeHtml(n.url)}" tabindex="0" role="button" aria-label="${escapeHtml(n.title)}">
          <span class="more-cat ${'cat-' + cat}">${escapeHtml(CAT_LABEL[cat] || cat)}</span>
          <div class="more-title-wrap">
            <div class="more-title">${escapeHtml(n.title)}</div>
            <div class="more-summary">${escapeHtml(n.whyItMatters || n.summary)}</div>
          </div>
          <span class="more-source">${escapeHtml(n.source)}</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="brief-read-toggle" data-read-id="${n.id}">${isRead ? '↩' : '✓'}</button>
            <button class="star-btn${state.fav.has(n.id) ? ' starred' : ''}" data-fav="${n.id}" aria-label="お気に入り">★</button>
          </div>
        </div>`;
    }).join('');
    root.querySelectorAll('.more-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.star-btn') || e.target.closest('.brief-read-toggle')) return;
        markRead(el.dataset.id, el);
        openExternal(el.dataset.url);
      });
    });
    root.querySelectorAll('.brief-read-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.readId;
        const item = btn.closest('.more-item');
        toggleRead(id, item);
        btn.textContent = state.read.has(id) ? '↩' : '✓';
      });
    });
    root.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); toggleFav(btn.dataset.fav, btn); });
    });
  }

  function renderX() {
    const root = document.getElementById('x-grid');
    root.innerHTML = X_HIGHLIGHTS.map(x => `
      <a class="x-item" href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">
        <div class="x-head">
          <span class="x-author">${escapeHtml(x.author)}</span>
          <span class="x-handle">${escapeHtml(x.handle)}</span>
        </div>
        <div class="x-text">${escapeHtml(x.text)}</div>
        <div class="x-foot">
          <span class="x-foot-tag">${escapeHtml(x.tag)}</span>
          <span>↗ Xで開く</span>
        </div>
      </a>
    `).join('');
  }

  /* ────────── ⑧ 配線 ──────────  */
  function wireUp(more) {
    const search = document.getElementById('search');
    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.keyword = search.value; renderMore(more); }, 120);
    });
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
      NEWS_DATA.length = 0;
      const VALID_URG = ['must_know', 'this_week', 'fyi'];
      for (const it of json.items) {
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
          urgency:    urg,
          source:     String(it.source || '').trim(),
          sourceType: it.sourceType || 'media',
          category:   ['marketing','market','ai'].includes(it.category) ? it.category : 'marketing',
          url:        String(it.url || ''),
          publishedAt: it.publishedAt || new Date().toISOString(),
          tags: Array.isArray(it.tags) ? it.tags.map(String) : []
        });
      }
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
    if (isRemote && dataMeta.updatedAt) {
      upd.textContent = fmtBriefDate(dataMeta.generatedFor || dataMeta.updatedAt);
      upd.classList.remove('seed');
    } else {
      upd.textContent = fmtBriefDate(Y) + '（シードデータ）';
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

  async function loadArchive(dateStr) {
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
      // NEWS_DATA を置換
      NEWS_DATA.length = 0;
      const VALID_URG = ['must_know', 'this_week', 'fyi'];
      for (const it of json.items) {
        const imp = Number(it.importance) || 3;
        const urg = VALID_URG.includes(it.urgency) ? it.urgency
                  : imp === 1 ? 'must_know' : imp === 2 ? 'this_week' : 'fyi';
        NEWS_DATA.push({
          id: it.id || ('n_' + Math.random().toString(36).slice(2, 10)),
          importance: imp, readMin: Number(it.readMin) || 1,
          title: String(it.title || '').trim(), summary: String(it.summary || '').trim(),
          whyItMatters: String(it.whyItMatters || '').trim(),
          actionItem: String(it.actionItem || '').trim(), urgency: urg,
          source: String(it.source || '').trim(), sourceType: it.sourceType || 'media',
          category: ['marketing','market','ai'].includes(it.category) ? it.category : 'marketing',
          url: String(it.url || ''), publishedAt: it.publishedAt || new Date().toISOString(),
          tags: Array.isArray(it.tags) ? it.tags.map(String) : []
        });
      }
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
    const txt = document.getElementById('progress-read');
    const tot = document.getElementById('progress-total');
    const fill = document.getElementById('progress-fill');
    if (txt) txt.textContent = read;
    if (tot) tot.textContent = total;
    if (fill) fill.style.width = (total ? (read / total * 100) : 0) + '%';
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

    // ── 2. バックグラウンドで実データ取得（最大8秒） ──
    // ローディング表示をセット
    const upd = document.getElementById('cmd-updated');
    // ローディング表示は出さない（バックグラウンドで取得）
    const isRemote = await loadRemote();
    if (isRemote) {
      // ── 3. ヒーローの Brief 日付・Items・Read time を再計算 + リスト差し替え ──
      renderHero();
      applyMeta(true);
      fullRender();
      renderX();
      // wireUp が掴んでた more 参照を新しい _moreRef に置き換える
      rewireMore();
    }
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
