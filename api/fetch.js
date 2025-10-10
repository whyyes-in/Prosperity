import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');

  let browser = null;
  try {
    // Use async executablePath() to get the binary reliably
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,       // must be provided for puppeteer-core
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.nseindia.com/',
    });

    const data = await page.evaluate(async (apiUrl) => {
      const response = await fetch(apiUrl, {
        headers: { 'Accept': 'application/json, text/plain, */*' },
      });
      return await response.text();
    }, url);

    await browser.close();
    res.status(200).send(data);

  } catch (err) {
    if (browser) await browser.close();
    res.status(500).send('Fetch error: ' + err.message);
  }
}
