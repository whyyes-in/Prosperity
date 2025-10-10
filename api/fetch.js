import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');

  let browser = null;
  try {
    // Launch Puppeteer with serverless-compatible Chromium
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Set realistic headers
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.nseindia.com/',
    });

    // Go to NSE API and fetch the raw JSON/text
    const data = await page.evaluate(async (apiUrl) => {
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
        },
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
