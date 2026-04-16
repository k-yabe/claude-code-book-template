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
  const NEWS_DATA = [
    {
      id: 'm3', importance: 1, readMin: 1,
      title: 'B2B購買行動調査2026：意思決定者の73%が「営業より先にAI検索を信頼」',
      summary: 'Gartner調査。比較段階での主要情報源として ChatGPT / Perplexity が営業資料・営業面談を上回るとの結果。コンテンツの AI検索最適化（GEO）が今や必須の打ち手となる。',
      source: 'Gartner', sourceType: 'media', category: 'marketing',
      url: 'https://www.gartner.com/en/marketing',
      publishedAt: `${Y}T09:10:00+09:00`,
      tags: ['B2B', 'GEO', '購買行動']
    },
    {
      id: 'mk2', importance: 2, readMin: 1,
      title: 'Salesforce、Slack＋AgentforceでCMO向け「収益AIエージェント」発表',
      summary: '案件・キャンペーン・コンテンツの優先度を自動再計算し、予算配分提案までを担う。Adobe・HubSpotとの主導権争いが激化。',
      source: 'Salesforce News', sourceType: 'media', category: 'market',
      url: 'https://www.salesforce.com/news/',
      publishedAt: `${Y}T14:45:00+09:00`,
      tags: ['SaaS', 'AIエージェント', 'CMO']
    },
    {
      id: 'a1', importance: 2, readMin: 1,
      title: 'Anthropic、Claude 4.6 Opusの長文タスク性能を公開（200kコンテキスト維持）',
      summary: '100ページ超の競合資料を一気に要約・差分抽出。マーケのレポート作成時間が平均1/4に短縮との顧客事例。',
      source: 'Anthropic', sourceType: 'media', category: 'ai',
      url: 'https://www.anthropic.com/news',
      publishedAt: `${Y}T22:00:00+09:00`,
      tags: ['Claude', 'LLM', '要約']
    },
    {
      id: 'm1', importance: 2, readMin: 1,
      title: 'Google、Performance Max に「ブランド除外」レポート機能を正式追加',
      summary: 'これまでブラックボックス気味だったブランドキーワード除外の効果が、配信レポート上で個別可視化できるように。CPA改善の根拠提示が容易になる。',
      source: 'Google Ads Help', sourceType: 'media', category: 'marketing',
      url: 'https://support.google.com/google-ads/answer/10724817',
      publishedAt: `${Y}T08:30:00+09:00`,
      tags: ['広告', 'PMax', 'Google']
    },
    {
      id: 'a3', importance: 2, readMin: 1,
      title: 'Google検索の「AI Overviews」、すべての日本語クエリで標準ON化',
      summary: '従来オプトインだった日本語AI回答が標準表示に。CTR下落への備えとしてGEO（Generative Engine Optimization）対応が急務。',
      source: 'Google Search Central', sourceType: 'media', category: 'ai',
      url: 'https://developers.google.com/search/blog',
      publishedAt: `${Y}T18:40:00+09:00`,
      tags: ['SEO', 'GEO', 'Google']
    },
    {
      id: 'mk1', importance: 2, readMin: 1,
      title: '日本のデジタル広告費、初の4兆円突破（電通報告）',
      summary: '2025年は4兆1,200億円・前年比+9.4%。インターネット広告がマス4媒体合計を再び大きく上回り、動画広告の伸長が牽引。',
      source: '電通', sourceType: 'media', category: 'market',
      url: 'https://www.dentsu.co.jp/news/release/2025/',
      publishedAt: `${Y}T10:00:00+09:00`,
      tags: ['広告費', '日本', '統計']
    },
    {
      id: 'm2', importance: 3, readMin: 1,
      title: 'Marketo、生成AIによる「件名A/B自動最適化」を全プランで提供開始',
      summary: '送信開始30分のオープン率を学習し、残りセグメントに最適件名を自動配信。中堅B2BでもCTRが平均+18%との社内ベンチ。',
      source: 'Adobe Marketo Engage', sourceType: 'media', category: 'marketing',
      url: 'https://business.adobe.com/products/marketo/adobe-marketo.html',
      publishedAt: `${Y}T11:05:00+09:00`,
      tags: ['MA', 'メール', 'AI']
    },
    {
      id: 'a2', importance: 3, readMin: 1,
      title: 'OpenAI、GPT-5系で「ブランドボイス制約」APIパラメータをβ提供',
      summary: 'システムプロンプトで定義したトーン＆マナーへの逸脱を確率でブロック。広報・MAテンプレでの誤発信リスクを低減。',
      source: 'OpenAI', sourceType: 'media', category: 'ai',
      url: 'https://openai.com/blog',
      publishedAt: `${Y}T20:15:00+09:00`,
      tags: ['GPT-5', 'API', 'ブランドガバナンス']
    },
    {
      id: 'm5', importance: 3, readMin: 1,
      title: 'TikTok、Search Adsを日本含む新規10カ国へ拡大',
      summary: '検索結果に純広告枠を追加。Z世代の「TikTokで検索」傾向の中、検索面でのブランド露出が新たに獲得可能に。',
      source: 'TikTok for Business', sourceType: 'media', category: 'marketing',
      url: 'https://www.tiktok.com/business/ja',
      publishedAt: `${Y}T13:00:00+09:00`,
      tags: ['SNS', '検索広告']
    },
    {
      id: 'mk3', importance: 3, readMin: 1,
      title: 'Cookieless時代のIDソリューション、UID2.0採用が前年比3倍に',
      summary: 'The Trade Desk主導のUnified ID 2.0が国内DSP/SSPでも標準対応に。Chromeのサードパーティクッキー段階廃止を見据えた動き。',
      source: 'AdExchanger', sourceType: 'media', category: 'market',
      url: 'https://www.adexchanger.com/',
      publishedAt: `${Y}T07:50:00+09:00`,
      tags: ['Cookieless', 'AdTech']
    },
    {
      id: 'm4', importance: 3, readMin: 1,
      title: 'HubSpot、無料CRMに「会話インテリジェンス（録音文字起こし＋要約）」追加',
      summary: 'Zoom/Google Meet と連携し、商談を自動要約してCRM上の連絡先に紐付け。Starter以下でも月25時間まで利用可能に。',
      source: 'HubSpot', sourceType: 'media', category: 'marketing',
      url: 'https://www.hubspot.com/products/sales/conversation-intelligence',
      publishedAt: `${Y}T15:20:00+09:00`,
      tags: ['CRM', 'セールス']
    }
  ];

  /* ────────── ② Xハイライト ──────────  */
  const X_HIGHLIGHTS = [
    {
      id: 'x1', author: 'Rand Fishkin', handle: '@randfish',
      text: '「SEO is dead」じゃなくて「Search is everywhere」。LLM・YouTube・TikTok・Redditそれぞれにブランドを置く時代へ。',
      tag: 'GEO', url: 'https://x.com/randfish'
    },
    {
      id: 'x2', author: 'April Dunford', handle: '@aprildunford',
      text: 'B2Bポジショニングは「自社の強み」じゃなく「お客様が本当に比較している競合」を中心に組み立てるとハマる。',
      tag: 'B2B', url: 'https://x.com/aprildunford'
    },
    {
      id: 'x3', author: 'Amanda Natividad', handle: '@amandanat',
      text: 'Zero-Click Content の時代は、SNS上で完結するインサイト発信＋それを束ねた長尺記事のセットが最強。',
      tag: 'Content', url: 'https://x.com/amandanat'
    }
  ];

  /* ────────── ③ メタ ──────────  */
  const CATEGORIES = [
    { key: 'all',       label: 'すべて' },
    { key: 'marketing', label: 'マーケ' },
    { key: 'market',    label: '市場' },
    { key: 'ai',        label: 'AI' }
  ];
  const CAT_LABEL = { marketing: 'MARKETING', market: 'MARKET', ai: 'AI' };

  const STORE_KEY_FAV  = 'ai-news:fav:v1';
  const STORE_KEY_READ = 'ai-news:read:v1';

  /* ────────── ④ 状態 ──────────  */
  const state = {
    activeCat: 'all',
    favOnly: false,
    keyword: '',
    fav:  loadSet(STORE_KEY_FAV),
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
    return `${d.getMonth()+1}/${d.getDate()}`;
  }
  function totalReadTime(items) {
    return items.reduce((a, n) => a + (n.readMin || 1), 0);
  }
  function openExternal(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function markRead(id, el) {
    state.read.add(id);
    saveSet(STORE_KEY_READ, state.read);
    if (el) el.classList.add('read');
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

  /* ────────── ⑥ 仕分け ──────────  */
  function partition() {
    const sorted = [...NEWS_DATA].sort((a, b) => {
      // importance昇順 → publishedAt降順
      if ((a.importance||3) !== (b.importance||3)) return (a.importance||3) - (b.importance||3);
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });
    const top      = sorted.find(n => n.importance === 1) || sorted[0];
    const briefing = sorted.filter(n => n !== top && n.importance === 2).slice(0, 5);
    const usedIds  = new Set([top?.id, ...briefing.map(n => n.id)]);
    const more     = sorted.filter(n => !usedIds.has(n.id));
    return { top, briefing, more };
  }

  /* ────────── ⑦ レンダリング ──────────  */
  function renderHero() {
    const total = NEWS_DATA.length;
    const read  = totalReadTime(NEWS_DATA);
    document.getElementById('stat-date').textContent  = fmtBriefDate(Y);
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-read').textContent  = `${read}分`;
  }

  function renderTopStory(top) {
    const root = document.getElementById('top-story');
    if (!top) {
      root.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">本日のトップストーリーはありません</div></div>';
      return;
    }
    const isRead = state.read.has(top.id);
    const isFav  = state.fav.has(top.id);
    const cat = top.category;
    root.innerHTML = `
      <article class="top-card${isRead ? ' read' : ''}" data-id="${top.id}" data-url="${escapeHtml(top.url)}">
        <div class="top-meta">
          <span class="meta-pill ${'cat-' + cat}">${escapeHtml(CAT_LABEL[cat] || cat)}</span>
          <span class="meta-source">${escapeHtml(top.source)}</span>
          <span class="meta-time">${escapeHtml(fmtDate(top.publishedAt))}</span>
          <span class="meta-read">⏱ 約${top.readMin || 1}分</span>
        </div>
        <h2 class="top-title">${escapeHtml(top.title)}</h2>
        <p class="top-summary">${escapeHtml(top.summary)}</p>
        <div class="top-foot">
          <div>${(top.tags||[]).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join(' ')}</div>
          <div style="display:flex;align-items:center;gap:12px;">
            <button class="star-btn${isFav ? ' starred' : ''}" data-fav="${top.id}" aria-label="お気に入り" aria-pressed="${isFav}">★</button>
            <span class="meta-source" style="color:var(--gold);">記事を開く →</span>
          </div>
        </div>
      </article>`;
    const card = root.querySelector('.top-card');
    card.addEventListener('click', e => {
      if (e.target.closest('.star-btn')) return;
      markRead(top.id, card);
      openExternal(top.url);
    });
    const star = root.querySelector('.star-btn');
    if (star) star.addEventListener('click', e => { e.stopPropagation(); toggleFav(top.id, star); });
  }

  function renderBriefing(items) {
    const root = document.getElementById('briefing');
    if (!items.length) {
      root.innerHTML = '<div class="empty" style="border:none;"><div class="empty-text">本日のブリーフィング項目はありません</div></div>';
      return;
    }
    root.innerHTML = items.map((n, i) => {
      const isRead = state.read.has(n.id);
      const isFav  = state.fav.has(n.id);
      const cat = n.category;
      return `
        <div class="brief-item${isRead ? ' read' : ''}" data-id="${n.id}" data-url="${escapeHtml(n.url)}">
          <div class="brief-num">${String(i+1).padStart(2,'0')}</div>
          <div class="brief-body">
            <div class="brief-meta">
              <span class="meta-pill ${'cat-' + cat}">${escapeHtml(CAT_LABEL[cat] || cat)}</span>
              <span class="meta-source">${escapeHtml(n.source)}</span>
              <span class="meta-time">${escapeHtml(fmtDate(n.publishedAt))}</span>
            </div>
            <div class="brief-title">${escapeHtml(n.title)}</div>
            <div class="brief-summary">${escapeHtml(n.summary)}</div>
          </div>
          <div class="brief-side">
            <button class="star-btn${isFav ? ' starred' : ''}" data-fav="${n.id}" aria-label="お気に入り" aria-pressed="${isFav}">★</button>
            <span class="meta-read">⏱ ${n.readMin || 1}分</span>
          </div>
        </div>`;
    }).join('');
    root.querySelectorAll('.brief-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.star-btn')) return;
        const id = el.dataset.id;
        markRead(id, el);
        openExternal(el.dataset.url);
      });
    });
    root.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); toggleFav(btn.dataset.fav, btn); });
    });
  }

  function renderTabs(more) {
    const root = document.getElementById('tabs');
    root.innerHTML = CATEGORIES.map(c => {
      const count = c.key === 'all' ? more.length : more.filter(n => n.category === c.key).length;
      const active = c.key === state.activeCat ? ' active' : '';
      return `<button class="tab${active}" role="tab" data-cat="${c.key}" aria-selected="${c.key === state.activeCat}">
        ${escapeHtml(c.label)}<span class="tab-count">${count}</span>
      </button>`;
    }).join('');
    root.querySelectorAll('.tab').forEach(el => {
      el.addEventListener('click', () => {
        state.activeCat = el.dataset.cat;
        renderTabs(more);
        renderMore(more);
      });
    });
  }

  function renderMore(allMore) {
    const root = document.getElementById('more-list');
    const kw = state.keyword.trim().toLowerCase();
    const items = allMore.filter(n => {
      if (state.activeCat !== 'all' && n.category !== state.activeCat) return false;
      if (state.favOnly && !state.fav.has(n.id)) return false;
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
        <div class="more-item${isRead ? ' read' : ''}" data-id="${n.id}" data-url="${escapeHtml(n.url)}">
          <span class="more-cat ${'cat-' + cat}">${escapeHtml(CAT_LABEL[cat] || cat)}</span>
          <div class="more-title">${escapeHtml(n.title)}</div>
          <span class="more-source">${escapeHtml(n.source)}</span>
          <button class="star-btn${state.fav.has(n.id) ? ' starred' : ''}" data-fav="${n.id}" aria-label="お気に入り">★</button>
        </div>`;
    }).join('');
    root.querySelectorAll('.more-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.star-btn')) return;
        markRead(el.dataset.id, el);
        openExternal(el.dataset.url);
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
    fav.addEventListener('click', () => {
      state.favOnly = !state.favOnly;
      fav.classList.toggle('active', state.favOnly);
      fav.setAttribute('aria-pressed', state.favOnly);
      renderMore(more);
    });
  }

  /* ────────── ⑨ データ取得（自動更新JSON → 失敗時シード） ──────────  */
  let dataMeta = { updatedAt: null, generatedFor: null };

  async function loadRemote() {
    try {
      const res = await fetch('./data/news.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json || !Array.isArray(json.items) || json.items.length === 0) {
        throw new Error('empty payload');
      }
      // 受信データで NEWS_DATA を置換
      NEWS_DATA.length = 0;
      for (const it of json.items) {
        // 必須フィールドを正規化
        NEWS_DATA.push({
          id: it.id || ('n_' + Math.random().toString(36).slice(2, 10)),
          importance: Number(it.importance) || 3,
          readMin:    Number(it.readMin) || 1,
          title:      String(it.title || '').trim(),
          summary:    String(it.summary || '').trim(),
          source:     String(it.source || '').trim(),
          sourceType: it.sourceType || 'media',
          category:   ['marketing','market','ai'].includes(it.category) ? it.category : 'marketing',
          url:        String(it.url || ''),
          publishedAt: it.publishedAt || new Date().toISOString(),
          tags: Array.isArray(it.tags) ? it.tags.map(String) : []
        });
      }
      dataMeta = { updatedAt: json.updatedAt || null, generatedFor: json.generatedFor || null };
      return true;
    } catch (e) {
      console.info('[ai-news] using bundled seed data:', e.message);
      return false;
    }
  }

  function applyMeta() {
    if (!dataMeta.generatedFor) return;
    const el = document.getElementById('stat-date');
    if (el) el.textContent = fmtBriefDate(dataMeta.generatedFor);
  }

  /* ────────── ⑩ 起動 ──────────  */
  async function init() {
    await loadRemote(); // 失敗時はシード継続
    const { top, briefing, more } = partition();
    renderHero();
    applyMeta();
    renderTopStory(top);
    renderBriefing(briefing);
    renderTabs(more);
    renderMore(more);
    renderX();
    wireUp(more);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
