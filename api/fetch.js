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

        // Serverless-optimized ultra-stealth mode
        await page.evaluateOnNewDocument(() => {
          // Remove webdriver property completely
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
          
          // Mock realistic plugins with proper structure
          Object.defineProperty(navigator, 'plugins', {
            get: () => [
              { 
                name: 'Chrome PDF Plugin', 
                filename: 'internal-pdf-viewer',
                description: 'Portable Document Format',
                length: 1
              },
              { 
                name: 'Chrome PDF Viewer', 
                filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                description: '',
                length: 0
              },
              { 
                name: 'Native Client', 
                filename: 'internal-nacl-plugin',
                description: '',
                length: 2
              }
            ],
          });
          
          // Mock realistic languages
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
          });
          
          // Mock permissions API
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );
          
          // Mock chrome runtime with more properties
          if (!window.chrome) {
            window.chrome = {
              runtime: {
                onConnect: undefined,
                onMessage: undefined,
                id: 'abcdefghijklmnopqrstuvwxyz123456'
              }
            };
          }
          
          // Mock realistic screen properties
          Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
          Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
          Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
          Object.defineProperty(screen, 'height', { get: () => 1080 });
          Object.defineProperty(screen, 'width', { get: () => 1920 });
          Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
          
          // Mock hardware concurrency
          Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => 8,
          });
          
          // Mock device memory
          Object.defineProperty(navigator, 'deviceMemory', {
            get: () => 8,
          });
          
          // Mock connection with realistic values
          Object.defineProperty(navigator, 'connection', {
            get: () => ({
              effectiveType: '4g',
              rtt: 50,
              downlink: 10,
              saveData: false
            }),
          });
          
          // Mock battery API
          Object.defineProperty(navigator, 'getBattery', {
            get: () => () => Promise.resolve({
              charging: true,
              chargingTime: 0,
              dischargingTime: Infinity,
              level: 1
            }),
          });
          
          // Override Date.getTimezoneOffset to look realistic
          Date.prototype.getTimezoneOffset = function() {
            return -330; // IST timezone
          };
          
          // Mock canvas fingerprint
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function() {
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
          };
          
          // Mock WebGL fingerprint
          const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.';
            if (parameter === 37446) return 'Intel(R) Iris(TM) Graphics 6100';
            return originalGetParameter.call(this, parameter);
          };
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

        // Ultra-fast stealth approach: Optimized for Vercel timeout
        let data = null;
        let strategySuccess = false;
        
        // Strategy 1: Ultra-fast session establishment (3-5 seconds)
        try {
          console.log("📡 Strategy 1: Ultra-fast session establishment...");
          
          // Quick homepage visit
          await page.goto("https://www.nseindia.com", { 
            waitUntil: "domcontentloaded",
            timeout: 6000
          });
          
          // Minimal realistic wait
          console.log("⏳ Quick session wait...");
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));

          // Minimal human-like behavior
          try {
            // Single mouse movement
            await page.mouse.move(200 + Math.random() * 100, 150 + Math.random() * 100);
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Single scroll
            await page.mouse.wheel({ deltaY: Math.random() * 100 + 50 });
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (mouseError) {
            console.log("Mouse interaction failed, continuing...");
          }

          // Try API access with session
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
          
          console.log("✅ Strategy 1 succeeded - Ultra-fast session establishment worked!");
          strategySuccess = true;
          
        } catch (strategy1Error) {
          console.log("❌ Strategy 1 failed:", strategy1Error.message);
          
          // Strategy 2: Direct navigation (2-4 seconds)
          try {
            console.log("📡 Strategy 2: Direct navigation...");
            
            const response = await page.goto(apiUrl, { 
              waitUntil: "domcontentloaded",
              timeout: 6000
            });

            if (!response || !response.ok()) {
              throw new Error(`HTTP ${response ? response.status() : 'unknown'}: Direct navigation failed`);
            }

            data = await page.content();
            console.log("✅ Strategy 2 succeeded - Direct navigation worked!");
            strategySuccess = true;
            
          } catch (strategy2Error) {
            console.log("❌ Strategy 2 failed:", strategy2Error.message);
            
            // Strategy 3: Alternative page approach (3-5 seconds)
            try {
              console.log("📡 Strategy 3: Alternative page approach...");
              
              // Quick visit to market data page
              await page.goto("https://www.nseindia.com/market-data", { 
                waitUntil: "domcontentloaded",
                timeout: 5000
              });
              
              // Minimal wait
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Try API access
              data = await page.evaluate(async (url) => {
                try {
                  const resp = await fetch(url, {
                    method: 'GET',
                    headers: {
                      "Accept": "application/json, text/plain, */*",
                      "Accept-Language": "en-US,en;q=0.9",
                      "Referer": "https://www.nseindia.com/market-data",
                      "X-Requested-With": "XMLHttpRequest"
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
              
              console.log("✅ Strategy 3 succeeded - Alternative page approach worked!");
              strategySuccess = true;
              
            } catch (strategy3Error) {
              console.log("❌ Strategy 3 failed:", strategy3Error.message);
              throw new Error(`All strategies failed. Last error: ${strategy3Error.message}`);
            }
          }
        }
        
        if (!strategySuccess) {
          throw new Error("No strategy succeeded");
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
          const retryDelay = 200 + Math.random() * 300; // 0.2-0.5 seconds with randomization
          console.log(`🔄 Retrying in ${Math.round(retryDelay/1000)} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // Enhanced error responses with better categorization
        clearTimeout(timeoutId);
        if (err.message.includes('timeout')) {
          res.status(408).json({ 
            error: "Request timeout - NSE server may be slow", 
            suggestion: "Try again in a few minutes",
            url: apiUrl 
          });
        } else if (err.message.includes('403') || err.message.includes('Access Denied') || err.message.includes('Forbidden')) {
          res.status(403).json({ 
            error: "Access denied by NSE - anti-bot protection triggered", 
            suggestion: "Wait 5-10 minutes before retrying",
            url: apiUrl 
          });
        } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          res.status(401).json({ 
            error: "Unauthorized - session not established properly", 
            suggestion: "Try again - session establishment may have failed",
            url: apiUrl 
          });
        } else if (err.message.includes('net::ERR_') || err.message.includes('network')) {
          res.status(502).json({ 
            error: "Network error accessing NSE", 
            suggestion: "Check NSE server status and try again",
            url: apiUrl 
          });
        } else {
          res.status(500).json({ 
            error: "Unexpected error: " + err.message,
            suggestion: "Check logs for more details",
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
