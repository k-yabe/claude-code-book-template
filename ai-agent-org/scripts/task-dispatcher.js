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
const ROUTING_RULES = [
  { keywords: ['コード', 'バグ', '実装', 'エラー', 'テスト', 'デプロイ', 'API'], assignee: 'tech-lead', team: 'engineering' },
  { keywords: ['UI', 'フロントエンド', 'デザイン', 'レイアウト', 'CSS'], assignee: 'frontend-engineer', team: 'engineering' },
  { keywords: ['バックエンド', 'DB', 'データベース', 'サーバー', 'インフラ'], assignee: 'backend-engineer', team: 'engineering' },
  { keywords: ['品質', 'QA', '検証', 'チェック'], assignee: 'qa-engineer', team: 'engineering' },
  { keywords: ['記事', 'ブログ', '動画', 'スクリプト', '台本', 'コンテンツ'], assignee: 'content-director', team: 'content' },
  { keywords: ['マーケ', 'マーケティング', '宣伝', 'SNS', 'プロモ'], assignee: 'marketing-director', team: 'business' },
  { keywords: ['戦略', 'ビジネス', '事業', '収益', '方針'], assignee: 'business-strategist', team: 'business' },
  { keywords: ['契約', '法的', 'リーガル', '規約'], assignee: 'legal-review', team: 'business' },
  { keywords: ['案件', 'パートナー', 'コラボ', '提携'], assignee: 'partnership-manager', team: 'business' },
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
  return { assignee: 'tech-lead', team: 'engineering' };
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

  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
  console.log(`レポート: ${reportPath}`);
}

// tasks.json を常に GitHub の最新版で上書き（競合を完全回避）
try {
  execSync('git fetch origin main', { cwd: ROOT });
  execSync('git checkout origin/main -- tasks/tasks.json scripts/', { cwd: ROOT });
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
