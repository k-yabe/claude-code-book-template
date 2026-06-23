#!/usr/bin/env node
/**
 * Morning Standup Report Generator
 * Reads tasks.json and generates a daily standup report.
 *
 * Usage:
 *   node scripts/morning-standup.js
 *   node scripts/morning-standup.js --output report.md
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TASKS_FILE = path.join(ROOT, 'tasks', 'tasks.json');
const HANDOFFS_DIR = path.join(ROOT, 'context', 'context', 'ai-handoffs');

const OUTPUT_FILE = (() => {
  const idx = process.argv.indexOf('--output');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

function loadTasks() {
  if (!fs.existsSync(TASKS_FILE)) return { tasks: [] };
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
}

function isRecent(dateStr, hoursAgo = 24) {
  const d = new Date(dateStr);
  return (Date.now() - d.getTime()) < hoursAgo * 60 * 60 * 1000;
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'unknown';
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

function generateReport(data) {
  const tasks = data.tasks || [];
  const now = new Date();
  const dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const completed = tasks.filter(t => t.status === 'done' && isRecent(t.updatedAt));
  const inProgress = tasks.filter(t => t.status === 'in-progress');
  const blocked = tasks.filter(t => t.status === 'blocked');
  const newTasks = tasks.filter(t => t.status === 'new-assigned');

  const hasActivity = completed.length > 0 || inProgress.length > 0 || blocked.length > 0 || newTasks.length > 0;
  const statusPrefix = hasActivity ? '' : '【更新なし】';

  const byTeam = groupBy(tasks.filter(t => t.status !== 'done'), 'team');
  const teamNames = { engineering: 'エンジニアリング', content: 'コンテンツ', business: 'ビジネス', infrastructure: 'インフラ運用' };

  const lines = [
    `# ${statusPrefix}朝会レポート — ${dateStr}`,
    '',
    '## サマリー',
    '',
    `| ステータス | 件数 |`,
    `|------------|------|`,
    `| 昨夜完了   | ${completed.length} |`,
    `| 進行中     | ${inProgress.length} |`,
    `| ブロック中 | ${blocked.length} |`,
    `| 未着手     | ${newTasks.length} |`,
    `| 合計       | ${tasks.length} |`,
    '',
  ];

  if (completed.length > 0) {
    lines.push('## ✅ 昨夜完了したタスク', '');
    completed.forEach(t => lines.push(`- **${t.id}** ${t.title} _(${t.assignee})_`));
    lines.push('');
  }

  if (blocked.length > 0) {
    lines.push('## 🔴 要注意: ブロック中のタスク', '');
    blocked.forEach(t => {
      lines.push(`- **${t.id}** ${t.title} _(${t.assignee})_`);
      if (t.blockedReason) lines.push(`  - 理由: ${t.blockedReason}`);
    });
    lines.push('');
  }

  if (inProgress.length > 0) {
    lines.push('## 🔄 進行中のタスク', '');
    const byAssignee = groupBy(inProgress, 'assignee');
    Object.entries(byAssignee).forEach(([assignee, ts]) => {
      lines.push(`**${assignee}**`);
      ts.forEach(t => lines.push(`  - ${t.id}: ${t.title} [${t.priority}]`));
    });
    lines.push('');
  }

  if (newTasks.length > 0) {
    lines.push('## 📋 本日の新着タスク（未着手）', '');
    const sorted = [...newTasks].sort((a, b) => a.priority.localeCompare(b.priority));
    sorted.forEach(t => {
      lines.push(`- **${t.id}** [${t.priority}] ${t.title} → ${t.assignee} (${teamNames[t.team] || t.team})`);
    });
    lines.push('');
  }

  lines.push('## チーム別状況', '');
  Object.entries(teamNames).forEach(([team, name]) => {
    const teamTasks = byTeam[team] || [];
    if (teamTasks.length === 0) return;
    const ip = teamTasks.filter(t => t.status === 'in-progress').length;
    const na = teamTasks.filter(t => t.status === 'new-assigned').length;
    const bl = teamTasks.filter(t => t.status === 'blocked').length;
    lines.push(`### ${name}`);
    lines.push(`未着手: ${na} / 進行中: ${ip} / ブロック: ${bl}`);
    lines.push('');
  });

  lines.push('---');
  lines.push(`_生成: ${now.toISOString()} by morning-standup.js_`);

  return lines.join('\n');
}

// GitHub 最新版を取得
try {
  execSync('git fetch origin main', { cwd: ROOT });
  execSync('git checkout origin/main -- tasks/tasks.json', { cwd: ROOT });
} catch (err) {
  console.error('git fetch 失敗（続行）:', err.message);
}

const data = loadTasks();
const report = generateReport(data);

if (OUTPUT_FILE) {
  fs.writeFileSync(OUTPUT_FILE, report, 'utf-8');
  console.log(`レポートを保存: ${OUTPUT_FILE}`);
} else {
  const dateStr = new Date().toISOString().split('T')[0];
  const outPath = path.join(HANDOFFS_DIR, `standup-${dateStr}.md`);
  fs.mkdirSync(HANDOFFS_DIR, { recursive: true });
  fs.writeFileSync(outPath, report, 'utf-8');
  console.log(report);
  console.log(`\nレポートを保存: ${outPath}`);

  // レポートをGitHubへ push
  try {
    execSync(`git add "${outPath}"`, { cwd: ROOT });
    execSync(`git commit -m "bot: 朝会レポート ${dateStr}"`, { cwd: ROOT });
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
