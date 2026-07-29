const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROXY_PORT = 443;
const NEXTJS_PORT = process.env.NEXTJS_PORT || '3001';
const CERT_PATH = path.join(__dirname, 'cert.pem');
const KEY_PATH = path.join(__dirname, 'key.pem');

if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
  console.error('Certificates not found. Run cert generation first.');
  process.exit(1);
}

const options = {
  key: fs.readFileSync(KEY_PATH),
  cert: fs.readFileSync(CERT_PATH),
};

const server = https.createServer(options, (req, res) => {
  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: NEXTJS_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: 'fusion.one' },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', () => {
    res.writeHead(502);
    res.end('Service unavailable');
  });
  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`Proxy listening on https://fusion.one:${PROXY_PORT}`);
});
