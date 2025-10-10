import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  const apiUrl = req.query.url;
  if (!apiUrl) return res.status(400).send("Missing url");

  let browser = null;
  try {
    // Use async executablePath() to get the binary reliably
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
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

    // Wait a bit more to ensure session is fully established
    await page.waitForTimeout(2000);

    // 2️⃣ Now navigate to the API URL directly (this preserves the session)
    await page.goto(apiUrl, { 
      waitUntil: "networkidle2",
      timeout: 30000 
    });

    // Get the page content - check if it's JSON
    const data = await page.content();
    
    // If the response is JSON, try to parse it and return clean JSON
    try {
      const jsonData = JSON.parse(data);
      await browser.close();
      res.status(200).json(jsonData);
      return;
    } catch (parseError) {
      // If not JSON, return as text
      await browser.close();
      res.status(200).send(data);
      return;
    }
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).send("Fetch error: " + err.message);
  }
}
