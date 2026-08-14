const fs = require('fs');
let code = fs.readFileSync('sw.js', 'utf8');

code = code.replace(/self\.addEventListener\('install', event => \{/g, `self.addEventListener('install', event => {
  self.skipWaiting();`);

code = code.replace(/self\.addEventListener\('activate', event => \{/g, `self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());`);

code = code.replace(/sourcing-pro-cache-v16/g, 'sourcing-pro-cache-v17');

fs.writeFileSync('sw.js', code);
console.log("Fixed sw.js skipWaiting");
