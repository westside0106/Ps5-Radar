import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.RADAR_TEST_URL || 'http://127.0.0.1:3000';
const password=process.env.RADAR_PASSWORD || 'radar-local';
const browser=await chromium.launch({headless:true});
try {
  for (const width of [375,390,430,768,1280]) {
    const context=await browser.newContext({viewport:{width,height:850},deviceScaleFactor:1,locale:'de-DE',timezoneId:'Europe/Berlin'});
    const page=await context.newPage();
    await page.goto(base+'/');
    await page.locator('input[name="password"]').fill(password);
    await Promise.all([page.waitForURL('**/radar'),page.getByRole('button',{name:'Radar öffnen'}).click()]);
    await page.locator('.magazine').waitFor();
    if (width <= 768) {
      const dimensions=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(dimensions.scroll<=dimensions.viewport+2,`Horizontal overflow at ${width}: ${JSON.stringify(dimensions)}`);
    }
    const deals=page.locator('.deal-showcase-wrap');
    if (await deals.count()) {
      const first=deals.first();
      const price=first.locator('.deal-price-values strong');
      const signal=first.locator('.radar-signal-footer');
      if (await price.count() && await signal.count()) {
        const a=await price.boundingBox(),b=await signal.boundingBox();
        assert.ok(a&&b&&a.y+a.height<=b.y+1,`Price overlaps signal at ${width}`);
      }
    }
    await page.goto(base+'/ps-plus');
    await page.locator('.catalog-app').waitFor();
    const dimensions=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.viewport+2,`Catalog overflow at ${width}: ${JSON.stringify(dimensions)}`);
    await page.getByRole('button',{name:'Extra',exact:true}).click();
    await page.getByPlaceholder('Spiel suchen …').fill('nicht-vorhandenes-testspiel');
    await page.getByText('Keine passenden Einträge').waitFor();
    if (width===390) await page.screenshot({path:'/tmp/radar-goal-mobile.png',fullPage:true});
    await context.close();
  }
  console.log('Mobile, tablet and desktop layout checks passed.');
} finally {await browser.close();}
