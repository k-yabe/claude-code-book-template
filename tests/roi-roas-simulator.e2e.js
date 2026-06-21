// 実運用検証 / リグレッションテスト（ROI / ROAS Simulator）
// jsdom で実際に DOM + inline scripts を動かし、イベントを発火して挙動を確認する。
// 実行: `npm run test:roi`（要 `npm install` で jsdom）。ブラウザ不要。
// （包括版: 数値正確性・全プリセット・エッジ・往復・比較・AIインポート(モック)・コピー・UI/UX を網羅）
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
let html = fs.readFileSync(path.resolve(__dirname, '..', 'apps', 'roi-roas-simulator', 'index.html'), 'utf8');
html = html.replace(/<script src="[^"]*onboarding\.js[^"]*"><\/script>/g,
  '<script>window.initOnboarding=function(){};window.sendAppView=function(){};</script>');
html = html.replace('</head>', `<script>
  window.matchMedia=window.matchMedia||function(){return{matches:false,addListener:function(){},removeListener:function(){}};};
  Element.prototype.scrollIntoView=function(){};
  if(!navigator.clipboard){navigator.clipboard={writeText:function(){return Promise.resolve();}};}
  window.__printed=0; window.print=function(){window.__printed++;};
</script></head>`);
const vc = new VirtualConsole(); const errs = []; vc.on('jsdomError', e => errs.push(e.message || String(e)));
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://localhost/' });
const { window } = dom, doc = window.document;
Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: t => { window.__copied = t; return Promise.resolve(); } }, configurable: true });
const $ = id => doc.getElementById(id), txt = id => { const e = $(id); return e ? e.textContent.trim() : '(none)'; };
const fire = (el, t) => el.dispatchEvent(new window.Event(t, { bubbles: true }));
const click = el => el.dispatchEvent(new window.Event('click', { bubbles: true }));
const setv = (id, v) => { $(id).value = String(v); fire($(id), 'input'); };
let pass = 0, fail = 0; const check = (n, c, x) => { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL:', n, x || ''); } };

(async () => {
console.log('# 1. 数値の正確性（デフォルト: 予算50万/CPC600/CVR0.5%/客単価50万/粗利50%）');
// 経済性を手で確定（事業未選択だと判定・KPIは保留＝「—」になる仕様のため）。値は既定のまま再入力で anchor。
fire($('in-cvr'), 'input');
// clicks=833.33 cv=4.1667 rev=2,083,333 roas=416.7→417 roi=108.3→108 cpa=120,000 ltv=250,000 ltvCac=2.08→2.1 beCV=2
check('ROAS=417', txt('kpi-roas') === '417', txt('kpi-roas'));
check('ROI=+108', txt('kpi-roi') === '+108', txt('kpi-roi'));
check('CPA=120,000', txt('kpi-cpa') === '120,000', txt('kpi-cpa'));
check('LTV/CAC=2.1倍', txt('m-ltvcac') === '2.1倍', txt('m-ltvcac'));
check('LTV/CAC 要改善バッジ', txt('m-ltvcac-pill') === '要改善', txt('m-ltvcac-pill'));
check('損益分岐CV=2件', txt('m-becv').startsWith('2 件'), txt('m-becv'));
check('限界CPA(=LTV)=250,000', txt('m-maxcpa') === '¥250,000', txt('m-maxcpa'));
check('実CPA 許容内（120k<250k）', txt('m-cpa-pill') === '許容内', txt('m-cpa-pill'));

console.log('# 1b. UI/UX・アクセシビリティ・折りたたみ');
check('はじめ方ガイド3ステップ', doc.querySelectorAll('.guide .guide-path').length === 3, 'len=' + doc.querySelectorAll('.guide .guide-path').length);
check('結果カード見出し', !!doc.querySelector('.result-card-head'));
check('ROAS/ROI 用語解説あり', !!doc.querySelector('.glossary') && /ROAS/.test(doc.querySelector('.glossary').textContent) && /ROI/.test(doc.querySelector('.glossary').textContent));
check('verdict aria-live=polite', $('verdict').getAttribute('aria-live') === 'polite');
check('用途トグル role=group', $('usecase-toggle').getAttribute('role') === 'group');
check('用途 aria-pressed 初期', $('usecase-toggle').querySelector('[data-uc="acquire"]').getAttribute('aria-pressed') === 'true');
check('流入トグル aria-label', !!$('traffic-mode').getAttribute('aria-label'));
check('プリセット群 aria-label', !!$('preset-row').getAttribute('aria-label'));
check('④その他コストは details', $('adv-cost').tagName.toLowerCase() === 'details');
check('初期はその他コスト畳む', $('adv-cost').open === false);
check('顧客獲得プリセット=3（派遣削除済み）', $('preset-row').querySelectorAll('[data-preset]').length === 3, 'len=' + $('preset-row').querySelectorAll('[data-preset]').length);
check('エンジニア派遣プリセット無し', !$('preset-row').querySelector('[data-preset="talent"]'));
// すべての主要入力欄・スライダーにアクセシブルな名前があるか
const accName = el => { const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim(); const lb = el.getAttribute('aria-labelledby'); if (lb) { const t = $(lb); if (t && t.textContent.trim()) return t.textContent.trim(); } return ''; };
['in-budget','in-cpc','in-clicks','in-cvr','in-aov','in-repeat','in-margin','in-othercost','range-cvr','range-repeat','range-margin'].forEach(id => {
  check('アクセシブル名あり: ' + id, accName($(id)) !== '', 'no name');
});

console.log('# 2. 全プリセットの ROAS/ROI（顧客獲得4ライン）');
const expect = { consulting: ['400', '+64'], solution: ['300', '-2'], academy: ['263', '+21'] };
for (const k in expect) {
  click($('preset-row').querySelector(`[data-preset="${k}"]`));
  check(`${k} ROAS=${expect[k][0]}`, txt('kpi-roas') === expect[k][0], 'got=' + txt('kpi-roas'));
  check(`${k} ROI=${expect[k][1]}`, txt('kpi-roi') === expect[k][1], 'got=' + txt('kpi-roi'));
}
check('その他コストありでも④は畳んだまま（見出しに金額表示）', $('adv-cost').open === false);
check('折りたたみ見出しに金額', txt('adv-cost-amount').includes('計上'), txt('adv-cost-amount'));

console.log('# 3. エッジケース');
click($('reset-btn'));
setv('in-budget', 0);
check('予算0で ROAS=—', txt('kpi-roas') === '—', txt('kpi-roas'));
check('予算0で 判定=入力してください', txt('verdict-title').includes('入力'), txt('verdict-title'));
click($('reset-btn'));
setv('in-cpc', 0);
check('CPC0で ROAS=—（流入0）', txt('kpi-roas') === '—', txt('kpi-roas'));
click($('reset-btn'));
setv('in-margin', 0);
check('粗利0で 損益分岐ROAS=—', txt('be-target') === '—', txt('be-target'));
check('粗利0で 赤字判定', txt('verdict-title').includes('赤字'), txt('verdict-title'));
click($('reset-btn'));
check('リセットで予算=500000', $('in-budget').value === '500000', $('in-budget').value);
check('リセット直後は事業未選択でROAS=—', txt('kpi-roas') === '—', txt('kpi-roas'));
check('リセット直後の判定＝STEP1事業選択を促す', txt('verdict-title').includes('事業'), txt('verdict-title'));
fire($('in-cvr'), 'input'); // 経済性を確定すれば既定値どおり復帰
check('経済性確定でROAS=417復帰', txt('kpi-roas') === '417', txt('kpi-roas'));

console.log('# 4. 用途トグル往復（採用→顧客獲得→採用でラベル復帰）');
const uc = u => click($('usecase-toggle').querySelector(`[data-uc="${u}"]`));
uc('recruit'); check('採用: 客単価→月次粗利', txt('t-aov') === '1人あたり月次粗利', txt('t-aov'));
uc('acquire'); check('獲得: 客単価復帰', txt('t-aov').includes('客単価'), txt('t-aov'));
uc('recruit'); check('採用: 再度 月次粗利', txt('t-aov') === '1人あたり月次粗利', txt('t-aov'));
check('採用: CPAラベル=採用単価', txt('t-kpi-cpa').includes('採用単価'), txt('t-kpi-cpa'));
check('採用: スライダー上限60', $('range-repeat').max === '60', $('range-repeat').max);
uc('acquire'); check('獲得: スライダー上限10復帰', $('range-repeat').max === '10', $('range-repeat').max);

console.log('# 5. 黒字化に必要なCVR 逆算（赤字時）');
click($('preset-row').querySelector('[data-preset="solution"]')); // roi -2 付近
setv('in-cvr', 0.1); // さらに下げて確実に赤字
check('赤字判定', txt('verdict-title').includes('赤字'), txt('verdict-title'));
check('必要CVRを提示', /CVR .*%.*必要/.test(txt('verdict-sub')), txt('verdict-sub'));

console.log('# 6. 業界平均の目安・商談化率×受注率');
click($('reset-btn'));
click(doc.querySelector('#bench .bench-chip[data-set="cvr"][data-val="5"]'));
check('CVR目安5%反映', $('in-cvr').value === '5', $('in-cvr').value);
check('CVR欄が⚠目安', $('in-cvr').closest('.field').classList.contains('needs-input'));
setv('in-cvr', 1.2); // 手入力でマーク解除
check('手入力で⚠目安解除', !$('in-cvr').closest('.field').classList.contains('needs-input'));
$('bench-mtg').value = '25'; $('bench-win').value = '40'; click($('bench-calc-apply'));
check('商談25%×受注40%→CVR10', $('in-cvr').value === '10', $('in-cvr').value);

console.log('# 7. プラン比較 ライフサイクル');
click($('reset-btn'));
click($('preset-row').querySelector('[data-preset="consulting"]')); // 事業を選んで anchor（未選択だと比較追加はガード）
click($('compare-add')); click($('preset-row').querySelector('[data-preset="academy"]')); click($('compare-add'));
let heads = $('compare-table').querySelectorAll('.sc-head');
check('2プラン並ぶ', heads.length === 2, 'len=' + heads.length);
click(heads[0]); // 1つ目を反映
check('列クリックで反映（active付与）', $('compare-table').querySelector('.sc-head.active') !== null);
const rm = $('compare-table').querySelector('[data-remove]'); click(rm);
check('1プラン削除', $('compare-table').querySelectorAll('.sc-head').length === 1);
click($('compare-clear'));
check('クリアで比較パネル非表示', !$('compare-panel').classList.contains('show'));

console.log('# 8. AIインポート パイプライン（fetch をモック）');
const canned = {
  found: true, budget: 1000000, trafficMode: 'cpc', cpc: 500, clicks: null,
  cvr: null, aov: 2000000, purchaseCount: null, margin: null, otherCost: 250000,
  assumptions: '広告費は月額換算', verdict: 'REVIEW', verdictReason: 'CVRが資料に無いため暫定',
  risks: ['CVR不明'], suggestions: ['実績CVRを入力'],
  scenarios: [
    { label: '松プラン', budget: 1500000, cpc: 500, cvr: null, aov: 3000000, margin: null, otherCost: null },
    { label: '竹プラン', budget: 900000, cpc: 500, cvr: null, aov: 1800000, margin: null, otherCost: null },
  ],
};
window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: '```json\n' + JSON.stringify(canned) + '\n```' }] }) });
const file = new window.File(['営業資料テキスト。広告費 月100万円、CPC500円、客単価200万円。複数プランあり。'], 'deck.txt', { type: 'text/plain' });
await window.analyzeDocument(file);
check('インポート: 予算=推奨1000000 を維持', $('in-budget').value === '1000000', $('in-budget').value);
check('インポート: 客単価=推奨2000000 を維持', $('in-aov').value === '2000000', $('in-aov').value);
check('インポート: その他固定費=250000', $('in-othercost').value === '250000', $('in-othercost').value);
check('インポート: CVR未取得で⚠目安マーク', $('in-cvr').closest('.field').classList.contains('needs-input'));
check('インポート(CPC): CVR仮値はクリック基準0.5%', $('in-cvr').value === '0.5', $('in-cvr').value);
check('インポート: 粗利率未取得で⚠目安マーク', $('in-margin').closest('.field').classList.contains('needs-input'));
check('インポート: AI所見パネル表示', $('ai-panel').classList.contains('show'));
check('インポート: AIは投資判定(GO/NOGO)を出さない（バッジ非表示）', $('ai-verdict').style.display === 'none', 'display=' + $('ai-verdict').style.display);
check('インポート: リスク表示', txt('ai-risks').includes('CVR不明'), txt('ai-risks'));
check('インポート: 推奨+2プラン=3列展開', $('compare-table').querySelectorAll('.sc-head').length === 3, 'len=' + $('compare-table').querySelectorAll('.sc-head').length);
check('インポート: 先頭列=資料の推奨', $('compare-table').querySelector('.sc-head .sc-label').textContent.includes('推奨'), $('compare-table').querySelector('.sc-head .sc-label').textContent);
check('インポート: 推奨列がアクティブ', $('compare-table').querySelector('.sc-head.active') !== null);
check('インポート: 事業未選択なら STEP1 事業選択を促す', txt('import-error').includes('STEP 1') && txt('import-error').includes('事業'), txt('import-error'));
// 多プラン取込後に事業を選ぶと、各プランの経済性も選んだ事業に揃う（予算・流入は維持）
click($('preset-row').querySelector('[data-preset="consulting"]')); // コンサル: 客単価300万
const aovRow = Array.from($('compare-table').querySelectorAll('tbody tr')).find(tr => { const l = tr.querySelector('.row-label'); return l && l.textContent === '客単価'; });
const aovCells = aovRow ? Array.from(aovRow.querySelectorAll('td.num')).map(td => td.textContent.replace(/[^0-9]/g, '')) : [];
check('事業選択で比較表の客単価が全プラン コンサル(300万)に揃う', aovCells.length === 3 && aovCells.every(c => c === '3000000'), aovCells.join(','));
check('事業選択後も比較プラン数は維持', $('compare-table').querySelectorAll('.sc-head').length === 3, 'len=' + $('compare-table').querySelectorAll('.sc-head').length);
// 比較表に「流入（クリック/リード）」「成約数」「CPA」の行がある
const rowLabels = Array.from($('compare-table').querySelectorAll('tbody tr .row-label')).map(e => e.textContent);
check('比較表に流入（リード/クリック）行', rowLabels.some(l => l.includes('流入')), rowLabels.join('/'));
check('比較表に成約数(CV)行', rowLabels.some(l => l.includes('成約数')), rowLabels.join('/'));
check('比較表にCPA行', rowLabels.includes('CPA'), rowLabels.join('/'));
check('比較表に予算行（広告費固定ラベルでない）', rowLabels.includes('予算'));
// 客単価を手で変えると比較表の各プランの客単価も追従する
setv('in-aov', 2000000);
const aovRow2 = Array.from($('compare-table').querySelectorAll('tbody tr')).find(tr => { const l = tr.querySelector('.row-label'); return l && l.textContent === '客単価'; });
const aovCells2 = aovRow2 ? Array.from(aovRow2.querySelectorAll('td.num')).map(td => td.textContent.replace(/[^0-9]/g, '')) : [];
check('客単価を手入力で変えると比較表も全プラン追従', aovCells2.length === 3 && aovCells2.every(c => c === '2000000'), aovCells2.join(','));
click($('reset-btn')); // 後続の「事業未選択での取込」検証のため状態を戻す

