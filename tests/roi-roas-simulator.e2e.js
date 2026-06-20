// 実運用検証 / リグレッションテスト（ROI / ROAS Simulator）
// jsdom で実際に DOM + inline scripts を動かし、イベントを発火して挙動を確認する。
// 実行: `npm run test:roi`（要 `npm install` で jsdom）。ブラウザ不要。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const APP = path.resolve(__dirname, "..", "apps", "roi-roas-simulator", "index.html");
let html = fs.readFileSync(APP, 'utf8');

// 外部 script（onboarding.js）はネット制限で読めないので stub に置換
html = html.replace(/<script src="[^"]*onboarding\.js[^"]*"><\/script>/g,
  '<script>window.initOnboarding=function(){};window.sendAppView=function(){};</script>');

// polyfill（jsdom 未実装のもの）を <head> 先頭に注入
const poly = `<script>
  window.matchMedia = window.matchMedia || function(){return{matches:false,addListener:function(){},removeListener:function(){}};};
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function(){};
  if(!navigator.clipboard){ navigator.clipboard = { writeText: function(){ return Promise.resolve(); } }; }
</script>`;
html = html.replace('</head>', poly + '</head>');

const vc = new VirtualConsole();
let scriptErrors = [];
vc.on('jsdomError', e => scriptErrors.push(e.message || String(e)));

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const txt = (id) => { const e = $(id); return e ? e.textContent.trim() : '(no el)'; };
const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
const click = (el) => el.dispatchEvent(new window.Event('click', { bubbles: true }));

let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗ FAIL:', name, extra || ''); } };

console.log('=== 1. 初期描画（顧客獲得モード・デフォルト値） ===');
check('script エラーなし', scriptErrors.length === 0, scriptErrors.join(' | '));
check('ROAS が数値で描画', /^[0-9,]+$/.test(txt('kpi-roas')), 'got=' + txt('kpi-roas'));
check('ROI が描画', txt('kpi-roi') !== '—', 'got=' + txt('kpi-roi'));
check('CPA が描画', txt('kpi-cpa') !== '—', 'got=' + txt('kpi-cpa'));
check('判定が黒字/赤字を出す', /黒字|赤字/.test(txt('verdict-title')), 'got=' + txt('verdict-title'));
check('プリセットチップが4つ（顧客獲得）', $('preset-row').querySelectorAll('[data-preset]').length === 4);
check('予算ラベル初期', txt('t-budget').includes('予算'), txt('t-budget'));

console.log('=== 2. 入力変更でリアルタイム再計算 ===');
const roas0 = txt('kpi-roas');
$('in-cvr').value = '2'; fire($('in-cvr'), 'input');
check('CVR変更でROAS変化', txt('kpi-roas') !== roas0, `before=${roas0} after=${txt('kpi-roas')}`);

console.log('=== 3. プリセット（エンジニア派遣）適用 ===');
const talentBtn = $('preset-row').querySelector('[data-preset="talent"]');
check('talent チップ存在', !!talentBtn);
if (talentBtn) { click(talentBtn); check('talent 適用で予算=700000', $('in-budget').value === '700000', 'got=' + $('in-budget').value); }

console.log('=== 4. 用途トグル → エンジニア採用 ===');
const recBtn = $('usecase-toggle').querySelector('[data-uc="recruit"]');
click(recBtn);
check('採用: 客単価ラベル→月次粗利', txt('t-aov') === '1人あたり月次粗利', 'got=' + txt('t-aov'));
check('採用: CVRラベル→採用率', txt('t-cvr').includes('採用率'), 'got=' + txt('t-cvr'));
check('採用: CPAラベル→採用単価', txt('t-kpi-cpa').includes('採用単価'), 'got=' + txt('t-kpi-cpa'));
check('採用: 稼働月数の単位=ヶ月', txt('t-repeat-unit') === 'ヶ月', 'got=' + txt('t-repeat-unit'));
check('採用: プリセット2種', $('preset-row').querySelectorAll('[data-preset]').length === 2);
check('採用: 稼働月数スライダー上限60', $('range-repeat').max === '60', 'got=' + $('range-repeat').max);
check('採用: 中途プリセットで稼働=24ヶ月', $('in-repeat').value === '24', 'got=' + $('in-repeat').value);
check('採用: スライダー値も24に追従', $('range-repeat').value === '24', 'got=' + $('range-repeat').value);
check('採用: ファネルCV見出し→採用人数', txt('t-f-cv') === '採用人数', 'got=' + txt('t-f-cv'));
check('採用: 採用人数が描画', txt('f-cv') !== '—', 'got=' + txt('f-cv'));

