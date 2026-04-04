import { chromium } from 'playwright';

const URL = 'https://pokemon-damage-calc.vercel.app';
const DIR = './screenshots';

// iPhone 15 Pro Max (6.7インチ) のサイズ
const viewport = { width: 430, height: 932 };
const deviceScaleFactor = 3; // 430*3=1290, 932*3=2796

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  // 1. トップ画面
  console.log('📸 1/4 トップ画面...');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DIR}/01_top.png` });

  // 2. 攻撃側ポケモン検索 → ディンルー選択
  console.log('📸 2/4 ポケモン検索...');
  const atkInput = page.locator('input[placeholder*="攻撃"]');
  await atkInput.click();
  await atkInput.fill('ディンルー');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/02_search.png` });

  // 検索結果からディンルーを選択
  const atkResult = page.locator('text=ディンルー').first();
  if (await atkResult.isVisible()) {
    await atkResult.click();
    await page.waitForTimeout(1000);
  }

  // 3. 防御側も入力 → ダメージ計算結果
  console.log('📸 3/4 ダメージ計算...');
  const defInput = page.locator('input[placeholder*="防御"]');
  await defInput.click();
  await defInput.fill('ハバタクカミ');
  await page.waitForTimeout(1000);
  const defResult = page.locator('text=ハバタクカミ').first();
  if (await defResult.isVisible()) {
    await defResult.click();
    await page.waitForTimeout(2000);
  }

  // ダメージ計算結果までスクロール
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/03_damage.png` });

  // 4. 下にスクロールして計算結果部分
  console.log('📸 4/4 計算結果詳細...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/04_detail.png` });

  await browser.close();
  console.log('✅ 全スクリーンショット完了！');
}

main().catch(console.error);
