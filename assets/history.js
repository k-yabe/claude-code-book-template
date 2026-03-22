const HistoryManager = {
  currentApp: '',

  init(app) {
    this.currentApp = app;
    this._injectStyles();
    this._injectUI();
    this._updateBadge();
  },

  key() {
    const user = sessionStorage.getItem('username') || 'unknown';
    return `mkapp_history_${user}_${this.currentApp}`;
  },

  save(input, output, meta) {
    const entries = this.getAll();
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      input: String(input).slice(0, 300),
      output: String(output),
    };
    if (meta?.url) entry.url = String(meta.url).slice(0, 300);
    entries.unshift(entry);
    localStorage.setItem(this.key(), JSON.stringify(entries.slice(0, 10)));
    this._updateBadge();
  },

  getAll() {
    try { return JSON.parse(localStorage.getItem(this.key()) || '[]'); }
    catch { return []; }
  },

  openPanel() {
    const body = document.getElementById('hm-body');
    const entries = this.getAll();
    if (entries.length === 0) {
      body.innerHTML = '<div class="hm-empty">まだ履歴がありません</div>';
    } else {
      body.innerHTML = entries.map((e, i) => `
        <div class="hm-entry">
          <div class="hm-entry-time">${this._fmt(e.timestamp)}</div>
          <div class="hm-entry-input">${this._esc(e.input)}${e.input.length >= 300 ? '…' : ''}</div>
          ${e.url ? `<div class="hm-entry-url">${this._esc(e.url)}</div>` : ''}
          <button class="hm-copy-btn" data-idx="${i}">📋 コピー</button>
        </div>
      `).join('');
      body.querySelectorAll('.hm-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => this._copy(Number(btn.dataset.idx), btn));
      });
    }
    document.getElementById('hm-panel').classList.add('open');
    document.getElementById('hm-overlay').classList.add('open');
  },

  closePanel() {
    document.getElementById('hm-panel')?.classList.remove('open');
    document.getElementById('hm-overlay')?.classList.remove('open');
  },

  _copy(index, btn) {
    const entry = this.getAll()[index];
    if (!entry) return;
    navigator.clipboard.writeText(entry.output).then(() => {
      btn.textContent = '✅ コピー済み';
      setTimeout(() => { btn.textContent = '📋 コピー'; }, 1500);
    });
  },

  _updateBadge() {
    const count = this.getAll().length;
    const badge = document.getElementById('hm-badge');
    if (badge) badge.textContent = count > 0 ? count : '';
  },

  _fmt(iso) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  _injectUI() {
    // ナビバーにボタン追加
    const navbar = document.querySelector('.navbar');
    if (navbar) {
      const btn = document.createElement('button');
      btn.className = 'hm-nav-btn';
      btn.innerHTML = '📋 履歴 <span id="hm-badge"></span>';
      btn.onclick = () => this.openPanel();
      navbar.appendChild(btn);
    }

    // オーバーレイ
    const overlay = document.createElement('div');
    overlay.id = 'hm-overlay';
    overlay.className = 'hm-overlay';
    overlay.onclick = () => this.closePanel();
    document.body.appendChild(overlay);

    // パネル
    const panel = document.createElement('div');
    panel.id = 'hm-panel';
    panel.className = 'hm-panel';
    panel.innerHTML = `
      <div class="hm-header">
        <span class="hm-title">📋 履歴</span>
        <button class="hm-close" onclick="HistoryManager.closePanel()">✕</button>
      </div>
      <div class="hm-subhead">クリックでコピー。端末ごとに最新10件保存。</div>
      <div class="hm-body" id="hm-body"></div>
    `;
    document.body.appendChild(panel);
  },

  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .hm-nav-btn {
        margin-left: auto; background: none; border: 1px solid rgba(255,255,255,0.2);
        color: rgba(255,255,255,0.8); font-size: 0.78rem; font-weight: 700;
        padding: 5px 12px; cursor: pointer; font-family: inherit; transition: all 0.15s;
        display: flex; align-items: center; gap: 5px; white-space: nowrap;
      }
      .hm-nav-btn:hover { border-color: #ffb81c; color: #ffb81c; }
      #hm-badge {
        background: #ffb81c; color: #001f33; font-size: 0.65rem; font-weight: 800;
        padding: 1px 6px; min-width: 16px; text-align: center;
      }
      .hm-overlay {
        display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 999;
      }
      .hm-overlay.open { display: block; }
      .hm-panel {
        position: fixed; top: 0; right: -440px; width: 400px; height: 100vh;
        background: #fff; border-left: 1px solid #e8ecf0; z-index: 1000;
        transition: right 0.25s; display: flex; flex-direction: column;
      }
      .hm-panel.open { right: 0; }
      .hm-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; background: #001f33; flex-shrink: 0;
      }
      .hm-title { font-size: 0.9rem; font-weight: 700; color: #fff; }
      .hm-close {
        background: none; border: none; color: rgba(255,255,255,0.6);
        cursor: pointer; font-size: 1rem; padding: 0; transition: color 0.15s;
      }
      .hm-close:hover { color: #ffb81c; }
      .hm-subhead {
        font-size: 0.72rem; color: #b2bec3; padding: 8px 18px;
        border-bottom: 1px solid #e8ecf0; flex-shrink: 0;
      }
      .hm-body { flex: 1; overflow-y: auto; padding: 14px; }
      .hm-empty { text-align: center; color: #b2bec3; font-size: 0.85rem; padding: 40px 0; }
      .hm-entry {
        border: 1px solid #e8ecf0; border-left: 3px solid #001f33;
        padding: 10px 14px; margin-bottom: 10px;
      }
      .hm-entry-time { font-size: 0.68rem; color: #b2bec3; font-weight: 600; margin-bottom: 5px; }
      .hm-entry-input {
        font-size: 0.82rem; color: #4a5568; line-height: 1.5; margin-bottom: 8px;
        white-space: pre-wrap; max-height: 72px; overflow: hidden;
      }
      .hm-copy-btn {
        background: none; border: 1px solid #e8ecf0; color: #8a9bb0;
        font-size: 0.72rem; font-weight: 700; padding: 3px 10px; cursor: pointer;
        font-family: inherit; transition: all 0.15s;
      }
      .hm-copy-btn:hover { border-color: #001f33; color: #001f33; }
      .hm-entry-url {
        font-size: 0.7rem; color: #a0aab4; margin-bottom: 8px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
    `;
    document.head.appendChild(style);
  },
};
