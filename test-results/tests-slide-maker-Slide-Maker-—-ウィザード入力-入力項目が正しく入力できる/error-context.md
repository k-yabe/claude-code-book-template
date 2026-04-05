# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/slide-maker.spec.js >> Slide Maker — ウィザード入力 >> 入力項目が正しく入力できる
- Location: tests/slide-maker.spec.js:54:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#title')

```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]: "404"
    - paragraph [ref=e5]: The requested path could not be found
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  4   | 
  5   | test.beforeEach(async ({ page }) => {
  6   |   // 認証をセット
  7   |   await page.goto(BASE_URL);
  8   |   await page.evaluate(() => localStorage.setItem('auth', '1'));
  9   | });
  10  | 
  11  | test.describe('Slide Maker — ページ表示', () => {
  12  |   test('アプリが正常に表示される', async ({ page }) => {
  13  |     await page.goto(`${BASE_URL}/apps/slide-maker/`);
  14  |     await expect(page).toHaveTitle(/Slide Maker/);
  15  |     await expect(page.locator('.page-title')).toContainText('Slide Maker');
  16  |   });
  17  | 
  18  |   test('ナビバーに「← アプリ一覧へ」リンクが存在する', async ({ page }) => {
  19  |     await page.goto(`${BASE_URL}/apps/slide-maker/`);
  20  |     await expect(page.locator('.navbar-back')).toContainText('アプリ一覧へ');
  21  |   });
  22  | 
  23  |   test('認証なしでアクセスするとトップページにリダイレクトされる', async ({ page }) => {
  24  |     await page.evaluate(() => localStorage.removeItem('auth'));
  25  |     await page.goto(`${BASE_URL}/apps/slide-maker/`);
  26  |     await expect(page).toHaveURL(BASE_URL + '/');
  27  |   });
  28  | });
  29  | 
  30  | test.describe('Slide Maker — ウィザード入力', () => {
  31  |   test.beforeEach(async ({ page }) => {
  32  |     await page.goto(`${BASE_URL}/apps/slide-maker/`);
  33  |     await page.evaluate(() => localStorage.setItem('auth', '1'));
  34  |     await page.reload();
  35  |   });
  36  | 
  37  |   test('テンプレートカードが4種類表示される', async ({ page }) => {
  38  |     const cards = page.locator('.template-card');
  39  |     await expect(cards).toHaveCount(4);
  40  |   });
  41  | 
  42  |   test('テンプレートを選択するとselectedクラスが付く', async ({ page }) => {
  43  |     await page.locator('.template-card[data-val="external-dark"]').click();
  44  |     await expect(page.locator('.template-card[data-val="external-dark"]')).toHaveClass(/selected/);
  45  |     await expect(page.locator('.template-card[data-val="external-white"]')).not.toHaveClass(/selected/);
  46  |   });
  47  | 
  48  |   test('必須項目が空のまま生成ボタンを押すとエラーが表示される', async ({ page }) => {
  49  |     await page.locator('#btn-generate').click();
  50  |     await expect(page.locator('#error-msg')).toBeVisible();
  51  |     await expect(page.locator('#error-text')).toContainText('タイトルを入力してください');
  52  |   });
  53  | 
  54  |   test('入力項目が正しく入力できる', async ({ page }) => {
> 55  |     await page.fill('#title', 'テスト提案書');
      |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  56  |     await page.fill('#audience', 'テスト対象者');
  57  |     await page.fill('#background', 'テスト背景');
  58  |     await page.locator('.msg-input').first().fill('テストメッセージ');
  59  |     await expect(page.locator('#title')).toHaveValue('テスト提案書');
  60  |   });
  61  | });
  62  | 
  63  | test.describe('Slide Maker — UI構造', () => {
  64  |   test.beforeEach(async ({ page }) => {
  65  |     await page.goto(`${BASE_URL}/apps/slide-maker/`);
  66  |     await page.evaluate(() => localStorage.setItem('auth', '1'));
  67  |     await page.reload();
  68  |   });
  69  | 
  70  |   test('ウィザードが3ステップで構成されている', async ({ page }) => {
  71  |     const steps = page.locator('.step');
  72  |     await expect(steps).toHaveCount(3);
  73  |   });
  74  | 
  75  |   test('生成ボタンが存在する', async ({ page }) => {
  76  |     await expect(page.locator('#btn-generate')).toBeVisible();
  77  |   });
  78  | 
  79  |   test('ダウンロードエリアが初期状態では非表示', async ({ page }) => {
  80  |     await expect(page.locator('#download-area')).not.toBeVisible();
  81  |   });
  82  | 
  83  |   test('プレビューセクションが初期状態では非表示', async ({ page }) => {
  84  |     await expect(page.locator('#preview-section')).not.toBeVisible();
  85  |   });
  86  | 
  87  |   test('フッターに機密情報警告が表示される', async ({ page }) => {
  88  |     await expect(page.locator('footer')).toContainText('機密情報');
  89  |   });
  90  | });
  91  | 
  92  | test.describe('ポータル — Slide Makerカード', () => {
  93  |   test('ポータルにSlide MakerカードにNEWバッジが表示される', async ({ page }) => {
  94  |     await page.goto(`${BASE_URL}/`);
  95  |     await page.evaluate(() => localStorage.setItem('auth', '1'));
  96  |     await page.reload();
  97  |     const card = page.locator('a.card[href*="slide-maker"]');
  98  |     await expect(card).toBeVisible();
  99  |     await expect(card.locator('.card-new-badge')).toContainText('NEW');
  100 |   });
  101 | 
  102 |   test('WHAT\'S NEWにSlide Makerのエントリが存在する', async ({ page }) => {
  103 |     await page.goto(`${BASE_URL}/`);
  104 |     await page.evaluate(() => localStorage.setItem('auth', '1'));
  105 |     await page.reload();
  106 |     // WHAT'S NEWボタンをクリック
  107 |     const btn = page.locator('.changelog-btn');
  108 |     if (await btn.isVisible()) {
  109 |       await btn.click();
  110 |       await expect(page.locator('.changelog-panel')).toContainText('Slide Maker');
  111 |     }
  112 |   });
  113 | });
  114 | 
```