console.log('# 8c. 多数の料金パターンを全部展開（4件上限で切り捨てない）');
const many = {
  found: true, budget: 1000000, trafficMode: 'clicks', cpc: null, clicks: 100,
  cvr: null, aov: 500000, purchaseCount: null, margin: 50, otherCost: null,
  assumptions: '出展案内に多数の料金プラン', verdict: 'REVIEW', verdictReason: 'CVR不明', risks: ['CVR不明'], suggestions: ['実績入力'],
  scenarios: [
    { label: 'SILVER', budget: 700000, clicks: 60, trafficMode: 'clicks' },
    { label: 'GOLD', budget: 1000000, clicks: 100, trafficMode: 'clicks' },
    { label: 'DIAMOND', budget: 3000000, clicks: 200, trafficMode: 'clicks' },
    { label: 'リストスポンサー', budget: 4000000, clicks: 250, trafficMode: 'clicks' },
    { label: '1小間', budget: 350000, clicks: 30, trafficMode: 'clicks' },
    { label: '6m×3m', budget: 1200000, clicks: 120, trafficMode: 'clicks' },
  ],
};
window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: JSON.stringify(many) }] }) });
await window.analyzeDocument(new window.File(['出展案内。SILVER/GOLD/DIAMOND/リストスポンサー/1小間/6m×3m など多数の料金。'], 'expo-many.txt', { type: 'text/plain' }));
const manyHeads = $('compare-table').querySelectorAll('.sc-head');
// GOLD が推奨(base)と一致するため、推奨列は重複させず資料の6プランをそのまま全部表示
check('6プラン全部が列に出る（4件で切られない）', manyHeads.length === 6, 'len=' + manyHeads.length);
const labels = Array.from(manyHeads).map(h => h.querySelector('.sc-label').textContent);
check('全ラベルが揃う', ['SILVER','GOLD','DIAMOND','リストスポンサー','1小間','6m×3m'].every(l => labels.includes(l)), labels.join(','));
check('各プランに ROAS 行（試算結果）が出る', Array.from($('compare-table').querySelectorAll('tbody tr')).some(tr => tr.querySelector('.row-label') && tr.querySelector('.row-label').textContent === 'ROAS'));
check('推奨(GOLD)と一致する列がアクティブ', (() => { const a = $('compare-table').querySelector('.sc-head.active'); return a && a.querySelector('.sc-label').textContent === 'GOLD'; })(), 'active=' + (($('compare-table').querySelector('.sc-head.active')||{}).textContent||''));

