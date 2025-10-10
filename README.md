NSE imposes restrictions on accessing the Promoters’ Insider Trading API directly via Google Apps Script or Node.js APIs. To work around this, I deployed Puppeteer on Vercel to access the URL like a real user and return the response. Google Apps Script then calls this Vercel endpoint to fetch the NSE data.

https://prosperity-eta.vercel.app/api/fetch?url=NSE URL

Example
https://prosperity-eta.vercel.app/api/fetch?url=https%3A%2F%2Fwww.nseindia.com%2Fapi%2Fcorporates-pit%3Findex%3Dequities%26from_date%3D10-09-2025%26to_date%3D10-10-2025
