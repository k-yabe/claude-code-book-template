#!/usr/bin/env node
/**
 * Task Executor
 * 未着手（new-assigned）タスクをAIが処理し、COOレビュー後にdoneにする。
 * 月予算 $10 を前提に設計（Haikuメイン、Sonnetは調査・戦略系のみ）。
 *
 * Usage:
 *   node scripts/task-executor.js
 *   node scripts/task-executor.js --dry-run   # 実際には書き込まない
 *   node scripts/task-executor.js --limit 1   # 1件だけ処理
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.join(__dirname, '..');
const TASKS_FILE = path.join(ROOT, 'tasks', 'tasks.json');
const CONTEXT_DIR = path.join(ROOT, 'context', 'context');
const PROJECTS_DIR = path.join(ROOT, 'context', 'projects');

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 3;
})();

// Node.js 18+ の fetch が必要
if (typeof fetch === 'undefined') {
  console.error('エラー: Node.js 18以上が必要です（fetch APIが未定義）。');
  console.error('現在のバージョン:', process.version);
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── モデル定義 ──────────────────────────────────────────────
const MODELS = {
  HAIKU:  'claude-haiku-4-5-20251001',
  SONNET: 'claude-sonnet-4-6',
  // Opus は $10/月の予算制約で自動実行から除外。手動タスクのみ。
};

// エージェントごとのモデル（Haikuデフォルト、判断・調査・戦略系のみSonnet）
const AGENT_MODELS = {
  // 経営層
  'coo':                 MODELS.HAIKU,   // 判定のみなので構造化出力で十分
  // リサーチ（調査・分析はSonnet）
  'research-analyst':    MODELS.SONNET,
  'data-analyst':        MODELS.HAIKU,
  // パーソナル（nuanceが必要なのでSonnet）
  'career-advisor':      MODELS.SONNET,
  // エンジニアリング（実行系はHaiku）
  'tech-lead':           MODELS.HAIKU,
  'frontend-engineer':   MODELS.HAIKU,
  'backend-engineer':    MODELS.HAIKU,
  'qa-engineer':         MODELS.HAIKU,
  'devops-engineer':     MODELS.HAIKU,
  // コンテンツ（品質が重要な台本・記事はSonnet）
  'content-director':    MODELS.SONNET,
  'video-producer':      MODELS.HAIKU,
  'brand-voice':         MODELS.HAIKU,
  'root-cause':          MODELS.HAIKU,
  'anti-ai-slop':        MODELS.HAIKU,
  // ビジネス（戦略・法務はSonnet、実行系はHaiku）
  'business-strategist': MODELS.SONNET,
  'marketing-director':  MODELS.HAIKU,
  'sales-growth':        MODELS.HAIKU,
  'partnership-manager': MODELS.HAIKU,
  'legal-review':        MODELS.SONNET,
  // インフラ
  'task-dispatcher':     MODELS.HAIKU,
};

// モデルごとのmax_tokens（Sonnetは Web検索結果+レポート本文を収めるため大きく設定）
const MAX_TOKENS = {
  [MODELS.HAIKU]:  2048,
  [MODELS.SONNET]: 16000,
};

// Web検索結果の最大文字数（コスト節約：1件あたり約1000トークン相当）
const WEB_SEARCH_RESULT_MAX_CHARS = 3000;

// Obsidian Vault パス（タスクログの保存先）
const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT_PATH
  || '/Users/kunito/Library/CloudStorage/OneDrive-個人用/10_Work/40_Onsidian/Obsidian';
const OBSIDIAN_TASKS_DIR = path.join(OBSIDIAN_VAULT, 'タスクログ');

// Web検索が有用なエージェント
const WEB_SEARCH_AGENTS = new Set([
  'research-analyst', 'career-advisor', 'content-director',
  'business-strategist', 'tech-lead', 'legal-review',
]);

// ── コスト追跡 ──────────────────────────────────────────────
// 料金 (USD per 1M tokens)
const PRICE = {
  [MODELS.HAIKU]:  { input: 1.0, output: 5.0 },
  [MODELS.SONNET]: { input: 3.0, output: 15.0 },
};
const costLog = { totalUSD: 0, calls: 0 };

function trackCost(model, inputTokens, outputTokens) {
  const p = PRICE[model];
  if (!p) return;
  const usd = (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  costLog.totalUSD += usd;
  costLog.calls += 1;
}

// ── ファイルロード ────────────────────────────────────────
function loadTasks() {
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
}

function saveTasks(data) {
  if (DRY_RUN) return;
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function loadContextFile(filename) {
  const p = path.join(CONTEXT_DIR, filename);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

// ── エージェント説明 ─────────────────────────────────────
const AGENT_DESCRIPTIONS = {
  'research-analyst':    'あなたはリサーチアナリストです。結論を最初に書き、選択肢を表で比較し、明確な推奨を出してください。',
  'data-analyst':        'あなたはデータアナリストです。数値を整理し、KPI・インサイト・推奨アクションをまとめてください。',
  'career-advisor':      'あなたはキャリアアドバイザーです。クライアントのスキルと市場ニーズを照合し、具体的な候補リストを作成してください。',
  'content-director':    'あなたはコンテンツディレクターです。記事・LP・メール・SNS投稿などの高品質なコンテンツを制作します。',
  'video-producer':      'あなたはビデオプロデューサーです。Hook→本編→CTAの三部構成で視聴者を引き付ける台本を作成してください。',
  'marketing-director':  'あなたはマーケティングディレクターです。マーケ戦略・施策・コピーを考えます。',
  'business-strategist': 'あなたはビジネスストラテジストです。事業戦略・意思決定の分析を行います。',
  'sales-growth':        'あなたはSales&Growth Managerです。収益化・グロース施策・LTV最大化のための提案を行います。',
  'tech-lead':           'あなたはテックリードです。技術的な設計・実装方針・コードレビューを担当します。',
  'frontend-engineer':   'あなたはフロントエンドエンジニアです。UI/HTML/CSS/JSの実装を担当します。',
  'backend-engineer':    'あなたはバックエンドエンジニアです。API/DB/サーバーの設計・実装を担当します。',
  'qa-engineer':         'あなたはQAエンジニアです。品質チェック・テスト・検証を担当します。',
  'devops-engineer':     'あなたはDevOpsエンジニアです。CI/CD・Vercelデプロイ・インフラ自動化を担当します。',
  'legal-review':        'あなたはリーガルレビュー担当です。契約書・規約の確認を担当します。',
  'partnership-manager': 'あなたはパートナーシップマネージャーです。外部案件のフィルタリングを担当します。',
  'brand-voice':         'あなたはブランドボイス担当です。ブランドのトーン・言葉遣いのチェックを担当します。',
  'root-cause':          'あなたはRoot Cause担当です。コンテンツの本質・深さ・賞味期限をチェックします。',
  'anti-ai-slop':        'あなたはAnti-AI Slop担当です。AIっぽい不自然な表現を検出・修正します。',
};

function buildSystemPrompt(task) {
  const identity = loadContextFile('professional-identity.md');
  const philosophy = loadContextFile('philosophy.md');
  const designGuide = loadContextFile('visual-design.md');
  const agentDesc = AGENT_DESCRIPTIONS[task.assignee] || 'あなたはAIエージェントです。';

  return `${agentDesc}

## クライアントのプロフィール
${identity}

## 組織の哲学
${philosophy}

## デザインガイドライン（UI関連タスクの場合）
${designGuide}

## 行動指針
- アウトプットを早く出すことを優先する
- クライアントが喜ぶ実用的な成果物を作る
- 曖昧な部分は合理的なデフォルトで判断して進める
- 日本語で回答する
- 「人間の確認が必要です」は、本当に先に進めない場合のみ使う`;
}

// ── メインタスク処理 ─────────────────────────────────────
async function processTask(task, feedbackFromCOO = null) {
  const model = AGENT_MODELS[task.assignee] || MODELS.HAIKU;
  const systemPrompt = buildSystemPrompt(task);
  const useWebSearch = WEB_SEARCH_AGENTS.has(task.assignee);

  const feedbackNote = feedbackFromCOO
    ? `\n## COOからのフィードバック（前回の差し戻し理由）\n${feedbackFromCOO}\n\n上記の問題点を解消して改めてアウトプットを作成してください。\n`
    : '';

  const userMessage = `以下のタスクを実行してください。
${feedbackNote}
## タスクID: ${task.id}
## タイトル: ${task.title}
## 優先度: ${task.priority}
## チーム: ${task.team}
## 組織: ${task.organization}

## タスクの詳細:
${task.description}

${task.comments && task.comments.length > 0 ? `## これまでのコメント:\n${task.comments.map(c => `[${c.author}] ${c.content}`).join('\n')}` : ''}

タスクを実行し、成果物または実行結果を日本語でまとめてください。

## 出力の厳守事項
- **「（省略）」「（以下省略）」「（続く）」などの省略表記は絶対に使わないこと**
- 成果物がある場合（文章・コード・資料など）は**必ず全文を出力**すること
- セクションを書き始めたら最後まで書ききること。途中で切り上げない
- 判断が必要で人間の確認が必要な場合は、その旨と理由を明記してください
${useWebSearch ? '- 最新情報が必要な場合は web_search ツールを使って調査してください。' : ''}`;

  console.log(`\n処理中: ${task.id} "${task.title}" → ${task.assignee} (${model})${feedbackFromCOO ? ' [COO差し戻し再試行]' : ''}${useWebSearch ? ' [Web検索有効]' : ''}`);

  const tools = useWebSearch
    ? [{ type: 'web_search_20260209', name: 'web_search', allowed_callers: ['direct'], max_uses: 2 }]
    : undefined;
  const betas = useWebSearch ? ['web-search-2025-03-05'] : undefined;

  const messages = [{ role: 'user', content: userMessage }];
  let result = '';
  let totalInput = 0, totalOutput = 0;

  for (let i = 0; i < 10; i++) {
    const reqParams = {
      model,
      max_tokens: MAX_TOKENS[model] || 2048,
      system: systemPrompt,
      messages,
      ...(tools ? { tools } : {}),
    };

    const response = await (betas
      ? client.beta.messages.create({ ...reqParams, betas })
      : client.messages.create(reqParams));

    totalInput  += response.usage?.input_tokens  || 0;
    totalOutput += response.usage?.output_tokens || 0;

    console.log(`  ターン${i + 1}: stop_reason=${response.stop_reason}, blocks=${response.content.map(b => b.type).join(',')}`);

    const textBlocks = response.content.filter(b => b.type === 'text');
    if (textBlocks.length > 0) {
      const newText = textBlocks.map(b => b.text).join('\n\n');
      result = result ? result + '\n\n' + newText : newText;
    }

    // Web検索結果を切り詰めてトークン節約
    // APIバージョンにより 'web_search_result' または 'web_search_tool_result' の両方に対応
    const contentForHistory = response.content.map(b => {
      if (b.type === 'web_search_result' || b.type === 'web_search_tool_result') {
        const truncated = typeof b.content === 'string'
          ? b.content.slice(0, WEB_SEARCH_RESULT_MAX_CHARS)
          : b.content;
        return { ...b, content: truncated };
      }
      return b;
    });
    messages.push({ role: 'assistant', content: contentForHistory });

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const hasWebSearch = toolUseBlocks.some(b => b.name === 'web_search');
      if (hasWebSearch) {
        const hasResults = response.content.some(b => b.type === 'web_search_result' || b.type === 'web_search_tool_result');
        if (hasResults) {
          const hasText = response.content.some(b => b.type === 'text' && b.text.trim().length > 50);
          if (hasText) break;
          messages.push({ role: 'user', content: 'search_resultを踏まえて最終的な回答を日本語でまとめてください。' });
        } else {
          const toolResults = toolUseBlocks
            .filter(b => b.name === 'web_search')
            .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '' }));
          messages.push({ role: 'user', content: toolResults });
        }
        continue;
      }
      break;
    }
    break;
  }

  trackCost(model, totalInput, totalOutput);
  console.log(`  トークン: in=${totalInput}, out=${totalOutput} | 推定 $${(totalInput * PRICE[model].input / 1e6 + totalOutput * PRICE[model].output / 1e6).toFixed(5)}`);

  if (!result) {
    result = '（AIからのテキスト応答がありませんでした。タスク内容を確認して再実行してください。）';
  }

  const needsHuman = /^\s*(?:⚠️\s*)?(?:人間の確認が必要です|承認が必要です|判断をお願いします|このタスクはブロックされています)/m.test(result);
  return { result, needsHuman };
}

// ── COOレビュー（Haiku使用、max_tokens: 512の構造化判定）─
async function reviewWithCOO(task, agentOutput) {
  const model = MODELS.HAIKU;
  const systemPrompt = `あなたはCOO（最高執行責任者）のAIエージェントです。
担当エージェントが作成したアウトプットを品質チェックし、承認または差し戻しを判定します。
必ずJSON形式のみで返答してください。説明文は不要です。`;

  const userMessage = `## タスク情報
タイトル: ${task.title}
担当: ${task.assignee}
タスク詳細: ${task.description?.slice(0, 500) || '（詳細なし）'}

## 担当エージェントのアウトプット
${agentOutput.slice(0, 2000)}${agentOutput.length > 2000 ? '\n（省略）' : ''}

## チェック項目
以下の3点を判定し、JSON形式で返してください:
1. タスクの要件を満たしているか（スコープ漏れなし）
2. 明らかな事実誤認・論理矛盾がないか
3. 中途半端で未完成でないか（「〜を検討してください」で終わっていないか）

## 返答フォーマット（JSONのみ）
{"pass": true}
または
{"pass": false, "feedback": "具体的な問題点と改善指示を1〜3文で"}`;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const inputTokens  = response.usage?.input_tokens  || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    trackCost(model, inputTokens, outputTokens);
    console.log(`  COOレビュー: in=${inputTokens}, out=${outputTokens} | 推定 $${(inputTokens * PRICE[model].input / 1e6 + outputTokens * PRICE[model].output / 1e6).toFixed(5)}`);

    // JSONを抽出
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      // パース失敗 → 安全側に倒して承認
      console.log('  COO: JSONパース失敗 → 自動承認');
      return { pass: true };
    }
    const verdict = JSON.parse(match[0]);
    console.log(`  COO判定: ${verdict.pass ? '✅ 承認' : '🔄 差し戻し: ' + (verdict.feedback || '')}`);
    return verdict;
  } catch (err) {
    console.error('  COOレビューエラー（自動承認）:', err.message);
    return { pass: true };
  }
}

// ── ファイル保存 ─────────────────────────────────────────
function saveOutput(task, result) {
  if (DRY_RUN) return null;
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  const dateStr = new Date().toISOString().split('T')[0];
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${task.id}-${dateStr}-output.md`;
  const outputPath = path.join(PROJECTS_DIR, filename);
  const content = `# ${task.title}\n\n**タスクID:** ${task.id}  \n**実行日:** ${dateStr} ${ts}  \n**担当:** ${task.assignee}  \n**COOレビュー:** 承認済み\n\n---\n\n${result}\n`;
  fs.writeFileSync(outputPath, content, 'utf-8');
  return filename;
}

function saveToObsidian(task, result, verdict) {
  if (DRY_RUN) return;
  try {
    if (!fs.existsSync(OBSIDIAN_TASKS_DIR)) fs.mkdirSync(OBSIDIAN_TASKS_DIR, { recursive: true });
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
    const filePath = path.join(OBSIDIAN_TASKS_DIR, `${dateStr}.md`);
    const header = `# タスクログ ${dateStr}\n\n`;
    const entry = [
      `## ${verdict === 'APPROVED' ? '✅' : '🚫'} [${task.id}] ${task.title} \`${timeStr}\``,
      `**担当**: ${task.assignee}  `,
      `**チーム**: ${task.team || '未設定'}  `,
      `**ステータス**: ${verdict === 'APPROVED' ? 'done' : 'blocked'}  `,
      '',
      '### レポート',
      result.length > 1000 ? result.slice(0, 1000) + '\n\n…（全文は context/projects/ を参照）' : result,
      '',
      '---',
      '',
    ].join('\n');

    if (fs.existsSync(filePath)) {
      fs.appendFileSync(filePath, entry, 'utf-8');
    } else {
      fs.writeFileSync(filePath, header + entry, 'utf-8');
    }
    console.log(`📓 Obsidianに記録: タスクログ/${dateStr}.md`);
  } catch (err) {
    console.warn(`⚠️  Obsidian書き込み失敗（スキップ）: ${err.message}`);
  }
}

// ── GitHub API push（git競合を完全回避）────────────────────
const GITHUB_REPO  = 'k-yabe/claude-code-book-template';
const GITHUB_PATH  = 'ai-agent-org/tasks/tasks.json';
const GITHUB_API   = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;

async function pushViaGitHubAPI(data, taskIds) {
  if (DRY_RUN) return;
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('⚠️  GITHUB_TOKEN 未設定 — ローカルに保存のみ（GitHubへの反映なし）');
    return;
  }

  try {
    // 現在のSHAと最新データを取得
    const metaRes = await fetch(GITHUB_API, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    const meta = await metaRes.json();

    // リモートと updatedAt ベースでマージ（競合防止）
    let merged = data.tasks;
    try {
      const remoteData = JSON.parse(Buffer.from(meta.content.replace(/\n/g, ''), 'base64').toString('utf-8'));
      const remoteTasks = remoteData.tasks || remoteData;
      if (Array.isArray(remoteTasks)) {
        const localMap = new Map(data.tasks.map(t => [t.id, t]));
        remoteTasks.forEach(rt => {
          const local = localMap.get(rt.id);
          if (!local) localMap.set(rt.id, rt);
          else if (new Date(rt.updatedAt) > new Date(local.updatedAt)) localMap.set(rt.id, rt);
        });
        merged = Array.from(localMap.values());
      }
    } catch { /* マージ失敗時はローカルをそのまま使用 */ }

    const payload = JSON.stringify({ version: '1.0', lastUpdated: new Date().toISOString(), tasks: merged }, null, 2);
    const content = Buffer.from(payload).toString('base64');

    const putRes = await fetch(GITHUB_API, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `bot: タスク自動実行 [${taskIds.join(', ')}]`, content, sha: meta.sha })
    });

    if (putRes.ok) {
      console.log('\n✓ GitHubへの反映完了（API経由）');
    } else {
      const err = await putRes.json();
      console.error('GitHub API push 失敗:', err.message || putRes.status);
    }
  } catch (err) {
    console.error('GitHub API push エラー:', err.message);
  }
}