console.log('# 8d. 推奨と異なる複数プランは「資料の推奨」列を先頭に追加');
const distinct = {
  found: true, budget: 1000000, trafficMode: 'cpc', cpc: 500, clicks: null,
  cvr: null, aov: 2000000, purchaseCount: null, margin: 50, otherCost: null,
  assumptions: 'x', verdict: 'REVIEW', verdictReason: 'x', risks: ['x'], suggestions: ['x'],
  scenarios: [
    { label: 'A案', budget: 1500000, cpc: 500, aov: 3000000 },
    { label: 'B案', budget: 800000, cpc: 500, aov: 1500000 },
  ],
};
window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: JSON.stringify(distinct) }] }) });
await window.analyzeDocument(new window.File(['提案資料です。A案とB案の2つの料金プランがあります。推奨は標準プランで、予算は月100万円・客単価200万円を想定しています。'], 'deck2.txt', { type: 'text/plain' }));
check('推奨が資料プランと異なる→推奨+2=3列', $('compare-table').querySelectorAll('.sc-head').length === 3, 'len=' + $('compare-table').querySelectorAll('.sc-head').length);
check('先頭列=資料の推奨', $('compare-table').querySelector('.sc-head .sc-label').textContent.includes('推奨'), $('compare-table').querySelector('.sc-head .sc-label').textContent);

