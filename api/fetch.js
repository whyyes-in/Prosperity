import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

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

        // Enhanced stealth mode for better detection avoidance
        await page.evaluateOnNewDocument(() => {
          // Remove webdriver property
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
          
          // Mock plugins
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
          });
          
          // Mock languages
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
          });
          
          // Mock permissions
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );
        });

        // Randomize user agent for each request
        const userAgents = [
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        ];
        
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomUA);
        
        await page.setExtraHTTPHeaders({
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1"
        });

        // Ultra-fast approach: Try direct API access first, then session fallback
        let data = null;
        
        // Strategy 1: Direct navigation to API URL (fastest - 3-5 seconds)
        try {
          console.log("📡 Strategy 1: Direct API navigation...");
          const response = await page.goto(apiUrl, { 
            waitUntil: "domcontentloaded",
            timeout: 8000
          });

          if (!response || !response.ok()) {
            throw new Error(`HTTP ${response ? response.status() : 'unknown'}: Direct navigation failed`);
          }

          data = await page.content();
          console.log("✅ Strategy 1 succeeded - Direct navigation worked!");
          
        } catch (strategy1Error) {
          console.log("❌ Strategy 1 failed:", strategy1Error.message);
          
          // Strategy 2: Session establishment + fetch (fallback - 8-12 seconds)
          try {
            console.log("📡 Strategy 2: Session establishment...");
            await page.goto("https://www.nseindia.com", { 
              waitUntil: "domcontentloaded",
              timeout: 6000
            });
            
            // Minimal wait for session (reduced from 2-5 seconds to 1 second)
            console.log("⏳ Quick session wait...");
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Minimal human-like behavior (single mouse movement)
            try {
              await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (mouseError) {
              console.log("Mouse interaction failed, continuing...");
            }

            data = await page.evaluate(async (url) => {
              try {
                const resp = await fetch(url, {
                  method: 'GET',
                  headers: {
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer": "https://www.nseindia.com/",
                    "X-Requested-With": "XMLHttpRequest",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache"
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
            
            console.log("✅ Strategy 2 succeeded - Session establishment worked!");
            
          } catch (strategy2Error) {
            console.log("❌ Strategy 2 failed:", strategy2Error.message);
            throw new Error(`All strategies failed. Last error: ${strategy2Error.message}`);
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
          const retryDelay = (retryCount + 1) * 1000 + Math.random() * 1000; // 1-3 seconds with randomization
          console.log(`🔄 Retrying in ${Math.round(retryDelay/1000)} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
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
