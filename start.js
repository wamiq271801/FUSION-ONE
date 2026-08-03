const next = require('next');
const http = require('http');

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  http.createServer((req, res) => {
    handle(req, res);
  }).listen(5262, '127.0.0.1', () => {
    console.log('http://localhost:5262');
  });
});