console.log('# 8a. 用途切替でインポート内容が消えない（formDirty）');
const beforeBudget = $('in-budget').value, beforeAov = $('in-aov').value;
uc('recruit');
check('インポート後に用途切替しても予算が保持される', $('in-budget').value === beforeBudget, `before=${beforeBudget} after=${$('in-budget').value}`);
check('インポート後に用途切替しても客単価が保持される', $('in-aov').value === beforeAov, `before=${beforeAov} after=${$('in-aov').value}`);
uc('acquire');

console.log('# 8b. カンファレンス/展示会の出展資料（trafficMode=clicks・出展費）');
const conf = {
  found: true, budget: 800000, trafficMode: 'clicks', cpc: null, clicks: 150,
  cvr: null, aov: null, purchaseCount: null, margin: null, otherCost: null,
  assumptions: '出展費80万円。来場者5000人（自社リードではない）。獲得見込み名刺150枚。',
  verdict: 'REVIEW', verdictReason: '成約率・客単価が資料に無いため暫定判断です',
  risks: ['来場者全員が見込み客ではない', '成約率は自社実績が必要'], suggestions: ['実績の成約率・客単価を入力'], scenarios: [],
};
window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: JSON.stringify(conf) }] }) });
await window.analyzeDocument(new window.File(['◯◯カンファレンス 出展案内。出展費80万円。来場見込5000名。'], 'expo.txt', { type: 'text/plain' }));
check('展示会: 獲得数モードに切替', $('field-clicks').style.display !== 'none' && $('field-cpc').style.display === 'none');
check('展示会: 予算=出展費800000', $('in-budget').value === '800000', $('in-budget').value);
check('展示会: 獲得数=150', $('in-clicks').value === '150', $('in-clicks').value);
check('展示会: 客単価が⚠目安', $('in-aov').closest('.field').classList.contains('needs-input'));
check('展示会: 成約率が⚠目安', $('in-cvr').closest('.field').classList.contains('needs-input'));
check('展示会: CVR仮値はリード基準5%（クリック0.5%ではない）', $('in-cvr').value === '5', $('in-cvr').value);
check('展示会: 来場者を見込客と取り違えない注意', txt('ai-risks').includes('来場者'), txt('ai-risks'));

