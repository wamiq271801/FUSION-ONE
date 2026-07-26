/**
 * PNG renderer — server-only.
 * Generates a PNG buffer from InvoiceData using HTML templates + Puppeteer.
 *
 * Does NOT call renderPdf(). Renders HTML directly to image.
 * Puppeteer is available via whatsapp-web.js dependency.
 */
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import { getHtmlTemplatePath } from '../html-registry';
import { renderHtmlTemplate } from '../utils/html-engine';
import type { InvoiceData, TemplateVariant } from '../types';

let browserPromise: Promise<any> | null = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      // 'shell' uses the dedicated chrome-headless-shell binary, which has no
      // window/UI layer and never spawns a visible browser window. `true`
      // (new headless) runs the full Chrome binary and can flash a visible
      // window on Windows during render.
      headless: 'shell',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        // Belt-and-suspenders: keep any window off-screen and minimal.
        '--window-position=-32000,-32000',
        '--window-size=1,1',
      ],
    }).catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export async function renderPng(data: InvoiceData): Promise<Buffer> {
  const variant = (data.template as TemplateVariant) || 'prestige';
  const templatePath = getHtmlTemplatePath(variant);
  const rawHtml = await fs.readFile(templatePath, 'utf-8');
  const populatedHtml = renderHtmlTemplate(rawHtml, data);

  const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 0; background: white; }
</style></head><body>${populatedHtml}</body></html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(fullHtml, { waitUntil: 'load' });

    // Get the actual content height for a tight screenshot
    const bodyHeight = await page.evaluate(() => {
      const el = document.body.firstElementChild as HTMLElement;
      return el ? el.offsetHeight : 1123;
    });

    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: 794, height: bodyHeight },
    });

    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}
