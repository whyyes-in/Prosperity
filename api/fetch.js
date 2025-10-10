import puppeteer from 'puppeteer';

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set browser-like headers
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.nseindia.com/',
    });

    // Go to NSE API endpoint
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Fetch the API response from page context
    const text = await page.evaluate(u => fetch(u, { headers: { 'Accept': 'application/json, text/plain, */*' } }).then(r => r.text()), url);

    await browser.close();
    res.status(200).send(text);
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).send('Fetch error: ' + err.message);
  }
}
