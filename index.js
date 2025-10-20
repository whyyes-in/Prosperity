const express = require('express');

// Helper function to create realistic headers (matching working curl)
const createHeaders = () => {
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Priority': 'u=0, i',
    'Sec-CH-UA': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  };
};

// Helper function to wait (simulate delays)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to make fetch request with retries
const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} to fetch: ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...createHeaders(),
          ...options.headers
        },
        redirect: 'follow',
        timeout: 15000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // Exponential backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await wait(delay);
      }
    }
  }
  
  throw lastError;
};

// Helper function to extract relevant headers from response
const extractRelevantHeaders = (response) => {
  const relevantHeaders = {};
  
  // Headers that are commonly needed for authentication/session
  const headersToExtract = [
    'set-cookie',
    'authorization',
    'x-csrf-token',
    'x-requested-with',
    'x-api-key',
    'x-auth-token',
    'x-session-id',
    'x-csrf',
    'csrf-token',
    'authenticity-token',
    'x-xsrf-token',
    'x-csrf-token',
    'referer'
  ];
  
  // Extract headers from response
  headersToExtract.forEach(headerName => {
    const headerValue = response.headers.get(headerName);
    if (headerValue) {
      relevantHeaders[headerName] = headerValue;
      console.log(`Extracted header ${headerName}:`, headerValue);
    }
  });
  
  // Also log all available headers for debugging
  console.log('All response headers:');
  response.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });
  
  return relevantHeaders;
};

// Helper function to format cookies for Cookie header
const formatCookies = (setCookieHeaders) => {
  if (!setCookieHeaders) return '';
  
  // Handle both single cookie and multiple cookies
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  
  return cookies.map(cookie => {
    // Extract just the name=value part, ignoring attributes like Path, Domain, etc.
    return cookie.split(';')[0].trim();
  }).join('; ');
};

// Helper function to parse all cookies from set-cookie headers
const parseAllCookies = (response) => {
  const cookieHeader = response.headers.get('set-cookie');
  if (!cookieHeader) return '';
  
  console.log('Raw set-cookie header:', cookieHeader);
  
  // Handle multiple set-cookie headers (they come as an array)
  let cookieStrings = [];
  if (Array.isArray(cookieHeader)) {
    cookieStrings = cookieHeader;
  } else {
    // Split by comma, but be careful about cookie boundaries
    const parts = cookieHeader.split(',');
    let currentCookie = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      
      // Check if this looks like the start of a new cookie
      // Look for patterns like "name=value" at the start
      if (part.match(/^[a-zA-Z0-9_-]+=/)) {
        // This is likely a new cookie
        if (currentCookie) {
          cookieStrings.push(currentCookie);
        }
        currentCookie = part;
      } else {
        // This is a continuation of the current cookie
        currentCookie += ', ' + part;
      }
    }
    
    if (currentCookie) {
      cookieStrings.push(currentCookie);
    }
  }
  
  console.log('Parsed individual cookies:', cookieStrings);
  
  // Extract just the name=value part from each cookie, ignoring attributes
  const cookieValues = cookieStrings.map(cookie => {
    const nameValue = cookie.split(';')[0].trim();
    console.log(`Extracted cookie: ${nameValue}`);
    return nameValue;
  });
  
  const result = cookieValues.join('; ');
  console.log('Final cookie string:', result);
  
  return result;
};


// Main function to visit baseUrl then actualUrl and return content
const getPageContent = async (baseUrl, actualUrl) => {
  let sessionHeaders = {};
  
  try {
    console.log(`First visiting base URL: ${baseUrl}`);
    
    // First visit the base URL to establish session/cookies
    try {
      const baseResponse = await fetchWithRetry(baseUrl, {
        method: 'GET'
      });
      
      // Extract all relevant headers from the base response
      sessionHeaders = extractRelevantHeaders(baseResponse);
      
      // Parse all cookies properly
      const allCookies = parseAllCookies(baseResponse);
      if (allCookies) {
        sessionHeaders['Cookie'] = allCookies;
        console.log('All cookies for next request:', allCookies);
      }
      
      console.log('Base URL loaded successfully, extracted headers:', Object.keys(sessionHeaders));
      
      // Wait a bit to simulate human behavior
      await wait(2000);
      
    } catch (error) {
      console.log('Base URL failed, continuing to target URL...');
    }
    
    console.log(`Now visiting target URL: ${actualUrl}`);
    
    // Prepare headers for the target URL request using extracted cookies
    const targetHeaders = {
      ...sessionHeaders,
      // Add referer to show we came from the base URL
      'Referer': baseUrl
    };
    
    // Use extracted cookies from base URL
    if (sessionHeaders['Cookie']) {
      console.log('Using cookies extracted from base URL:', sessionHeaders['Cookie']);
    } else {
      console.log('No cookies extracted from base URL - this may cause authentication issues');
    }
    
    console.log('Sending headers to target URL:', targetHeaders);
    
    // Now visit the actual target URL with all extracted headers
    const targetResponse = await fetchWithRetry(actualUrl, {
      method: 'GET',
      headers: targetHeaders
    });
    
    // Wait a bit more for any dynamic content considerations
    await wait(1000);
    
    // Get the page content
    const content = await targetResponse.text();
    
    return content;
  } catch (error) {
    throw error;
  }
};

const app = express();

// Main endpoint - takes baseUrl and actualUrl as parameters
app.get('/', async (req, res) => {
  const baseUrl = req.query.baseUrl;
  const actualUrl = req.query.actualUrl;

  if (!baseUrl || !actualUrl) {
    return res.status(400).send('Please provide both baseUrl and actualUrl parameters. Example: ?baseUrl=https://www.nseindia.com&actualUrl=https://www.nseindia.com/api/holiday-master?type=trading');
  }

  // Decode the URLs in case they were URL encoded
  const decodedBaseUrl = decodeURIComponent(baseUrl);
  const decodedActualUrl = decodeURIComponent(actualUrl);

  console.log('Received baseUrl:', decodedBaseUrl);
  console.log('Received actualUrl:', decodedActualUrl);

  try {
    const content = await getPageContent(decodedBaseUrl, decodedActualUrl);
    res.set('Content-Type', 'text/plain');
    res.set('Cache-Control', 'no-cache');
    return res.send(content);
  } catch (error) {
    console.error('Content fetch error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch content', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  return res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Usage: http://localhost:${port}/?baseUrl=<base_url>&actualUrl=<target_url>`);
  console.log(`Note: URL encode the actualUrl parameter if it contains & characters`);
  console.log(`Example: actualUrl=https%3A//www.nseindia.com/api/corporates-pit%3Findex%3Dequities%26from_date%3D19-07-2025%26to_date%3D19-10-2025`);
});
