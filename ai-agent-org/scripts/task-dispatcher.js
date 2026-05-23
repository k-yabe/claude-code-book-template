#!/usr/bin/env node
/**
 * Task Dispatcher
 * Reads context/inbox/ markdown files, creates tasks in tasks/tasks.json,
 * and generates a dispatch report.
 *
 * Usage:
 *   node scripts/task-dispatcher.js
 *   node scripts/task-dispatcher.js --dry-run
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INBOX_DIR = path.join(ROOT, 'context', 'inbox');
const TASKS_FILE = path.join(ROOT, 'tasks', 'tasks.json');
const HANDOFFS_DIR = path.join(ROOT, 'context', 'context', 'ai-handoffs');

const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT_PATH
  || '/Users/kunito/Library/CloudStorage/OneDrive-個人用/10_Work/40_Onsidian/Obsidian';
const OBSIDIAN_TASKS_DIR = path.join(OBSIDIAN_VAULT, 'Tasks');

const DRY_RUN = process.argv.includes('--dry-run');

// Organization routing rules: keyword → organization
const ORG_RULES = [
  { keywords: ['SHIFT AI', 'ShiftAI', 'シフトAI', '法人事業部'], org: 'shift-ai' },
  { keywords: ['OTSUNAGI', 'オツナギ', 'カンファレンス事業', 'オンラインカンファレンス'], org: 'otsunagi' },
  { keywords: ['AKKODiS', 'AKKOiS', 'アッコディス', 'アッコイス', '外資系', '本業'], org: 'akkodis' },
  { keywords: ['プライベート', 'private', '個人', '私用'], org: 'private' },
];

function detectOrganization(content) {
  for (const rule of ORG_RULES) {
    if (rule.keywords.some(k => content.includes(k))) return rule.org;
  }
  return 'private';
}

// Agent routing rules: keyword → assignee + team
// 上から順に評価し、最初にマッチしたルールを使う
const ROUTING_RULES = [
  // --- Leadership チーム ---
  { keywords: ['COOレビュー', '全体レビュー', '成果物確認', '検収'], assignee: 'coo', team: 'leadership' },

  // --- Personal チーム (kunito) ---
  { keywords: ['副業', 'フリーランス', 'キャリア', '転職', '案件探し', '求人', 'スキルアップ', '収入アップ'], assignee: 'career-advisor', team: 'personal' },
  { keywords: ['ジム', '減量', '筋トレ', '運動', 'ダイエット', '健康', '食事', '睡眠', 'プライベート', '生活'], assignee: 'content-director', team: 'content' },

  // --- Research チーム ---
  { keywords: ['データ', 'メトリクス', 'KPI', '集計', 'CSV', '数値分析'], assignee: 'data-analyst', team: 'research' },
  { keywords: ['購入', '比較', '検討', '調査', 'おすすめ', 'リサーチ', '選定', '評価', 'どれがいい', '候補', '導入', '乗り換え'], assignee: 'research-analyst', team: 'research' },

  // --- Engineering チーム ---
  { keywords: ['CI', 'CD', 'GitHub Actions', 'Vercel', 'Docker', 'インフラ自動化', 'デプロイ設定'], assignee: 'devops-engineer', team: 'engineering' },
  { keywords: ['コード', 'バグ', '実装', 'エラー', 'API', 'プログラム'], assignee: 'tech-lead', team: 'engineering' },
  { keywords: ['UI', 'フロントエンド', 'デザイン', 'レイアウト', 'CSS', 'HTML'], assignee: 'frontend-engineer', team: 'engineering' },
  { keywords: ['バックエンド', 'DB', 'データベース', 'サーバー構築', 'クラウド設定'], assignee: 'backend-engineer', team: 'engineering' },
  { keywords: ['品質', 'QA', '検証', 'テスト'], assignee: 'qa-engineer', team: 'engineering' },

  // --- Content チーム ---
  { keywords: ['動画', 'YouTube', 'Shorts', '台本', 'スクリプト', '動画企画'], assignee: 'video-producer', team: 'content' },
  { keywords: ['記事', 'ブログ', 'コンテンツ', '原稿', 'ライティング'], assignee: 'content-director', team: 'content' },

  // --- Business チーム ---
  { keywords: ['収益', 'グロース', 'LTV', 'ランディングページ', 'CVR', 'メルマガ', '収益化'], assignee: 'sales-growth', team: 'business' },
  { keywords: ['マーケ', 'マーケティング', '宣伝', 'SNS', 'プロモ', '集客', '広告'], assignee: 'marketing-director', team: 'business' },
  { keywords: ['戦略', '事業', '方針', 'ピボット', '新規事業'], assignee: 'business-strategist', team: 'business' },
  { keywords: ['契約', '法的', 'リーガル', '規約', '利用規約'], assignee: 'legal-review', team: 'business' },
  { keywords: ['パートナー', 'コラボ', '提携', 'スポンサー', 'タイアップ'], assignee: 'partnership-manager', team: 'business' },
];

function loadTasks() {
  if (!fs.existsSync(TASKS_FILE)) {
    return { version: '1.0', lastUpdated: new Date().toISOString(), tasks: [] };
  }
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
}

function saveTasks(data) {
  if (DRY_RUN) return;
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function nextTaskId(tasks) {
  const nums = tasks.map(t => parseInt(t.id.replace('T', ''), 10)).filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `T${String(max + 1).padStart(3, '0')}`;
}

function detectPriority(content) {
  if (/緊急|至急|P0|クリティカル/i.test(content)) return 'P0';
  if (/重要|P1|高優先/i.test(content)) return 'P1';
  if (/P3|低優先|いつか/i.test(content)) return 'P3';
  return 'P2';
}

function routeTask(content) {
  for (const rule of ROUTING_RULES) {
    if (rule.keywords.some(k => content.includes(k))) {
      return { assignee: rule.assignee, team: rule.team };
    }
  }
  return { assignee: 'research-analyst', team: 'research' };
}

function parseInboxFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  const title = lines[0].replace(/^#+\s*/, '').trim() || path.basename(filePath, '.md');
  const description = lines.slice(1).join('\n').trim();
  return { title, description, raw };
}

