import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let browser = null;
  try {
    const { url, baseUrl, actualUrl } = req.query;
    const targetUrl = actualUrl || url;
    
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    console.log(`Fetching: ${targetUrl}`);

    // Optimize chromium modes for serverless
    try {
      chromium.setHeadlessMode = true;
      chromium.setGraphicsMode = false;
    } catch {}

    // Create browser with Vercel-optimized configuration
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off',
        '--max_old_space_size=512'
      ],
      executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
      protocolTimeout: 15000
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(8000);
    page.setDefaultTimeout(8000);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media') {
        return request.abort();
      }
      return request.continue();
    });
    
    // Set basic headers
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
    
    let data;
    
    // Visit baseUrl first if provided
    if (baseUrl) {
      try {
        await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 3000 });
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.log("BaseUrl failed, continuing...");
      }
    }
    
    // Fetch target URL
    try {
      const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 8000 });
      if (!response || !response.ok()) {
        throw new Error(`HTTP ${response ? response.status() : 'unknown'}`);
      }
      data = await page.content();
    } catch (error) {
      throw new Error(`Failed to fetch: ${error.message}`);
    }
    
    res.status(200).send(data);
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}