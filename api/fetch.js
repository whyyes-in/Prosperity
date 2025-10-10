// api/fetch.js
import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
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

    // Directly fetch API JSON without page.goto
    const data = await page.evaluate(async (apiUrl) => {
      const resp = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
        },
      });
      return await resp.text();
    }, url);

    await browser.close();
    res.status(200).send(data);
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).send('Fetch error: ' + err.message);
  }
}
