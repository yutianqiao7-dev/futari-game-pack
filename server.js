// ふたりであそぼう! ゲームパック — 追加インストール不要の通信サーバー
// 使い方: node server.js  → 同じWi-Fiのスマホ2台で表示されたURLを開く
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');

const PORT = +process.env.PORT || 8123;
const PUB = path.join(__dirname, 'docs');   // GitHub Pages と同じフォルダを配信する
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };

function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.')) out.push(i.address);
  out.sort((a, b) => (b.startsWith('192.168.') ? 1 : 0) - (a.startsWith('192.168.') ? 1 : 0));
  return out;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ips: lanIPs(), port: PORT, players: slots.filter(Boolean).length }));
    return;
  }
  let p;
  try { p = decodeURIComponent(u.pathname); } catch (e) { res.writeHead(400); res.end(); return; }
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(PUB, p));
  if (!f.startsWith(PUB)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('見つかりません'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

// ---- WebSocket(自前実装): 2人をつないでメッセージを中継するだけ ----
const slots = [null, null];

function frame(payload, op) {
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}
function sendJSON(sock, obj) { if (sock && !sock.destroyed) sock.write(frame(Buffer.from(JSON.stringify(obj)), 1)); }
function announce() {
  const n = slots.filter(Boolean).length;
  slots.forEach(s => sendJSON(s, { t: 'peers', n }));
}

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  sock.setNoDelay(true);

  const slot = !slots[0] ? 0 : !slots[1] ? 1 : -1;
  if (slot < 0) { sendJSON(sock, { t: 'full' }); sock.end(); return; }
  slots[slot] = sock;
  sock.lastSeen = Date.now();
  sendJSON(sock, { t: 'hello', slot });
  announce();

  let buf = Buffer.alloc(0);
  const drop = () => { if (slots[slot] === sock) { slots[slot] = null; announce(); } };
  sock.on('data', d => {
    sock.lastSeen = Date.now();
    buf = buf.length ? Buffer.concat([buf, d]) : d;
    for (;;) {
      if (buf.length < 2) break;
      const op = buf[0] & 15, masked = buf[1] & 128;
      let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const start = off + (masked ? 4 : 0), need = start + len;
      if (buf.length < need) break;
      let payload = Buffer.from(buf.subarray(start, need));
      if (masked) { const m = buf.subarray(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      buf = buf.subarray(need);
      if (op === 8) { sock.end(); drop(); return; }
      if (op === 9) { sock.write(frame(payload, 10)); continue; }
      if (op === 1) { const other = slots[1 - slot]; if (other && !other.destroyed) other.write(frame(payload, 1)); }
    }
  });
  sock.on('close', drop);
  sock.on('error', drop);
});

// 反応がなくなった接続を片づける(スマホのスリープなど)
setInterval(() => {
  const now = Date.now();
  slots.forEach(s => { if (s && now - s.lastSeen > 15000) s.destroy(); });
}, 5000);

server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.log('ポート ' + PORT + ' は使用中です。すでに起動していないか確認してください。');
  else console.log('エラー: ' + e.message);
  process.exit(1);
});
server.listen(PORT, '0.0.0.0', () => {
  const ips = lanIPs();
  console.log('');
  console.log('  ふたりであそぼう! ゲームパック 起動しました');
  console.log('  -------------------------------------------');
  console.log('  スマホ2台を このパソコンと同じWi-Fi につないで、下のURLを開いてください');
  ips.forEach(ip => console.log('    http://' + ip + ':' + PORT));
  console.log('');
  console.log('  QRコードつきの案内ページ(このパソコンで開く): http://localhost:' + PORT);
  console.log('  終了するときは この窓を閉じるか Ctrl+C');
  console.log('');
});
