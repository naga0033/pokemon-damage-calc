import { chromium } from 'playwright';

const URL = 'https://pokemon-damage-calc.vercel.app';
const DIR = './screenshots/6.5inch';

// iPhone 11 Pro Max (6.5インチ) のサイズ
const viewport = { width: 414, height: 896 };
const deviceScaleFactor = 3; // 414*3=1242, 896*3=2688

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

  console.log('📸 6.5インチ用スクリーンショット撮影中...');

  // 1. トップ画面
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DIR}/01_top.png` });
  console.log('  1/4 トップ画面 ✓');

  // 2. ポケモン検索
  const atkInput = page.locator('input[placeholder*="攻撃"]');
  await atkInput.click();
  await atkInput.fill('ディンルー');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/02_search.png` });
  console.log('  2/4 検索画面 ✓');

  // ディンルー選択
  const atkResult = page.locator('text=ディンルー').first();
  if (await atkResult.isVisible()) {
    await atkResult.click();
    await page.waitForTimeout(1000);
  }

  // 3. ダメージ計算
  const defInput = page.locator('input[placeholder*="防御"]');
  await defInput.click();
  await defInput.fill('ハバタクカミ');
  await page.waitForTimeout(1000);
  const defResult = page.locator('text=ハバタクカミ').first();
  if (await defResult.isVisible()) {
    await defResult.click();
    await page.waitForTimeout(2000);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/03_damage.png` });
  console.log('  3/4 ダメージ計算 ✓');

  // 4. 計算結果詳細
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/04_detail.png` });
  console.log('  4/4 計算結果 ✓');

  await browser.close();
  console.log('✅ 6.5インチ用完了！');
}

main().catch(console.error);