console.log('# 8e. インポート後にサービス選択：予算・流入は維持し経済性のみ反映＋基準バー');
uc('acquire'); // 顧客獲得のサービス（コンサル/ソリューション/アカデミー）に切替（内容は保持）
check('インポート直後の基準バー＝資料インポート中', txt('basis-bar').includes('資料') && txt('basis-bar').includes('expo'), txt('basis-bar'));
click($('preset-row').querySelector('[data-preset="solution"]'));
check('サービス選択後も予算は資料の80万を維持', $('in-budget').value === '800000', $('in-budget').value);
check('サービス選択後も獲得数は資料の150を維持', $('in-clicks').value === '150', $('in-clicks').value);
check('客単価がソリューションの目安1,200,000に', $('in-aov').value === '1200000', $('in-aov').value);
check('粗利率がソリューションの目安45に', $('in-margin').value === '45', $('in-margin').value);
check('CVRがソリューションの目安0.3に', $('in-cvr').value === '0.3', $('in-cvr').value);
check('基準バーにサービス名（ソリューション）が出る', txt('basis-bar').includes('ソリューション'), txt('basis-bar'));
check('選択中サービスのチップがアクティブ', (() => { const a = $('preset-row').querySelector('.preset-chip.active'); return a && a.dataset.preset === 'solution'; })(), 'active');
check('事業選択は意図的な選択なので⚠目安マークは付けない（客単価）', !$('in-aov').closest('.field').classList.contains('needs-input'));
click($('reset-btn'));
check('リセットで基準バー＝未選択（STEP1へ）', txt('basis-bar').includes('未選択') || txt('basis-bar').includes('STEP 1'), txt('basis-bar'));
click($('preset-row').querySelector('[data-preset="consulting"]'));
check('通常のサービス選択（インポートなし）で予算もプリセット値に', $('in-budget').value === '600000', $('in-budget').value);
check('基準バー＝コンサルティングの経済性', txt('basis-bar').includes('コンサルティング') && txt('basis-bar').includes('経済性'), txt('basis-bar'));
click($('reset-btn'));

