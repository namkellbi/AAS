import path from 'node:path';
import { chromium } from 'playwright';

async function main() {
  const context = await chromium.launchPersistentContext(path.resolve(process.cwd(), 'data/threads-browser-profile'), {
    headless: true,
    viewport: { width: 1440, height: 1100 }
  });

  try {
    const page = await context.newPage();
    await page.goto(process.argv[2] ?? 'https://www.threads.com/search?q=glasses', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('a[href*="/post/"]').first().waitFor({ state: 'attached', timeout: 10_000 });
    await page.waitForTimeout(1500);
    console.log(
      JSON.stringify(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll('a'))
            .map((anchor) => anchor as HTMLAnchorElement)
            .filter((anchor) => /\/@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+/.test(anchor.href))
            .slice(0, 3)
            .map((anchor) => {
              const parents = [];
              let current: HTMLElement | null = anchor;
              for (let depth = 0; current && depth < 14; depth += 1) {
                parents.push({
                  depth,
                  tag: current.tagName,
                  text: current.innerText.replace(/\s+/g, ' ').slice(0, 700),
                  textLength: current.innerText.length
                });
                current = current.parentElement;
              }
              return { href: anchor.href, parents };
            })
        ),
        null,
        2
      )
    );
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
