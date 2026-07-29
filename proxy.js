const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CERT = fs.readFileSync(path.join(__dirname, '.proxy', 'cert.pem'));
const KEY = fs.readFileSync(path.join(__dirname, '.proxy', 'key.pem'));

https.createServer({ key: KEY, cert: CERT }, (req, res) => {
  const proxy = http.request({
    hostname: '127.0.0.1',
    port: 4627,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'fusion.one' },
  }, (upstream) => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });
  proxy.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(proxy);
}).listen(443, () => console.log('https://fusion.one'));
