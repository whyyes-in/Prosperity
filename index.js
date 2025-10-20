const puppeteer = require('puppeteer');
const { Hono } = require('hono');
const { serve } = require('@hono/node-server');

// Helper function to create browser with anti-detection settings
const createBrowser = async () => {
  return await puppeteer.launch({ 
    args: [
      '--single-process', 
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-http2',
      '--disable-blink-features=AutomationControlled',
      '--disable-extensions',
      '--disable-plugins',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    headless: 'new',
    ignoreDefaultArgs: ['--enable-automation']
  });
};

// Helper function to configure page with realistic browser settings
const configurePage = async (page) => {
  // Set a realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Set additional headers to appear more like a real browser
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
  });
  
  // Set viewport to a common desktop size
  await page.setViewport({ width: 1366, height: 768 });
  
  // Remove webdriver property
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
};

// Helper function to wait (replaces waitForTimeout for older Puppeteer versions)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main function to visit baseUrl then actualUrl and return content
const getPageContent = async (baseUrl, actualUrl) => {
  const browser = await createBrowser();
  const page = await browser.newPage();
  
  try {
    await configurePage(page);
    
    console.log(`First visiting base URL: ${baseUrl}`);
    
    // First visit the base URL to establish session
    try {
      await page.goto(baseUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });
      console.log('Base URL loaded successfully');
      
      // Wait a bit to simulate human behavior
      await wait(2000);
      
      // Scroll a bit to simulate human interaction
      await page.evaluate(() => {
        window.scrollTo(0, 100);
      });
      
      await wait(1000);
    } catch (error) {
      console.log('Base URL failed, continuing to target URL...');
    }
    
    console.log(`Now visiting target URL: ${actualUrl}`);
    
    // Now visit the actual target URL
    let success = false;
    let lastError = null;
    
    // Try different wait strategies for the target URL
    try {
      await page.goto(actualUrl, { 
        waitUntil: 'networkidle2', 
        timeout: 15000 
      });
      success = true;
    } catch (error) {
      lastError = error;
      console.log('Networkidle2 failed, trying domcontentloaded...');
      
      // Fallback to domcontentloaded
      try {
        await page.goto(actualUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 15000 
        });
        success = true;
      } catch (error2) {
        lastError = error2;
        console.log('Domcontentloaded failed, trying load...');
        
        // Final fallback to load
        await page.goto(actualUrl, { 
          waitUntil: 'load', 
          timeout: 15000 
        });
        success = true;
      }
    }
    
    if (!success) {
      throw lastError;
    }
    
    // Wait a bit more for dynamic content to load
    await wait(3000);
    
    // Get the page content
    const content = await page.content();
    
    await browser.close();
    return content;
  } catch (error) {
    await browser.close();
    throw error;
  }
};

const app = new Hono();

// Main endpoint - takes baseUrl and actualUrl as parameters
app.get('/', async (c) => {
  const baseUrl = c.req.query('baseUrl');
  const actualUrl = c.req.query('actualUrl');

  if (!baseUrl || !actualUrl) {
    return c.text('Please provide both baseUrl and actualUrl parameters. Example: ?baseUrl=https://www.nseindia.com&actualUrl=https://www.nseindia.com/api/holiday-master?type=trading');
  }

  // Decode the URLs in case they were URL encoded
  const decodedBaseUrl = decodeURIComponent(baseUrl);
  const decodedActualUrl = decodeURIComponent(actualUrl);

  console.log('Received baseUrl:', decodedBaseUrl);
  console.log('Received actualUrl:', decodedActualUrl);

  try {
    const content = await getPageContent(decodedBaseUrl, decodedActualUrl);
    return c.text(content, { 
      headers: { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache'
      } 
    });
  } catch (error) {
    console.error('Content fetch error:', error.message);
    return c.json({ 
      error: 'Failed to fetch content', 
      details: error.message 
    }, 500);
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const port = 8080;
serve({ fetch: app.fetch, port }).on('listening', () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Usage: http://localhost:${port}/?baseUrl=<base_url>&actualUrl=<target_url>`);
  console.log(`Note: URL encode the actualUrl parameter if it contains & characters`);
  console.log(`Example: actualUrl=https%3A//www.nseindia.com/api/corporates-pit%3Findex%3Dequities%26from_date%3D19-07-2025%26to_date%3D19-10-2025`);
});