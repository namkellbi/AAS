import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

async function main() {
  const profileDir = path.resolve(process.cwd(), 'data/threads-browser-profile');
  const outDir = path.resolve(process.cwd(), 'data/debug');
  fs.mkdirSync(outDir, { recursive: true });

  const url = process.argv[2] ?? 'https://www.threads.net/search?q=glasses';
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1440, height: 1100 }
  });

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(outDir, 'threads-debug.png'), fullPage: true });
    fs.writeFileSync(path.join(outDir, 'threads-debug.html'), await page.content(), 'utf8');

    const summary = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'))
        .map((a) => ({
          text: (a.textContent ?? '').trim().slice(0, 120),
          href: (a as HTMLAnchorElement).href,
          ariaLabel: a.getAttribute('aria-label'),
          role: a.getAttribute('role')
        }))
        .filter((a) => a.href.includes('threads.'))
        .slice(0, 160);
      const roles = Array.from(document.querySelectorAll('[role]'))
        .map((el) => ({ role: el.getAttribute('role'), text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 220) }))
        .filter((item) => item.text)
        .slice(0, 80);
      return { title: document.title, url: location.href, bodyText: document.body.innerText.slice(0, 3000), anchors, roles };
    });

    fs.writeFileSync(path.join(outDir, 'threads-debug.json'), JSON.stringify(summary, null, 2), 'utf8');
    console.log(JSON.stringify(summary, null, 2).slice(0, 4000));
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
