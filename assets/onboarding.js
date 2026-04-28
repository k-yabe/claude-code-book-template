/**
 * 共通オンボーディングポップアップ
 *
 * - 初回〜毎回表示（閉じても次回また出る）
 * - 「今後表示しない」チェックで非表示にできる
 * - updates 配列があれば「最近のアップデート」セクションを表示
 *
 * 使い方:
 *   <script src="../../assets/onboarding.js"></script>
 *   <script>
 *     initOnboarding({
 *       appName: 'ogp-checker',
 *       title: 'OGP Checker',
 *       description: 'SNSでシェアされたときの見え方を事前に確認できます',
 *       features: [
 *         { icon: '🔍', text: 'URLを貼るだけでOGP・Twitter Cardを自動取得' },
 *         { icon: '📱', text: 'SNSでの表示をその場でプレビュー' },
 *         { icon: '⚠️', text: '設定ミスがあればすぐわかる' }
 *       ],
 *       updates: [
 *         { date: '2026-04-08', text: 'SEO検証強化・アクセシビリティ改善' },
 *         { date: '2026-04-03', text: 'Twitter Card・h1チェック追加' }
 *       ]
 *     });
 *   </script>
 */

/* eslint-disable no-unused-vars */
var OB_VERSION = 4; // この数字を上げると全員に再表示される（v4: 全アプリ大幅アップデート通知）

// ──────────────────────────────────────────────────────────
//   App view ログ送信（ブックマーク直接アクセスも含めて全訪問を捕捉）
// ──────────────────────────────────────────────────────────
// 仕様:
// - 各アプリの index.html が initOnboarding() を呼ぶたびに、これが先に走って
//   /api/log に open_app ログを送る。
// - スプレッドシート上のラベルを既存データと揃えるため slug → 表示名のマップを使う。
// - portal の「カードクリック → open_app 送信 → 遷移」と二重にならないように、
//   portal が sessionStorage に直前ヒントを残しているのを参照して 30 秒以内の
//   同一アプリは抑制する。
// - 同一セッション内のページリロード・タブ復帰での重複送信も 5 分窓で抑制。
// - 送信は navigator.sendBeacon 優先（ページ遷移中でも保証配信）、未対応環境は
//   keepalive: true 付き fetch にフォールバック。
const _APP_DISPLAY_NAMES = {
  'ogp-checker':           'OGP Checker',
  'url-slug-generator':    'URL Slug Generator',
  'banner-resizer':        'Banner Resizer',
  'youtube-desc':          'YouTube Generator',
  'marketo-mail-generator':'Marketo Mail Generator',
  'akkodis-watcher':       'Global Antenna',
  'ai-news':               'AI NEWS',
  'writing-checker':       'Writing Checker',
  'sns-post-generator':    'Post Generator',
  'cache-checker':         'Cache Checker',
  'image-converter':       'Image Converter',
  'wireframe-maker':       'Wireframe Maker',
  'slide-maker':           'Slide Maker',
  'prompt-maker':          'Prompt Maker',
};

function sendAppView(appName) {
  if (!appName) return;
  const displayName = _APP_DISPLAY_NAMES[appName] || appName;

  // ① portal の card click が直前に同じアプリで open_app を送っていたら重複なのでスキップ
  try {
    const last = sessionStorage.getItem('mapps_last_open_app');
    if (last) {
      const parsed = JSON.parse(last);
      if (parsed && parsed.app === displayName && Date.now() - (parsed.t || 0) < 30 * 1000) {
        sessionStorage.removeItem('mapps_last_open_app'); // 一度だけ抑制
        return;
      }
    }
  } catch {}

  // ② 同一セッション内のリロード・戻るボタン等での重複は 5 分窓で抑制
  const dedupeKey = 'mapps_view_sent_' + appName;
  try {
    const lastSent = parseInt(sessionStorage.getItem(dedupeKey) || '0', 10);
    if (lastSent && Date.now() - lastSent < 5 * 60 * 1000) return;
    sessionStorage.setItem(dedupeKey, String(Date.now()));
  } catch {}

  // ③ ユーザー名: portal で localStorage に保存されているのでそれを優先。
  //    各アプリは sessionStorage を初期化していないので localStorage から取る。
  const user =
    (typeof localStorage !== 'undefined' && localStorage.getItem('username')) ||
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('username')) ||
    'unknown';

  const payload = JSON.stringify({
    user,
    action: 'open_app',
    app: displayName,
    timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/log', blob)) return;
    }
  } catch {}

  try {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      mode: 'same-origin',
    }).catch(() => {});
  } catch {}
}