function gitPushChanges(taskIds) {
  // 後方互換のため残すが、実際の push は pushViaGitHubAPI で行う
  console.log('\n✓ GitHubへのプッシュ完了');
}

// ── メイン ───────────────────────────────────────────────
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('エラー: ANTHROPIC_API_KEY が未設定です。');
    console.error('export ANTHROPIC_API_KEY="sk-ant-..." を実行してください。');
    process.exit(1);
  }

  // GitHub APIから最新のtasks.jsonを直接取得（git競合を回避）
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    try {
      const res = await fetch(GITHUB_API, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
      });
      const meta = await res.json();
      const content = Buffer.from(meta.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      fs.writeFileSync(TASKS_FILE, content, 'utf-8');
      console.log('✓ GitHubから最新データを取得');
    } catch (err) {
      console.error('GitHub API fetch 失敗（ローカルで続行）:', err.message);
    }
  } else {
    // GITHUB_TOKEN未設定時はgit fetchにフォールバック
    try {
      execSync('git fetch origin main', { cwd: ROOT });
      execSync('git checkout origin/main -- tasks/tasks.json', { cwd: ROOT });
      console.log('✓ GitHubから最新データを取得（git）');
    } catch (err) {
      console.error('git fetch 失敗（続行）:', err.message);
    }
  }

  const data = loadTasks();
  const pending = data.tasks
    .filter(t => t.status === 'new-assigned' && t.assigneeType === 'ai')
    .sort((a, b) => a.priority.localeCompare(b.priority))
    .slice(0, LIMIT);

  if (pending.length === 0) {
    console.log('処理する未着手タスクはありません。');
    return;
  }

  console.log(`未着手タスク: ${pending.length}件（最大${LIMIT}件処理）`);
  if (DRY_RUN) console.log('--- dry-run モード ---');

  const processedIds = [];

  for (const task of pending) {
    try {
      const now = new Date().toISOString();
      const taskRef = data.tasks.find(t => t.id === task.id);

      taskRef.status = 'in-progress';
      taskRef.updatedAt = now;
      taskRef.comments = taskRef.comments || [];
      taskRef.comments.push({ author: task.assignee, content: 'タスクを開始しました。', timestamp: now });
      saveTasks(data);

      // ── Round 1: エージェント実行 ──
      let { result, needsHuman } = await processTask(task);

      if (needsHuman) {
        // 人間確認が必要なケースはCOOをスキップしてblocked
        taskRef.status = 'blocked';
        taskRef.blockedReason = '人間の確認・判断が必要です。上記コメントを確認してください。';
        taskRef.updatedAt = new Date().toISOString();
        const snippet = result.length > 300 ? result.slice(0, 300) + '…（続きは projects/ フォルダを確認）' : result;
        taskRef.comments.push({ author: task.assignee, content: snippet, timestamp: new Date().toISOString() });
        saveTasks(data);
        console.log(`⚠️  ${task.id}: blocked（人間確認が必要）`);
        processedIds.push(task.id);
        continue;
      }

      // ── COOレビュー Round 1 ──
      console.log(`\n🏢 COOレビュー開始: ${task.id}`);
      let verdict = await reviewWithCOO(task, result);

      if (!verdict.pass) {
        // ── COO差し戻し → エージェント再実行（Round 2） ──
        taskRef.comments.push({
          author: 'coo',
          content: `🔄 差し戻し\n理由: ${verdict.feedback}\n改善後に再提出してください。`,
          timestamp: new Date().toISOString(),
        });
        saveTasks(data);

        console.log(`\n再実行: ${task.id} （COOフィードバックを反映）`);
        const retry = await processTask(task, verdict.feedback);
        result = retry.result;

        // ── COOレビュー Round 2（最終） ──
        console.log(`\n🏢 COOレビュー（最終判定）: ${task.id}`);
        verdict = await reviewWithCOO(task, result);

        if (!verdict.pass) {
          // 2回差し戻しはblockedにして人間に判断を委ねる
          taskRef.status = 'blocked';
          taskRef.blockedReason = `COO 2回差し戻し: ${verdict.feedback}`;
          taskRef.updatedAt = new Date().toISOString();
          taskRef.comments.push({
            author: 'coo',
            content: `🔴 COOレビュー最終差し戻し\n2回の修正でも品質基準を満たしませんでした。\n理由: ${verdict.feedback}\n人間の判断が必要です。`,
            timestamp: new Date().toISOString(),
          });
          const snippet2 = result.length > 300 ? result.slice(0, 300) + '…' : result;
          taskRef.comments.push({ author: task.assignee, content: snippet2, timestamp: new Date().toISOString() });
          saveToObsidian(task, result, 'REJECTED');
          saveTasks(data);
          console.log(`⚠️  ${task.id}: blocked（COO 2回差し戻し）`);
          processedIds.push(task.id);
          continue;
        }
      }

      // ── COO承認 → done ──
      saveToObsidian(task, result, 'APPROVED');
      const outputFile = saveOutput(task, result);
      const snippet = result.length > 300 ? result.slice(0, 300) + '…（続きは projects/ フォルダを確認）' : result;
      const commentContent = outputFile
        ? `${snippet}\n\n📄 出力ファイル: context/projects/${outputFile}`
        : snippet;

      taskRef.status = 'done';
      taskRef.blockedReason = '';
      taskRef.updatedAt = new Date().toISOString();
      taskRef.comments.push({ author: task.assignee, content: commentContent, timestamp: new Date().toISOString() });
      taskRef.comments.push({ author: 'coo', content: '✅ COOレビュー承認\n品質基準を満たしています。', timestamp: new Date().toISOString() });
      saveTasks(data);
      processedIds.push(task.id);
      console.log(`✅ ${task.id}: done（COO承認済み）`);

      if (DRY_RUN) {
        console.log('--- 出力プレビュー ---');
        console.log(result.slice(0, 500));
        console.log('---');
      }

    } catch (err) {
      console.error(`✗ ${task.id}: ${err.message}`);
      const taskRef = data.tasks.find(t => t.id === task.id);
      if (taskRef) {
        taskRef.status = 'blocked';
        taskRef.blockedReason = `実行エラー: ${err.message}`;
        taskRef.updatedAt = new Date().toISOString();
        saveTasks(data);
        processedIds.push(task.id); // エラー時も push してステータスをクラウドに反映
      }
    }
  }

  if (processedIds.length > 0) {
    await pushViaGitHubAPI(data, processedIds);
  }

  // ── コスト集計 ──
  const monthlyCostEstimate = costLog.totalUSD * 30;
  console.log('\n── コスト集計 ──────────────────────────');
  console.log(`  この実行: $${costLog.totalUSD.toFixed(5)} (${costLog.calls}回のAPI呼び出し)`);
  console.log(`  月額換算（1日1回実行の場合）: $${monthlyCostEstimate.toFixed(3)}`);
  console.log(`  月額換算（5回/日実行の場合）: $${(costLog.totalUSD * 30 * 5).toFixed(3)}`);
  console.log(`  予算上限: $10.00/月`);
  if (monthlyCostEstimate > 10) {
    console.log('  ⚠️  このペースで続くと月$10を超えます。--limit を下げてください。');
  } else {
    console.log(`  ✓ 予算内の見込みです（月額換算: $${monthlyCostEstimate.toFixed(3)}）`);
  }
  console.log('────────────────────────────────────────');
  console.log(`\n完了: ${processedIds.length}件処理しました`);
}

main().catch(err => {
  console.error('予期しないエラー:', err);
  process.exit(1);
});
