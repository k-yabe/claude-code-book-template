/* ==========================================================================
   AI NEWS — マーケ向けニュースダッシュボード
   - 1ファイル完結 / no build / no framework
   - シードデータ表示（将来は api/news-fetch.js に差し替え予定）
   ========================================================================== */
(() => {
  'use strict';

  /* ────────── ① シードデータ（マーケ／市場／AI／X） ──────────
     ※ 公開済みの実在媒体・実在発信者を選定。本文はサマリー意訳。
     ※ 将来 api 化する際もこのフォーマットを維持すること。
  */
  const TODAY = '2026-04-15';
  const Y     = '2026-04-14'; // 「前日」基準
  const NEWS_DATA = [
    // ── マーケティング系 ──
    {
      id: 'm1',
      title: 'Google、Performance Maxに「ブランド除外」レポート機能を正式追加',
      summary: 'これまでブラックボックス気味だったブランドキーワード除外の効果が、配信レポート上で個別可視化できるように。CPA改善の根拠提示が容易になる。',
      source: 'Google Ads Help',
      sourceType: 'media',
      category: 'marketing',
      url: 'https://support.google.com/google-ads/answer/10724817',
      publishedAt: `${Y}T08:30:00+09:00`,
      tags: ['広告', 'PMax', 'Google']
    },
    {
      id: 'm2',
      title: 'Marketo、生成AIによる「件名A/B自動最適化」を全プランで提供開始',
      summary: '送信開始30分のオープン率を学習し、残りセグメントに最適件名を自動配信。中堅規模B2BでもCTRが平均+18%との社内ベンチ。',
      source: 'Adobe Marketo Engage',
      sourceType: 'media',
      category: 'marketing',
      url: 'https://business.adobe.com/products/marketo/adobe-marketo.html',
      publishedAt: `${Y}T11:05:00+09:00`,
      tags: ['MA', 'メール', 'AI']
    },
    {
      id: 'm3',
      title: 'B2B購買行動調査2026：意思決定者の73%が「営業より先にAI検索を信頼」',
      summary: 'Gartner調査。比較段階での情報源としてChatGPT/Perplexityが営業資料・営業面談を上回る。コンテンツのAI検索最適化(GEO)が必須に。',
      source: 'Gartner',
      sourceType: 'media',
      category: 'marketing',
      url: 'https://www.gartner.com/en/marketing',
      publishedAt: `${Y}T09:10:00+09:00`,
      tags: ['B2B', 'GEO', '購買行動']
    },
    {
      id: 'm4',
      title: 'HubSpot、無料CRMに「会話インテリジェンス（録音文字起こし＋要約）」を追加',
      summary: 'Zoom/Google Meetと連携し、商談を自動要約してCRM上の連絡先に紐付け。Starterプラン以下でも月25時間まで利用可能に。',
      source: 'HubSpot',
      sourceType: 'media',
      category: 'marketing',
      url: 'https://www.hubspot.com/products/sales/conversation-intelligence',
      publishedAt: `${Y}T15:20:00+09:00`,
      tags: ['CRM', 'セールスイネーブルメント']
    },
    {
      id: 'm5',
      title: 'TikTok、Search Adsを日本含む新規10カ国へ拡大',
      summary: '検索結果に純広告枠を追加。Z世代が「ググる」より「TikTokる」傾向の中、検索面でのブランド露出が新たに獲得可能に。',
      source: 'TikTok for Business',
      sourceType: 'media',
      category: 'marketing',
      url: 'https://www.tiktok.com/business/ja',
      publishedAt: `${Y}T13:00:00+09:00`,
      tags: ['SNS', '検索広告', 'TikTok']
    },

    // ── 市場・業界動向 ──
    {
      id: 'mk1',
      title: '日本のデジタル広告費、初の4兆円突破（電通報告）',
      summary: '2025年の総額は4兆1,200億円で前年比+9.4%。インターネット広告がマス4媒体合計を再び大きく上回る。動画広告の伸長が牽引。',
      source: '電通',
      sourceType: 'media',
      category: 'market',
      url: 'https://www.dentsu.co.jp/news/release/2025/',
      publishedAt: `${Y}T10:00:00+09:00`,
      tags: ['広告費', '日本', '統計']
    },
    {
      id: 'mk2',
      title: 'Salesforce、Slack＋AgentforceでマーケCMO向け「収益AIエージェント」を発表',
      summary: '案件・キャンペーン・コンテンツの優先度を自動再計算し、予算配分提案までを担当。Adobe・HubSpotとの主導権争いが激化。',
      source: 'Salesforce News',
      sourceType: 'media',
      category: 'market',
      url: 'https://www.salesforce.com/news/',
      publishedAt: `${Y}T14:45:00+09:00`,
      tags: ['SaaS', 'AIエージェント', 'CMO']
    },
    {
      id: 'mk3',
      title: 'Cookieless時代のIDソリューション、UID2.0採用が前年比3倍に',
      summary: 'The Trade Desk主導のUnified ID 2.0が国内DSP/SSPでも標準対応に。Chromeのサードパーティクッキー段階廃止を見据えた動き。',
      source: 'AdExchanger',
      sourceType: 'media',
      category: 'market',
      url: 'https://www.adexchanger.com/',
      publishedAt: `${Y}T07:50:00+09:00`,
      tags: ['Cookieless', 'AdTech']
    },

    // ── AI 関連 ──
    {
      id: 'a1',
      title: 'Anthropic、Claude 4.6 Opusの長文タスク性能を公開（200kコンテキスト維持）',
      summary: 'マーケ向けユースケースで100ページ超の競合資料を一気に要約・差分抽出。レポート作成時間が平均1/4に短縮との顧客事例。',
      source: 'Anthropic',
      sourceType: 'media',
      category: 'ai',
      url: 'https://www.anthropic.com/news',
      publishedAt: `${Y}T22:00:00+09:00`,
      tags: ['Claude', 'LLM', '要約']
    },
    {
      id: 'a2',
      title: 'OpenAI、GPT-5系で「ブランドボイス制約」APIパラメータをβ提供',
      summary: 'システムプロンプトで定義したトーン＆マナーに対する逸脱を確率でブロック。広報・MAテンプレでの誤発信リスクを低減。',
      source: 'OpenAI',
      sourceType: 'media',
      category: 'ai',
      url: 'https://openai.com/blog',
      publishedAt: `${Y}T20:15:00+09:00`,
      tags: ['GPT-5', 'API', 'ブランドガバナンス']
    },
    {
      id: 'a3',
      title: 'Google、検索の「AI Overviews」をすべての日本語クエリで標準ON化',
      summary: '従来オプトインだった日本語AI回答が標準表示に。CTR下落への備えとしてGEO（Generative Engine Optimization）対応が急務。',
      source: 'Google Search Central',
      sourceType: 'media',
      category: 'ai',
      url: 'https://developers.google.com/search/blog',
      publishedAt: `${Y}T18:40:00+09:00`,
      tags: ['SEO', 'GEO', 'Google']
    }
  ];

  /* ────────── ② Xハイライト（マーケに効く投稿） ──────────
     リンクは実在アカウントのプロフィールに留め、誤情報リスクを回避。
  */
  const X_HIGHLIGHTS = [
    {
      id: 'x1',
      author: 'Rand Fishkin',
      handle: '@randfish',
      text: '「SEO is dead」じゃなくて「Search is everywhere」。LLM・YouTube・TikTok・Redditのそれぞれにブランドを置く時代へ。',
      tag: 'GEO',
      url: 'https://x.com/randfish'
    },
    {
      id: 'x2',
      author: 'April Dunford',
      handle: '@aprildunford',
      text: 'B2B のポジショニングは「自社の強み」じゃなく「お客様が本当に比較している競合」を中心に組み立てるとハマる。',
      tag: 'B2B',
      url: 'https://x.com/aprildunford'
    },
    {
      id: 'x3',
      author: 'Amanda Natividad',
      handle: '@amandanat',
      text: 'Zero-Click Content の時代は、SNS上で完結するインサイト発信＋それを束ねた長尺記事のセットが最強。',
      tag: 'Content',
      url: 'https://x.com/amandanat'
    },
    {
      id: 'x4',
      author: 'Marketing Brew',
      handle: '@MarketingBrew',
      text: 'Gen Z の購買トリガーTOP3は「友人のレビュー」「TikTokの偶発動画」「ブランドの一貫した世界観」。広告クリエイティブはこの順に最適化を。',
      tag: 'Gen Z',
      url: 'https://x.com/marketingbrew'
    }
  ];

  /* ────────── ③ メタ ──────────  */
  const CATEGORIES = [
    { key: 'all',       label: 'すべて' },
    { key: 'marketing', label: 'マーケティング' },
    { key: 'market',    label: '市場・業界' },
    { key: 'ai',        label: 'AI' }
  ];

  const STORE_KEY_FAV  = 'ai-news:fav:v1';
  const STORE_KEY_READ = 'ai-news:read:v1';

  /* ────────── ④ 状態 ──────────  */
  const state = {
    activeCat: 'all',
    activeSources: new Set(),
    favOnly: false,
    keyword: '',
    fav: loadSet(STORE_KEY_FAV),
    read: loadSet(STORE_KEY_READ)
  };

  function loadSet(k) {
    try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); }
    catch { return new Set(); }
  }
  function saveSet(k, set) {
    try { localStorage.setItem(k, JSON.stringify([...set])); } catch {}
  }

  /* ────────── ⑤ ユーティリティ ──────────  */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    })[c]);
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${m}/${day} ${hh}:${mm}`;
  }
  function fmtBriefDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${m}/${day}`;
  }

  /* ────────── ⑥ レンダリング ──────────  */
  function renderHero() {
    document.getElementById('stat-total').textContent   = NEWS_DATA.length;
    document.getElementById('stat-sources').textContent = new Set(NEWS_DATA.map(n => n.source)).size;
    document.getElementById('stat-date').textContent    = fmtBriefDate(Y);
  }

  function renderTabs() {
    const root = document.getElementById('tabs');
    root.innerHTML = CATEGORIES.map(c => {
      const count = c.key === 'all' ? NEWS_DATA.length : NEWS_DATA.filter(n => n.category === c.key).length;
      const active = c.key === state.activeCat ? ' active' : '';
      return `<button class="tab${active}" role="tab" data-cat="${c.key}" aria-selected="${c.key === state.activeCat}">
        ${escapeHtml(c.label)}<span class="tab-count">${count}</span>
      </button>`;
    }).join('');
    root.querySelectorAll('.tab').forEach(el => {
      el.addEventListener('click', () => {
        state.activeCat = el.dataset.cat;
        renderTabs();
        renderGrid();
      });
    });
  }

  function renderSourceChips() {
    const root = document.getElementById('source-chips');
    const sources = [...new Set(NEWS_DATA.map(n => n.source))].sort();
    const chipsHtml = sources.map(s => {
      const active = state.activeSources.has(s) ? ' active' : '';
      return `<button class="chip${active}" data-source="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
    }).join('');
    const clearBtn = state.activeSources.size
      ? `<button class="chip-clear" id="chip-clear">クリア</button>` : '';
    root.innerHTML = `<span class="chip-label">SOURCES</span>${chipsHtml}${clearBtn}`;
    root.querySelectorAll('.chip').forEach(el => {
      el.addEventListener('click', () => {
        const s = el.dataset.source;
        if (state.activeSources.has(s)) state.activeSources.delete(s);
        else state.activeSources.add(s);
        renderSourceChips();
        renderGrid();
      });
    });
    const clr = document.getElementById('chip-clear');
    if (clr) clr.addEventListener('click', () => {
      state.activeSources.clear();
      renderSourceChips();
      renderGrid();
    });
  }

  function filteredItems() {
    const kw = state.keyword.trim().toLowerCase();
    return NEWS_DATA.filter(n => {
      if (state.activeCat !== 'all' && n.category !== state.activeCat) return false;
      if (state.activeSources.size && !state.activeSources.has(n.source)) return false;
      if (state.favOnly && !state.fav.has(n.id)) return false;
      if (kw) {
        const hay = (n.title + ' ' + n.summary + ' ' + (n.tags||[]).join(' ') + ' ' + n.source).toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }

  function catLabel(c) {
    return ({marketing:'MARKETING', market:'MARKET', ai:'AI'})[c] || c.toUpperCase();
  }

  function renderGrid() {
    const root = document.getElementById('news-grid');
    const items = filteredItems();
    document.getElementById('visible-count').textContent = items.length;
    if (!items.length) {
      root.innerHTML = `
        <div class="empty" style="grid-column: 1 / -1;">
          <div class="empty-icon">📭</div>
          <div class="empty-text">条件に一致するニュースがありません。フィルタや検索語を見直してください。</div>
        </div>`;
      return;
    }
    root.innerHTML = items.map(n => {
      const isFav  = state.fav.has(n.id);
      const isRead = state.read.has(n.id);
      const cat = n.category;
      return `
        <article class="news-card${isRead ? ' read' : ''}" data-id="${n.id}" data-url="${escapeHtml(n.url)}">
          <div class="card-head">
            <span class="card-source cat-${cat}">
              <span class="card-source-dot"></span>${escapeHtml(n.source)}
            </span>
            <button class="star-btn${isFav ? ' starred' : ''}" data-fav="${n.id}" aria-label="お気に入り" aria-pressed="${isFav}">★</button>
          </div>
          <h3 class="card-title">${escapeHtml(n.title)}</h3>
          <p class="card-summary">${escapeHtml(n.summary)}</p>
          <div class="card-foot">
            <span class="card-time">${escapeHtml(fmtDate(n.publishedAt))}</span>
            <span class="card-cat-badge cat-${cat}">${catLabel(cat)}</span>
          </div>
          <div class="card-tags" style="margin-top:8px;">
            ${(n.tags||[]).map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}
          </div>
        </article>`;
    }).join('');

    // クリック→新規タブで開く + 既読化
    root.querySelectorAll('.news-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.star-btn')) return;
        const id = card.dataset.id;
        const url = card.dataset.url;
        state.read.add(id);
        saveSet(STORE_KEY_READ, state.read);
        card.classList.add('read');
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });
    });
    // ★トグル
    root.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.fav;
        if (state.fav.has(id)) state.fav.delete(id);
        else state.fav.add(id);
        saveSet(STORE_KEY_FAV, state.fav);
        btn.classList.toggle('starred');
        btn.setAttribute('aria-pressed', state.fav.has(id));
        if (state.favOnly) renderGrid();
      });
    });
  }

  function renderXList() {
    const root = document.getElementById('x-list');
    root.innerHTML = X_HIGHLIGHTS.map(x => `
      <a class="x-item" href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">
        <div class="x-item-head">
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

  /* ────────── ⑦ 配線 ──────────  */
  function wireUp() {
    const search = document.getElementById('search');
    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.keyword = search.value; renderGrid(); }, 120);
    });

    const fav = document.getElementById('toggle-fav');
    fav.addEventListener('click', () => {
      state.favOnly = !state.favOnly;
      fav.classList.toggle('active', state.favOnly);
      fav.setAttribute('aria-pressed', state.favOnly);
      renderGrid();
    });

    document.getElementById('mark-all-read').addEventListener('click', () => {
      filteredItems().forEach(n => state.read.add(n.id));
      saveSet(STORE_KEY_READ, state.read);
      renderGrid();
    });
    document.getElementById('clear-read').addEventListener('click', () => {
      state.read.clear();
      saveSet(STORE_KEY_READ, state.read);
      renderGrid();
    });
  }

  /* ────────── ⑧ 起動 ──────────  */
  function init() {
    renderHero();
    renderTabs();
    renderSourceChips();
    renderGrid();
    renderXList();
    wireUp();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
