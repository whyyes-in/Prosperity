const puppeteer = require('puppeteer');
const { Hono } = require('hono');
const { serve } = require('@hono/node-server');

const screenshot = async (url) => {
  const browser = await puppeteer.launch({ args: ['--single-process', '--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url);
  const img = await page.screenshot();
  await browser.close();

  return img;
};

const app = new Hono();

app.get('/', async (c) => {
  const url = c.req.query('url');

  if (url) {
    const img = await screenshot(url);
    return c.body(img, { headers: { 'Content-Type': 'image/png' } });
  } else {
    return c.text('Please add an ?url=https://example.com/ parameter');
  }
});

const port = 8080;
serve({ fetch: app.fetch, port }).on('listening', () => {
  console.log(`Server is running on port ${port}`);
});
