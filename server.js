const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, 'netlify/.env') });

const app = express();
const PORT = process.env.PORT || 8888;
const PUBLIC_DIR = path.join(__dirname, 'public');
const FUNCTIONS_DIR = path.join(__dirname, 'netlify/functions');

// Parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers (mirrors netlify.toml [[headers]])
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://members.nexusclimate.co https://climatesolutions.news https://news.nexusclimate.vc https://uaenews.nexusclimate.vc"
  );
  next();
});

// Netlify Functions adapter — translates Express req/res into Netlify event/context
app.all('/.netlify/functions/:name', async (req, res) => {
  const fnName = req.params.name;
  const fnPath = path.join(FUNCTIONS_DIR, `${fnName}.js`);

  if (!fs.existsSync(fnPath)) {
    return res.status(404).json({ error: `Function "${fnName}" not found` });
  }

  try {
    const fn = require(fnPath);

    // Build body string from parsed body
    const rawBody =
      req.headers['content-type']?.includes('application/json')
        ? JSON.stringify(req.body)
        : new URLSearchParams(req.body).toString();

    const event = {
      httpMethod: req.method,
      path: req.path,
      headers: req.headers,
      queryStringParameters: Object.keys(req.query).length ? req.query : null,
      body: rawBody || null,
      isBase64Encoded: false,
    };

    const context = {};

    // Ensure environment variables are available to the function handler
    // some legacy functions might rely on process.env directly, 
    // but we ensure the adapter is clean.
    const result = await fn.handler(event, context);

    const statusCode = result.statusCode || 200;
    const headers = result.headers || {};
    const body = result.body || '';

    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    res.status(statusCode).send(body);
  } catch (err) {
    console.error(`Error in function "${fnName}":`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Supabase OTP callback — load the React app so it can exchange the code for a session
app.get('/auth/callback', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'app.html')));

// Redirects (mirrors netlify.toml [[redirects]])
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
app.get('/app', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'app.html')));
app.get('/app/*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'app.html')));
app.get('/newuser-form', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'newmember-form.html')));
app.get('/newmember-signup', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'newmember-form.html')));
app.get('/newmember-form', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'newmember-form.html')));
app.get('/events-*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'event-page.html')));
app.get('/poll-*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'poll-page.html')));

// Serve static files from public/
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