console.log('# 9. コピー内容（採用モードの単位追従）');
uc('recruit');
window.__copied = null;
click($('copy-btn'));
const copied = window.__copied;
check('コピー: 採用ヘッダ', copied && copied.includes('エンジニア採用'), copied ? copied.split('\n')[0] : 'null');
check('コピー: 採用人数の語', copied && copied.includes('採用人数'), '');
check('コピー: 採用単価の語', copied && copied.includes('採用単価'), '');

console.log('# 10. 異常系：AI が JSON でない応答');
uc('acquire'); click($('reset-btn'));
window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: 'すみません、解析できませんでした' }] }) });
await window.analyzeDocument(new window.File(['x'.repeat(50)], 'd.txt', { type: 'text/plain' }));
check('JSON不正でエラー表示・クラッシュなし', txt('import-error').length > 0, txt('import-error'));

console.log('# 11. PDF / 印刷エクスポート（事業未選択ではガード）');
uc('acquire'); click($('reset-btn')); // 事業未選択の状態にする
check('PDF/印刷ボタンあり', !!$('pdf-btn'), 'no pdf-btn');
check('印刷ヘッダー要素あり', !!doc.querySelector('.print-header'), 'no print-header');
check('印刷日付プレースホルダあり', !!$('print-date'), 'no print-date');
check('印刷前は日付未設定', txt('print-date') === '(none)' || $('print-date').textContent.trim() === '', txt('print-date'));
const printedBefore0 = window.__printed;
click($('pdf-btn'));
check('事業未選択ではPDF印刷をガード（print未呼出）', window.__printed === printedBefore0, 'printed=' + window.__printed);
// 事業を選べば印刷できる
click($('preset-row').querySelector('[data-preset="consulting"]'));
const printedBefore = window.__printed;
click($('pdf-btn'));
check('事業選択後はPDFボタンで window.print 呼出', window.__printed === printedBefore + 1, 'printed=' + window.__printed);
check('印刷ヘッダーに日付スタンプ反映', /\d{4}-\d{2}-\d{2}.+出力/.test(txt('print-date')), txt('print-date'));

