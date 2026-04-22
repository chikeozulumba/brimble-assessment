const http = require('http');
const port = process.env.PORT || 3000;
http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Hello from brimble deployment. Host: ${require('os').hostname()}\n`);
}).listen(port, () => console.log(`listening on ${port}`));
