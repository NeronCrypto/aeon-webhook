const http = require('http');
const https = require('https');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GH_TOKEN = process.env.GH_GLOBAL;
const GH_REPO = process.env.GH_REPO;

function dispatchToGitHub(message, source) {
  const payload = JSON.stringify({
    event_type: 'telegram-message',
    client_payload: { message, source }
  });

  const options = {
    hostname: 'api.github.com',
    path: `/repos/${GH_REPO}/dispatches`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'aeon-webhook',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(200);
    res.end('aeon-webhook running');
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const update = JSON.parse(body);
      const message = update?.message;
      const text = message?.text;
      const chatId = String(message?.chat?.id);

      if (text && chatId === TELEGRAM_CHAT_ID) {
        console.log(`Message reçu: ${text}`);
        const status = await dispatchToGitHub(text, 'telegram');
        console.log(`GitHub dispatch status: ${status}`);
      }

      res.writeHead(200);
      res.end('ok');
    } catch (e) {
      console.error(e);
      res.writeHead(200);
      res.end('ok');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Webhook listening on port ${PORT}`);
});

// Keep-alive ping toutes les 10 minutes
setInterval(() => {
  https.get('https://aeon-webhook.onrender.com', (res) => {
    console.log(`Keep-alive ping: ${res.statusCode}`);
  }).on('error', (e) => {
    console.error(`Keep-alive error: ${e.message}`);
  });
}, 10 * 60 * 1000);