console.log('# 12. 稟議・申請用テキストの生成');
uc('acquire'); click($('reset-btn'));
click($('ringi-btn'));
check('事業未選択では稟議パネルを開かない', $('ringi-panel').style.display === 'none', 'display=' + $('ringi-panel').style.display);
click($('preset-row').querySelector('[data-preset="consulting"]'));
click($('ringi-btn'));
check('事業選択後は稟議パネル表示', $('ringi-panel').style.display !== 'none', 'display=' + $('ringi-panel').style.display);
const rt = $('ringi-text').value;
check('稟議文に件名行', rt.includes('件名'), rt.slice(0, 24));
check('稟議文に事業名（コンサルティング）', rt.includes('コンサルティング'));
check('稟議文に ROAS と ROI', rt.includes('ROAS') && rt.includes('ROI'));
check('稟議文に予算・総コスト', rt.includes('予算') && rt.includes('総コスト'));
check('稟議文に承認/再検討の結論', rt.includes('ご承認') || rt.includes('再検討'));
window.__copied = null;
click($('ringi-copy'));
check('稟議文をコピーできる', (window.__copied || '').includes('件名'), (window.__copied || '').slice(0, 16));
click($('ringi-close'));
check('稟議パネルを閉じられる', $('ringi-panel').style.display === 'none');
click($('reset-btn'));

check('全工程で script エラー無し', errs.length === 0, errs.join(' | '));
console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
})();
