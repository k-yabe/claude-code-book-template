/**
 * 共通コピーユーティリティ
 * 全アプリで統一されたコピー動作・フィードバックを提供する
 */

/**
 * テキストをクリップボードにコピーし、ボタンのフィードバックを更新する
 * @param {string} text - コピーするテキスト
 * @param {HTMLElement} btn - コピーボタン要素
 * @param {Object} [opts]
 * @param {string} [opts.successText='✅ コピーしました'] - コピー成功時のボタンテキスト
 * @param {number} [opts.duration=2000] - フィードバック表示時間（ms）
 */
function copyToClipboard(text, btn, opts = {}) {
  const {
    successText = '✅ コピーしました',
    duration = 2000,
  } = opts;
  const originalText = btn.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = successText;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, duration);
  }).catch(() => {
    // フォールバック（古いブラウザ対応）
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.textContent = successText;
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('copied');
      }, duration);
    } catch (e) {
      console.error('コピーに失敗しました', e);
    }
  });
}
