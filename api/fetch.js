import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

/**
 * Vercel Function for fetching web data with session management
 * 
 * Usage:
 * - Single URL: ?url=https://example.com/api/...
 * - Dual URL (recommended): ?baseUrl=https://example.com&actualUrl=https://example.com/api/...
 * 
 * The dual URL approach visits baseUrl first to establish session/cookies,
 * then visits actualUrl with the established session for better success rates.
 * Supports any valid URLs, not restricted to specific domains.
 */

// Helper function to create browser
const createBrowser = async () => {
  const executablePath = await chromium.executablePath();
  return await puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-images',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--single-process',
      '--no-zygote',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--disable-ipc-flooding-protection'
    ],
    executablePath,
    headless: true,
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    protocolTimeout: 60000
  });
};

// Helper function to configure page
const configurePage = async (page) => {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
  
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  await page.setExtraHTTPHeaders({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache"
  });
};

// Helper function to fetch data
const fetchData = async (page, url, refererUrl) => {
  return await page.evaluate(async (url, refererUrl) => {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": refererUrl || new URL(url).origin + "/",
          "Cache-Control": "no-cache"
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
  }, url, refererUrl);
};

export default async function handler(req, res) {
  // Set timeout for Vercel (25 seconds max - increased for better success rate)
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: "Request timeout - function exceeded time limit" });
    }
  }, 25000);

  try {
    // Enable CORS for Apps Script
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      clearTimeout(timeoutId);
      return res.status(200).end();
    }

    const baseUrl = req.query.baseUrl;
    const actualUrl = req.query.actualUrl;
    
    // Support both old single URL parameter and new dual URL parameters
    const apiUrl = actualUrl || req.query.url;
    
    if (!apiUrl) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: "Missing url parameter (use 'url' or 'actualUrl')" });
    }

    // Basic URL validation - ensure URLs are valid
    try {
      new URL(apiUrl);
    } catch (urlError) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: "Invalid URL format for actualUrl" });
    }
    
    // If baseUrl is provided, validate it too
    if (baseUrl) {
      try {
        new URL(baseUrl);
      } catch (urlError) {
        clearTimeout(timeoutId);
        return res.status(400).json({ error: "Invalid URL format for baseUrl" });
      }
    }

    let browser = null;
    let retryCount = 0;
    const maxRetries = 2; // Reduced from 3 to save time

    while (retryCount < maxRetries) {
      try {
        console.log(`🚀 Fetching URL (attempt ${retryCount + 1}): ${apiUrl}`);
        
        browser = await createBrowser();
        const page = await browser.newPage();
        await configurePage(page);

        let data = null;
        
        // Step 1: Visit baseUrl to establish session and cookies
        if (baseUrl) {
          console.log(`📡 Step 1: Visiting baseUrl to establish session: ${baseUrl}`);
          try {
            await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
            console.log("✅ BaseUrl loaded successfully");
            await new Promise(resolve => setTimeout(resolve, 500)); // Let cookies settle
          } catch (baseError) {
            console.log("❌ BaseUrl failed, continuing to target URL...", baseError.message);
          }
        }
        
        // Step 2: Fetch actualUrl with established session/cookies
        console.log(`📡 Step 2: Fetching actualUrl: ${apiUrl}`);
        
        try {
          data = await fetchData(page, apiUrl, baseUrl);
          console.log("✅ Direct fetch succeeded - raw response received!");
        } catch (fetchError) {
          console.log("❌ Direct fetch failed, trying navigation fallback:", fetchError.message);
          
          // Fallback to navigation if fetch fails
          try {
            const response = await page.goto(apiUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
            if (!response || !response.ok()) {
              throw new Error(`HTTP ${response ? response.status() : 'unknown'}: Navigation failed`);
            }
            data = await page.content();
            console.log("✅ Navigation fallback succeeded!");
          } catch (navError) {
            console.log("❌ Navigation fallback failed:", navError.message);
            throw new Error(`Both fetch and navigation failed. Last error: ${navError.message}`);
          }
        }

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
          console.log(`🔄 Retrying in 0.5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        
        // Error responses
        clearTimeout(timeoutId);
        const statusCode = err.message.includes('timeout') ? 408 :
                         err.message.includes('403') || err.message.includes('Forbidden') ? 403 :
                         err.message.includes('401') || err.message.includes('Unauthorized') ? 401 :
                         err.message.includes('network') ? 502 : 500;
        
        res.status(statusCode).json({ 
          error: err.message,
          url: apiUrl 
        });
      }
    }
  } catch (finalError) {
    clearTimeout(timeoutId);
    if (!res.headersSent) {
      res.status(500).json({ error: "Unexpected error: " + finalError.message });
    }
  }
}
