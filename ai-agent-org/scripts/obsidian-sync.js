#!/usr/bin/env node
/**
 * Obsidian Sync
 * tasks.json の各タスクを Obsidian ノートとして書き出す。
 * AI エージェントの出力をスマホ（Obsidian Mobile）で読めるようにする。
 *
 * Usage:
 *   node scripts/obsidian-sync.js
 *   node scripts/obsidian-sync.js --vault ~/Obsidian/MyVault
 *   node scripts/obsidian-sync.js --dry-run
 *
 * 設定:
 *   環境変数 OBSIDIAN_VAULT_PATH でも vault パスを指定できる。
 *   未設定の場合、~/Obsidian 配下の最初のフォルダを自動検出する。
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT       = path.join(__dirname, '..');
const TASKS_FILE = path.join(ROOT, 'tasks', 'tasks.json');
const DRY_RUN    = process.argv.includes('--dry-run');

// ── Vault 検出 ──────────────────────────────────────────────
function detectVaultPath() {
  // 1) CLI 引数 --vault <path>
  const idx = process.argv.indexOf('--vault');
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1].replace(/^~/, os.homedir());
  }
  // 2) 環境変数
  if (process.env.OBSIDIAN_VAULT_PATH) {
    return process.env.OBSIDIAN_VAULT_PATH.replace(/^~/, os.homedir());
  }
  // 3) iCloud 経由 Obsidian（Obsidian Sync または Files 経由）
  const icloud = path.join(os.homedir(),
    'Library/Mobile Documents/iCloud~md~obsidian/Documents');
  if (fs.existsSync(icloud)) {
    const vaults = fs.readdirSync(icloud).filter(d => {
      try { return fs.statSync(path.join(icloud, d)).isDirectory(); } catch { return false; }
    });
    if (vaults.length > 0) return path.join(icloud, vaults[0]);
  }
  // 4) ~/Obsidian/<VaultName>（1つ目を選択）
  const obsDir = path.join(os.homedir(), 'Obsidian');
  if (fs.existsSync(obsDir)) {
    const vaults = fs.readdirSync(obsDir).filter(d => {
      try { return fs.statSync(path.join(obsDir, d)).isDirectory() && !d.startsWith('.'); } catch { return false; }
    });
    if (vaults.length > 0) return path.join(obsDir, vaults[0]);
  }
  // 5) ~/Documents/Obsidian/<VaultName>
  const docsObs = path.join(os.homedir(), 'Documents', 'Obsidian');
  if (fs.existsSync(docsObs)) {
    const vaults = fs.readdirSync(docsObs).filter(d => {
      try { return fs.statSync(path.join(docsObs, d)).isDirectory() && !d.startsWith('.'); } catch { return false; }
    });
    if (vaults.length > 0) return path.join(docsObs, vaults[0]);
  }
  return null;
}

// ── フォーマット ────────────────────────────────────────────
const STATUS_LABEL = {
  'new-assigned': '🔵 未着手',
  'in-progress':  '🟡 進行中',
  'blocked':      '🔴 ブロック中',
  'done':         '✅ 完了',
};
const TEAM_LABEL = {
  research: 'リサーチ', personal: 'パーソナル', engineering: 'エンジニア',
  content: 'コンテンツ', business: 'ビジネス', infrastructure: 'インフラ',
};
const AGENT_EMOJI = {
  'research-analyst':'🔎','career-advisor':'🧭','tech-lead':'🔧',
  'frontend-engineer':'🎨','backend-engineer':'⚙️','qa-engineer':'🧪',
  'content-director':'📝','marketing-director':'📣','business-strategist':'💼',
  'partnership-manager':'🤝','legal-review':'⚖️','task-dispatcher':'📬',
  'human':'👤','system':'⚙️',
};

function agentEmoji(name) { return AGENT_EMOJI[name] || '🤖'; }

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP') + ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function safeFilename(title) {
  return title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').slice(0, 60).trim();
}

function buildNote(task) {
  const statusLabel  = STATUS_LABEL[task.status]  || task.status;
  const teamLabel    = TEAM_LABEL[task.team]       || task.team;
  const createdDate  = task.createdAt ? task.createdAt.split('T')[0] : '';
  const updatedDate  = task.updatedAt ? task.updatedAt.split('T')[0] : '';
  const tags         = ['ai-agent', task.team, task.organization].filter(Boolean);

  const lines = [
    '---',
    `id: ${task.id}`,
    `title: "${(task.title || '').replace(/"/g, "'")}"`,
    `assignee: ${task.assignee}`,
    `status: "${statusLabel}"`,
    `priority: ${task.priority}`,
    `team: ${teamLabel}`,
    `organization: ${task.organization || 'private'}`,
    `created: ${createdDate}`,
    `updated: ${updatedDate}`,
    `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
    '---',
    '',
    `# ${task.id}: ${task.title}`,
    '',
  ];

  // 概要
  if (task.description) {
    lines.push('## 📋 タスク概要', '');
    lines.push(task.description, '');
  }

  // メタ情報
  lines.push('## ℹ️ 情報', '');
  lines.push(`| 項目 | 内容 |`);
  lines.push(`|------|------|`);
  lines.push(`| ステータス | ${statusLabel} |`);
  lines.push(`| 優先度 | ${task.priority} |`);
  lines.push(`| 担当 | ${agentEmoji(task.assignee)} ${task.assignee} |`);
  lines.push(`| チーム | ${teamLabel} |`);
  lines.push(`| 組織 | ${task.organization || 'private'} |`);
  lines.push(`| 作成 | ${fmtDate(task.createdAt)} |`);
  lines.push(`| 更新 | ${fmtDate(task.updatedAt)} |`);
  lines.push('');

  // ブロック理由
  if (task.status === 'blocked' && task.blockedReason) {
    lines.push(`> ⛔ **ブロック中**: ${task.blockedReason}`, '');
  }

  // コメント・チャット
  const comments = task.comments || [];
  if (comments.length > 0) {
    lines.push('## 💬 やりとり', '');
    for (const c of comments) {
      const emoji = agentEmoji(c.author);
      const time  = fmtDate(c.timestamp);
      if (c.author === 'system' || isSystemMsg(c)) {
        lines.push(`> *${c.content}* — ${time}`, '');
      } else if (c.author === 'human') {
        lines.push(`### 👤 あなた (${time})`, '');
        lines.push(c.content, '');
      } else {
        lines.push(`### ${emoji} ${c.author} (${time})`, '');
        lines.push(c.content, '');
      }
    }
  }

  lines.push('');
  lines.push(`---`);
  lines.push(`*このノートは AI Agent Task Board から自動同期されました。*`);
  lines.push(`*最終同期: ${fmtDate(new Date().toISOString())}*`);

  return lines.join('\n');
}

function isSystemMsg(c) {
  if (!c.content) return false;
  return c.content.includes('📋 ステータスを') ||
         c.content.includes('タスクを開始しました') ||
         c.content.includes('🔁 ブロック解除') ||
         c.author === 'system';
}

// ── メイン ──────────────────────────────────────────────────
function sync() {
  // Vault 検出
  const vaultPath = detectVaultPath();
  if (!vaultPath) {
    console.error('❌ Obsidian vault が見つかりません。');
    console.error('   --vault <path> または 環境変数 OBSIDIAN_VAULT_PATH を設定してください。');
    process.exit(1);
  }
  console.log(`📓 Vault: ${vaultPath}`);

  // Tasks フォルダ
  const tasksDir = path.join(vaultPath, 'AI_Agent_Tasks');
  if (!DRY_RUN) fs.mkdirSync(tasksDir, { recursive: true });

  // tasks.json 読み込み
  if (!fs.existsSync(TASKS_FILE)) { console.log('tasks.json なし'); return; }
  const data  = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
  const tasks = data.tasks || data;
  if (!Array.isArray(tasks) || tasks.length === 0) { console.log('タスクなし'); return; }

  let created = 0, updated = 0, skipped = 0;

  for (const task of tasks) {
    const filename = `${task.id} ${safeFilename(task.title || 'Untitled')}.md`;
    const filepath = path.join(tasksDir, filename);
    const note     = buildNote(task);

    if (DRY_RUN) {
      console.log(`[dry-run] → ${filename}`);
      skipped++;
      continue;
    }

    // 既存ファイルと比較して変更があった場合のみ書き込む
    if (fs.existsSync(filepath)) {
      const existing = fs.readFileSync(filepath, 'utf-8');
      // updated timestamp が変わっていたら更新
      const existingUpdated = (existing.match(/^updated: (.+)$/m) || [])[1];
      const newUpdated      = task.updatedAt ? task.updatedAt.split('T')[0] : '';
      if (existingUpdated === newUpdated && existing.length === note.length) {
        skipped++;
        continue;
      }
      fs.writeFileSync(filepath, note, 'utf-8');
      updated++;
      console.log(`✏️  更新: ${filename}`);
    } else {
      fs.writeFileSync(filepath, note, 'utf-8');
      created++;
      console.log(`✓ 作成: ${filename}`);
    }
  }

  // 削除されたタスクのノートを削除
  if (!DRY_RUN && fs.existsSync(tasksDir)) {
    const taskIds = new Set(tasks.map(t => t.id));
    const files   = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const id = (f.match(/^(T\d+)/) || [])[1];
      if (id && !taskIds.has(id)) {
        fs.unlinkSync(path.join(tasksDir, f));
        console.log(`🗑  削除: ${f}`);
      }
    }
  }

  console.log(`\n完了: 作成 ${created} / 更新 ${updated} / スキップ ${skipped}`);
  if (DRY_RUN) console.log('（dry-run モード: ファイルへの書き込みなし）');
}

sync();