function processInbox() {
  if (!fs.existsSync(INBOX_DIR)) {
    console.log('inbox/ が見つかりません');
    return;
  }

  const files = fs.readdirSync(INBOX_DIR).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  if (files.length === 0) {
    console.log('inbox/ に処理するファイルはありません');
    return;
  }

  const data = loadTasks();
  const report = { created: [], errors: [] };

  // 既に処理済みのsourceFileを記録（重複防止）
  const processedFiles = new Set(data.tasks.map(t => t.sourceFile).filter(Boolean));

  for (const file of files) {
    if (processedFiles.has(file)) {
      console.log(`スキップ: ${file} （処理済み）`);
      continue;
    }
    const filePath = path.join(INBOX_DIR, file);
    try {
      const { title, description, raw } = parseInboxFile(filePath);
      const priority = detectPriority(raw);
      const { assignee, team } = routeTask(raw);
      const id = nextTaskId(data.tasks);
      const now = new Date().toISOString();

      const organization = detectOrganization(raw);
      const task = {
        id,
        title,
        description,
        status: 'new-assigned',
        priority,
        assignee,
        assigneeType: 'ai',
        team,
        organization,
        createdAt: now,
        updatedAt: now,
        comments: [{
          author: 'task-dispatcher',
          content: `inbox/${file} から自動生成`,
          timestamp: now,
        }],
        blockedReason: '',
        tags: [],
        sourceFile: file,
      };

      data.tasks.push(task);
      report.created.push({ id, title, assignee, team, file });
      writeObsidianTask(task, raw);
      console.log(`✓ ${id}: "${title}" → ${assignee} (${team})`);
    } catch (err) {
      report.errors.push({ file, error: err.message });
      console.error(`✗ ${file}: ${err.message}`);
    }
  }

  saveTasks(data);
  writeDispatchReport(report);

  console.log(`\n完了: ${report.created.length}件のタスクを作成`);
  if (DRY_RUN) console.log('（dry-run モード: ファイルへの書き込みなし）');
}

function writeObsidianTask(task, raw) {
  if (DRY_RUN) return;
  try {
    if (!fs.existsSync(OBSIDIAN_TASKS_DIR)) fs.mkdirSync(OBSIDIAN_TASKS_DIR, { recursive: true });
    const safeName = task.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 40);
    const fileName = `${task.id}-${safeName}.md`;
    const content = [
      '---',
      `id: ${task.id}`,
      `title: "${task.title}"`,
      `assignee: ${task.assignee}`,
      `team: ${task.team}`,
      `status: new-assigned`,
      `priority: ${task.priority}`,
      `organization: ${task.organization}`,
      `created: ${task.createdAt.split('T')[0]}`,
      '---',
      '',
      `# [${task.id}] ${task.title}`,
      '',
      `**担当**: ${task.assignee}  `,
      `**チーム**: ${task.team}  `,
      `**優先度**: ${task.priority}  `,
      `**ステータス**: 🔲 new-assigned  `,
      `**組織**: ${task.organization}  `,
      '',
      '## 依頼内容',
      '',
      raw,
      '',
      '## レポート',
      '',
      '（完了後に追記）',
    ].join('\n');
    fs.writeFileSync(path.join(OBSIDIAN_TASKS_DIR, fileName), content, 'utf-8');
    console.log(`📓 Obsidian: Tasks/${fileName}`);
  } catch (err) {
    console.warn(`⚠️  Obsidian書き込み失敗（スキップ）: ${err.message}`);
  }
}

function writeDispatchReport(report) {
  if (DRY_RUN) return;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const reportPath = path.join(HANDOFFS_DIR, `dispatch-${dateStr}.md`);

  const lines = [
    `# タスクディスパッチレポート ${dateStr}`,
    '',
    `- 実行日時: ${now.toLocaleString('ja-JP')}`,
    `- 作成タスク数: ${report.created.length}`,
    '',
    '## 作成されたタスク',
    '',
    ...report.created.map(t => `- ${t.id}: "${t.title}" → ${t.assignee} (${t.team})`),
  ];

  if (report.errors.length > 0) {
    lines.push('', '## エラー', '', ...report.errors.map(e => `- ${e.file}: ${e.error}`));
  }

  fs.mkdirSync(HANDOFFS_DIR, { recursive: true });
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
  console.log(`レポート: ${reportPath}`);
}

// tasks.json を常に GitHub の最新版で上書き（競合を完全回避）
try {
  execSync('git fetch origin main', { cwd: ROOT });
  execSync('git checkout origin/main -- tasks/tasks.json', { cwd: ROOT });
} catch (err) {
  console.error('git fetch 失敗（続行）:', err.message);
}

processInbox();

// 変更をpush
if (!DRY_RUN) {
  try {
    execSync('git add tasks/tasks.json context/context/ai-handoffs/', { cwd: ROOT });
    execSync('git commit -m "bot: inbox タスク自動生成"', { cwd: ROOT });
    try {
      execSync('git push', { cwd: ROOT });
    } catch {
      execSync('git fetch origin main', { cwd: ROOT });
      execSync('git rebase origin/main', { cwd: ROOT });
      execSync('git push', { cwd: ROOT });
    }
    console.log('✓ GitHubへのプッシュ完了');
  } catch (err) {
    if (!err.message.includes('nothing to commit')) {
      console.error('git push 失敗:', err.message);
    }
  }
}
