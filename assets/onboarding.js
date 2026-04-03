/**
 * 共通オンボーディングポップアップ
 *
 * 使い方:
 *   <script src="../../assets/onboarding.js"></script>
 *   <script>
 *     initOnboarding({
 *       appName: 'ogp-checker',
 *       title: 'OGP Checker',
 *       description: 'OGPタグの確認・プレビューツールです',
 *       steps: [
 *         { icon: '🔗', text: 'URLを入力' },
 *         { icon: '🔍', text: 'OGPタグを自動取得' },
 *         { icon: '📋', text: '結果を確認・コピー' }
 *       ]
 *     });
 *   </script>
 */

/* eslint-disable no-unused-vars */
function initOnboarding(config) {
  const key = config.appName + '_onboarded';
  if (localStorage.getItem(key) === '1') return;

  // --- CSS 注入 ---
  const style = document.createElement('style');
  style.textContent = `
    .ob-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,31,51,0.55);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      opacity: 0; transition: opacity 0.25s ease;
    }
    .ob-overlay.show { opacity: 1; }
    .ob-modal {
      background: #fff; width: 90vw; max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      transform: translateY(12px); transition: transform 0.25s ease;
      overflow: hidden;
    }
    .ob-overlay.show .ob-modal { transform: translateY(0); }
    .ob-header {
      background: #001f33; padding: 22px 24px 18px; color: #fff;
    }
    .ob-header h2 {
      font-size: 1.05rem; font-weight: 700; margin: 0 0 4px;
      font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
    }
    .ob-header h2 span { color: #ffb81c; }
    .ob-header p {
      font-size: 0.78rem; color: rgba(255,255,255,0.65); margin: 0;
      line-height: 1.5;
      font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
    }
    .ob-steps {
      padding: 18px 24px 8px; display: flex; flex-direction: column; gap: 10px;
    }
    .ob-step {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; background: #f7f8fa; border: 1.5px solid #e8ecf0;
    }
    .ob-step-num {
      font-size: 0.6rem; font-weight: 800; color: #ffb81c;
      background: #001f33; width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .ob-step-icon { font-size: 1.1rem; flex-shrink: 0; }
    .ob-step-text {
      font-size: 0.8rem; color: #2d3436; line-height: 1.4;
      font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
    }
    .ob-footer {
      padding: 14px 24px 20px; display: flex; justify-content: flex-end;
    }
    .ob-btn {
      background: #001f33; color: #fff; border: none;
      padding: 10px 28px; font-size: 0.82rem; font-weight: 700;
      cursor: pointer; letter-spacing: 0.04em;
      font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
      transition: opacity 0.15s;
    }
    .ob-btn:hover { opacity: 0.85; }
    @media (max-width: 600px) {
      .ob-modal { max-width: 95vw; }
      .ob-header { padding: 18px 16px 14px; }
      .ob-steps { padding: 14px 16px 6px; }
      .ob-footer { padding: 12px 16px 16px; }
    }
  `;
  document.head.appendChild(style);

  // --- HTML 構築 ---
  const stepsHtml = config.steps.map((s, i) => `
    <div class="ob-step">
      <div class="ob-step-num">${i + 1}</div>
      <div class="ob-step-icon">${s.icon}</div>
      <div class="ob-step-text">${s.text}</div>
    </div>
  `).join('');

  const overlay = document.createElement('div');
  overlay.className = 'ob-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="ob-modal">
      <div class="ob-header">
        <h2><span>${config.title}</span> の使い方</h2>
        <p>${config.description}</p>
      </div>
      <div class="ob-steps">${stepsHtml}</div>
      <div class="ob-footer">
        <button class="ob-btn" autofocus>はじめる</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // --- 表示 ---
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('show'));
  });

  // --- 閉じる ---
  function close() {
    overlay.classList.remove('show');
    localStorage.setItem(key, '1');
    setTimeout(() => overlay.remove(), 300);
  }

  overlay.querySelector('.ob-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', handler);
    }
  });
}
