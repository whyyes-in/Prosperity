import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  // Set timeout for Vercel (20 seconds max - reduced from 25)
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: "Request timeout - function exceeded time limit" });
    }
  }, 20000);

  try {
    // Enable CORS for Apps Script
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      clearTimeout(timeoutId);
      return res.status(200).end();
    }

    const apiUrl = req.query.url;
    if (!apiUrl) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: "Missing url parameter" });
    }

    // Security: Only allow NSE URLs
    if (!apiUrl.startsWith('https://www.nseindia.com/')) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: "Only NSE India URLs are allowed" });
    }

  let browser = null;
  let retryCount = 0;
  const maxRetries = 2; // Reduced from 3 to save time

  while (retryCount < maxRetries) {
    try {
      console.log(`🚀 Fetching URL (attempt ${retryCount + 1}): ${apiUrl}`);
      
      // Use async executablePath() to get the binary reliably
      const executablePath = await chromium.executablePath();

      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images',
          '--disable-default-apps'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath,
        headless: true,
        ignoreHTTPSErrors: true,
        ignoreDefaultArgs: ['--disable-extensions']
      });

      const page = await browser.newPage();

      // Simplified stealth mode for faster execution
      await page.evaluateOnNewDocument(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      // Set essential headers only for speed
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
      
      await page.setExtraHTTPHeaders({
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
      });

      // Skip homepage visit for speed - go directly to API
      console.log("📡 Fetching API data directly...");
      const data = await page.evaluate(async (url) => {
        try {
          const resp = await fetch(url, {
            method: 'GET',
            headers: {
              "Accept": "application/json, text/plain, */*",
              "Accept-Language": "en-US,en;q=0.9",
              "Referer": "https://www.nseindia.com/",
              "X-Requested-With": "XMLHttpRequest",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            credentials: 'include',
            mode: 'cors'
          });
          
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          }
          
          return await resp.text();
        } catch (error) {
          throw new Error(`Fetch error: ${error.message}`);
        }
      }, apiUrl);

      await browser.close();
      
      console.log("✅ Successfully fetched data");
      clearTimeout(timeoutId);
      res.status(200).send(data);
      return;

    } catch (err) {
      console.error(`❌ Attempt ${retryCount + 1} failed:`, err.message);
      
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Browser close error:', closeError.message);
        }
      }
      
      retryCount++;
      
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying in ${retryCount * 1} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryCount * 1000)); // Reduced retry delay
        continue;
      }
      
      // Enhanced error responses
      clearTimeout(timeoutId);
      if (err.message.includes('timeout')) {
        res.status(408).json({ error: "Request timeout - NSE server may be slow" });
      } else if (err.message.includes('net::ERR_') || err.message.includes('Access Denied')) {
        res.status(403).json({ error: "Access denied by NSE - try again later" });
      } else {
        res.status(500).json({ 
          error: "Fetch error: " + err.message,
          url: apiUrl 
        });
      }
    }
  }
  } catch (finalError) {
    clearTimeout(timeoutId);
    if (!res.headersSent) {
      res.status(500).json({ error: "Unexpected error: " + finalError.message });
    }
  }
}
