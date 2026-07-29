const https = require('https');
const next = require('next');
const fs = require('fs');
const path = require('path');

const CERT = fs.readFileSync(path.join(__dirname, '.proxy', 'cert.pem'));
const KEY = fs.readFileSync(path.join(__dirname, '.proxy', 'key.pem'));

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  https.createServer({ key: KEY, cert: CERT }, (req, res) => {
    handle(req, res);
  }).listen(443, () => {
    console.log('https://fusion.one');
  });
});