function initOnboarding(config) {
  // どのアプリ起動経路（portal クリック / ブックマーク / 直リンク）でも
  // GAS スプレッドシートに 1 行残るように、まずアプリビューを記録する。
  try { sendAppView(config && config.appName); } catch {}

  const key = config.appName + '_onboarded_v' + OB_VERSION;
  if (localStorage.getItem(key) === '1') return;

  // --- CSS 注入 ---
  if (!document.getElementById('ob-styles')) {
    const style = document.createElement('style');
    style.id = 'ob-styles';
    style.textContent = `
      .ob-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,31,51,0.6);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        opacity: 0; transition: opacity 0.3s ease;
      }
      .ob-overlay.show { opacity: 1; }
      .ob-modal {
        background: #fff; width: 90vw; max-width: 440px;
        max-height: calc(100vh - 40px);
        box-shadow: 0 24px 64px rgba(0,31,51,0.3);
        transform: scale(0.94) translateY(16px);
        transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        position: relative;
      }
      .ob-overlay.show .ob-modal { transform: scale(1) translateY(0); }

      /* ── 閉じるボタン (×) ── */
      .ob-close {
        position: absolute; top: 8px; right: 8px;
        width: 36px; height: 36px;
        background: transparent; color: #fff;
        border: 1px solid rgba(255,255,255,0.25);
        font-family: inherit;
        font-size: 1.1rem; line-height: 1;
        cursor: pointer; padding: 0;
        display: inline-flex; align-items: center; justify-content: center;
        z-index: 1;
        transition: background 0.15s, border-color 0.15s;
      }
      .ob-close:hover, .ob-close:focus {
        background: rgba(255,255,255,0.12);
        border-color: rgba(255,255,255,0.5);
        outline: none;
      }

      /* ── ヘッダー ── */
      .ob-header {
        background: #001f33; padding: 24px 56px 20px 28px; color: #fff;
        border-bottom: 3px solid #ffb81c;
      }
      .ob-header h2 {
        font-size: 1.08rem; font-weight: 800; margin: 0 0 6px;
        font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
        letter-spacing: 0.01em;
      }
      .ob-header h2 span { color: #ffb81c; }
      .ob-header p {
        font-size: 0.78rem; color: rgba(255,255,255,0.78); margin: 0;
        line-height: 1.5;
        font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
      }

      /* ── 機能リスト ── */
      .ob-features {
        padding: 20px 28px 12px; display: flex; flex-direction: column; gap: 10px;
      }
      .ob-feature {
        display: flex; align-items: center; gap: 14px;
        padding: 13px 16px;
        background: rgba(0,31,51,0.04);
        border-left: 3px solid rgba(0,31,51,0.15);
        transition: background 0.15s, border-color 0.15s;
      }
      .ob-feature:hover {
        background: rgba(0,31,51,0.08);
        border-left-color: #ffb81c;
      }
      .ob-feature-icon { font-size: 1.3rem; flex-shrink: 0; }
      .ob-feature-text {
        font-size: 0.82rem; color: #001f33; line-height: 1.45;
        font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
        font-weight: 500;
      }

      /* ── フッター ── */
      .ob-footer {
        padding: 16px 28px 22px;
        display: flex; align-items: center; justify-content: space-between;
        border-top: 1px solid rgba(0,31,51,0.08);
      }
      .ob-dismiss {
        display: flex; align-items: center; gap: 6px;
        font-size: 0.72rem; color: rgba(0,31,51,0.45); cursor: pointer;
        user-select: none;
        font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
        transition: color 0.15s;
      }
      .ob-dismiss:hover { color: rgba(0,31,51,0.7); }
      .ob-dismiss input {
        accent-color: #ffb81c; width: 14px; height: 14px; cursor: pointer;
      }
      .ob-btn {
        background: #001f33; color: #fff; border: none;
        padding: 11px 32px; font-size: 0.84rem; font-weight: 800;
        cursor: pointer; letter-spacing: 0.05em;
        font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
        transition: all 0.18s;
        box-shadow: 0 4px 16px rgba(0,31,51,0.18);
      }
      .ob-btn:hover {
        opacity: 0.92;
        box-shadow: 0 6px 24px rgba(0,31,51,0.28);
        transform: translateY(-1px);
      }

      /* ── アップデートセクション ── */
      .ob-updates {
        padding: 0 28px 10px;
      }
      .ob-updates-title {
        font-size: 0.7rem; font-weight: 800; color: #001f33;
        letter-spacing: 0.12em; text-transform: uppercase;
        margin: 0 0 10px; padding: 14px 0 10px;
        border-top: 2px solid #ffb81c;
        display: flex; align-items: center; gap: 8px;
      }
      .ob-updates-title::before {
        content: ''; display: block; width: 4px; height: 16px;
        background: #ffb81c; flex-shrink: 0;
      }
      .ob-update-item {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 9px 0;
        border-bottom: 1px solid rgba(0,31,51,0.06);
        font-size: 0.78rem; color: #001f33;
        line-height: 1.5;
        font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
      }
      .ob-update-item:last-child { border-bottom: none; }
      .ob-update-date {
        flex-shrink: 0; font-size: 0.68rem; font-weight: 700;
        color: #fff; background: #001f33; padding: 3px 8px;
        white-space: nowrap;
      }
      .ob-update-text { min-width: 0; }

      @media (max-width: 600px) {
        .ob-modal { max-width: 95vw; max-height: calc(100vh - 24px); }
        .ob-header { padding: 18px 52px 14px 18px; }
        .ob-features { padding: 16px 18px 8px; }
        .ob-updates { padding: 0 18px 8px; }
        .ob-footer { padding: 14px 18px 18px; flex-direction: column-reverse; gap: 10px; align-items: stretch; }
        .ob-btn { text-align: center; min-height: 44px; }
        .ob-dismiss { justify-content: center; }
        .ob-close { width: 40px; height: 40px; font-size: 1.3rem; top: 6px; right: 6px; }
      }
    `;
    document.head.appendChild(style);
  }

  // --- HTML 構築 ---
  const items = config.features || config.steps || [];
  const featuresHtml = items.map(s => `
    <div class="ob-feature">
      <div class="ob-feature-icon">${s.icon}</div>
      <div class="ob-feature-text">${s.text}</div>
    </div>
  `).join('');

  const updates = config.updates || [];
  const updatesHtml = updates.length > 0 ? `
    <div class="ob-updates">
      <div class="ob-updates-title">最近のアップデート</div>
      ${updates.map(u => `
        <div class="ob-update-item">
          <span class="ob-update-date">${u.date}</span>
          <span class="ob-update-text">${u.text}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const overlay = document.createElement('div');
  overlay.className = 'ob-overlay';
  // モーダル本体の方に role="dialog" を付ける（overlay は装飾要素扱い）
  // タイトル h2 を aria-labelledby で参照させてスクリーンリーダーに読ませる。
  const titleId = 'ob-title-' + config.appName;
  overlay.innerHTML = `
    <div class="ob-modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <button type="button" class="ob-close" aria-label="閉じる" title="閉じる">×</button>
      <div class="ob-header">
        <h2 id="${titleId}"><span>${config.title}</span> でできること</h2>
        <p>${config.description}</p>
      </div>
      <div class="ob-features">${featuresHtml}</div>
      ${updatesHtml}
      <div class="ob-footer">
        <label class="ob-dismiss">
          <input type="checkbox" id="ob-no-more">今後表示しない
        </label>
        <button class="ob-btn">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // --- 表示 ---
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('show'));
  });

  // --- 閉じる ---
  // keydown リスナーは閉じ方によらず必ず外す（複数回 onboarding が走った時の累積を防ぐ）
  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
  function close() {
    const noMore = overlay.querySelector('#ob-no-more').checked;
    if (noMore) {
      localStorage.setItem(key, '1');
    }
    overlay.classList.remove('show');
    document.removeEventListener('keydown', onKeydown);
    setTimeout(() => overlay.remove(), 300);
  }

  overlay.querySelector('.ob-btn').addEventListener('click', close);
  overlay.querySelector('.ob-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKeydown);
}