console.log('=== 5. 詳しい指標（LTV/CAC・限界CPA・損益分岐CV） ===');
check('LTV/CAC 描画', txt('m-ltvcac').includes('倍'), 'got=' + txt('m-ltvcac'));
check('LTV/CAC バッジ', ['健全','要改善','赤字'].includes(txt('m-ltvcac-pill')), 'got=' + txt('m-ltvcac-pill'));
check('実CPA バッジ（許容内/超過）', ['許容内','超過'].includes(txt('m-cpa-pill')), 'got=' + txt('m-cpa-pill'));
check('損益分岐CV（採用数）が人単位', txt('m-becv').includes('人'), 'got=' + txt('m-becv'));

console.log('=== 6. 顧客獲得に戻す → 業界平均の目安ヘルパー ===');
click($('usecase-toggle').querySelector('[data-uc="acquire"]'));
check('戻し: 客単価ラベル復帰', txt('t-aov').includes('客単価'), 'got=' + txt('t-aov'));
// 粗利率の目安チップ（45%）
const marginChip = doc.querySelector('#bench .bench-chip[data-set="margin"][data-val="45"]');
check('粗利率の目安チップ存在', !!marginChip);
if (marginChip) {
  click(marginChip);
  check('目安で粗利率=45', $('in-margin').value === '45', 'got=' + $('in-margin').value);
  check('粗利率欄が⚠目安マーク', $('in-margin').closest('.field').classList.contains('needs-input'));
}
// 商談化率×受注率→CVR
$('bench-mtg').value = '20'; $('bench-win').value = '30';
click($('bench-calc-apply'));
check('商談化率20×受注率30→CVR=6', $('in-cvr').value === '6', 'got=' + $('in-cvr').value);

console.log('=== 7. 人件費の概算（人数×時給×月稼働） ===');
$('hc-people').value = '3'; $('hc-wage').value = '5000'; $('hc-hours').value = '160';
fire($('hc-hours'), 'input');
check('概算プレビュー更新', txt('hc-preview').includes('2,400,000'), 'got=' + txt('hc-preview'));
click($('hc-apply'));
check('概算反映で その他固定費=2400000', $('in-othercost').value === '2400000', 'got=' + $('in-othercost').value);

console.log('=== 8. 流入モード切替（CPC↔獲得数直接） ===');
const directBtn = $('traffic-mode').querySelector('[data-mode="clicks"]');
click(directBtn);
check('獲得数フィールド表示', $('field-clicks').style.display !== 'none');
check('CPCフィールド非表示', $('field-cpc').style.display === 'none');

console.log('=== 9. プラン比較（手動スナップショット） ===');
click($('compare-add'));
check('比較パネル表示', $('compare-panel').classList.contains('show'));
check('比較テーブルに行', $('compare-table').querySelectorAll('tr').length > 0);

console.log('=== 10. コピー出力（クラッシュしないこと） ===');
let copyOk = true;
try { click($('copy-btn')); } catch (e) { copyOk = false; }
check('コピーがエラーにならない', copyOk);

console.log('\n=== 実行後の script エラー累計 ===');
check('実行中 jsdomError なし', scriptErrors.length === 0, scriptErrors.join(' | '));

console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
