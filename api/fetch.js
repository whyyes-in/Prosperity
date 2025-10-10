import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  const apiUrl = req.query.url;
  
  // Enhanced validation
  if (!apiUrl) {
    return res.status(400).json({ error: "Missing url parameter" });
  }
  
  // Security: Only allow NSE URLs
  if (!apiUrl.startsWith('https://www.nseindia.com/')) {
    return res.status(400).json({ error: "Only NSE India URLs are allowed" });
  }

  let browser = null;
  try {
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
        '--disable-gpu'
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Set realistic headers
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // 1️⃣ First visit NSE homepage to establish cookies/session
    await page.goto("https://www.nseindia.com", { 
      waitUntil: "networkidle2",
      timeout: 30000 
    });

    // Wait a bit more to ensure session is fully established (reduced for Vercel)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2️⃣ Now navigate to the API URL directly (this preserves the session)
    await page.goto(apiUrl, { 
      waitUntil: "networkidle2",
      timeout: 30000 
    });

    // Get the page content and check response type
    const contentType = await page.evaluate(() => {
      return document.contentType || 'text/html';
    });
    
    const data = await page.content();
    
    // Handle different response types
    if (contentType.includes('application/json') || data.trim().startsWith('{') || data.trim().startsWith('[')) {
      try {
        const jsonData = JSON.parse(data);
        await browser.close();
        res.status(200).json(jsonData);
        return;
      } catch (parseError) {
        console.log('JSON parse error:', parseError.message);
        // Fall through to text response
      }
    }
    
    // Return as text for non-JSON responses
    await browser.close();
    res.status(200).send(data);
  } catch (err) {
    console.error('NSE API Error:', err.message);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Browser close error:', closeError.message);
      }
    }
    
    // Enhanced error responses
    if (err.message.includes('timeout')) {
      res.status(408).json({ error: "Request timeout - NSE server may be slow" });
    } else if (err.message.includes('net::ERR_')) {
      res.status(502).json({ error: "Network error accessing NSE" });
    } else {
      res.status(500).json({ error: "Internal server error", details: err.message });
    }
  }
}
