'use strict';
// ===== COM(コンピューターの相手): 2P側のふりをして、通信と同じメッセージをやりとりする =====
const Com = {
  // start: ゲーム開始メッセージ / deliver: COMからプレイヤーへメッセージを届ける関数
  create(start, deliver) {
    let alive = true; const timers = [];
    const reply = m => { Promise.resolve().then(() => { if (alive) deliver(m); }); };
    const later = (fn, ms) => { timers.push(setTimeout(() => { if (alive) fn(); }, ms)); };
    const make = Com.brains[start.game];
    const brain = make ? make(start, reply, later) : null;
    return { msg(m) { if (alive && brain) brain(m); }, stop() { alive = false; timers.forEach(clearTimeout); } };
  },
  brains: {
    // --- エアホッケー: 自分の陣地にパックが来たら打ち返し、それ以外はゴール前で守る ---
    hockey(start, reply) {
      const W = 360, H = 640, MR = 27;
      let bx = W / 2, by = H - 90, last = performance.now(), wob = 0;
      return m => {
        if (m.t !== 'hs') return;
        const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
        const px = m.p[0] + m.p[2] * 0.06, py = m.p[1] + m.p[3] * 0.06;
        let tx = W / 2, ty = H - 95, sp = 380;
        if (m.ph === 'play') {
          if (py > H / 2 - 12) {
            sp = 640;
            if (py < by - 6) { tx = px; ty = py - 8; }                                   // パックが前にある: つっこんで打つ
            else { tx = px + (bx < px ? -46 : 46); ty = Math.min(H - MR, py + 48); sp = 560; }   // うしろに回りこむ
          } else {
            wob += dt; tx = clamp(W / 2 + (px - W / 2) * 0.65 + Math.sin(wob * 2.2) * 14, 62, W - 62); ty = H - 100;
          }
        }
        const dx = tx - bx, dy = ty - by, d = Math.hypot(dx, dy), mx = sp * dt;
        if (d <= mx) { bx = tx; by = ty; } else { bx += dx / d * mx; by += dy / d * mx; }
        bx = clamp(bx, MR, W - MR); by = clamp(by, H / 2 + MR, H - MR);
        reply({ t: 'hm', x: W - bx, y: H - by });
      };
    },

    // --- エレメントデュエル: 手札からカードを出す ---
    cards(start, reply, later) {
      const deck = []; for (let e = 0; e < 3; e++) for (let p = 2; p <= 7; p++) deck.push({ e, p });
      shuffle(deck); const hand = deck.splice(0, 4);
      let picked = null, playerLocked = false, sent = false;
      const reveal = () => { if (picked && playerLocked && !sent) { sent = true; reply({ t: 'cr', e: picked.e, p: picked.p }); } };
      const pick = () => { if (picked || !hand.length) return; picked = hand.splice(Math.floor(Math.random() * hand.length), 1)[0]; reply({ t: 'cp' }); reveal(); };
      later(pick, rand(1600, 3200));
      return m => {
        if (m.t === 'cp') { playerLocked = true; if (!picked) later(pick, rand(500, 1100)); reveal(); }
        else if (m.t === 'cr') {                       // 1ラウンド終わり → 次のカードを考える
          if (deck.length) hand.push(deck.shift());
          picked = null; playerLocked = false; sent = false;
          if (hand.length) later(pick, rand(5400, 7200));
        }
      };
    },

    // --- かいせんバトル: 艦をならべ、当たったらそのまわりをねらう ---
    sea(start, reply, later) {
      const N = 8, LENS = [4, 3, 3, 2, 2];
      const cellsOf = s => { const a = []; for (let k = 0; k < s.len; k++) a.push(s.v ? (s.y + k) * N + s.x : s.y * N + s.x + k); return a; };
      const ships = [];
      LENS.forEach(len => {
        for (let t = 0; t < 800; t++) {
          const v = Math.random() < 0.5, x = Math.floor(Math.random() * (v ? N : N - len + 1)), y = Math.floor(Math.random() * (v ? N - len + 1 : N));
          const s = { len, x, y, v, hits: 0 }, c = cellsOf(s);
          if (!ships.some(o => cellsOf(o).some(i => c.includes(i)))) { ships.push(s); break; }
        }
      });
      const tried = new Array(N * N).fill(false); let live = [], over = false;   // live: 当てたがまだ沈めていないマス
      const botFirst = !!start.flip;
      function choose() {
        const cand = new Map();
        for (const h of live) {
          const hx = h % N, hy = Math.floor(h / N);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = hx + dx, y = hy + dy; if (x < 0 || y < 0 || x >= N || y >= N) continue; const i = y * N + x; if (tried[i]) continue;
            const bx = hx - dx, by = hy - dy, inLine = bx >= 0 && by >= 0 && bx < N && by < N && live.includes(by * N + bx);
            cand.set(i, Math.max(cand.get(i) || 0, inLine ? 3 : 1));
          }
        }
        let pool = [];
        if (cand.size) { const best = Math.max(...cand.values()); pool = [...cand.keys()].filter(i => cand.get(i) === best); }
        if (!pool.length) for (let i = 0; i < N * N; i++) if (!tried[i] && (i % N + Math.floor(i / N)) % 2 === 0) pool.push(i);
        if (!pool.length) for (let i = 0; i < N * N; i++) if (!tried[i]) pool.push(i);
        return pool[Math.floor(Math.random() * pool.length)];
      }
      function shoot() { if (over) return; const i = choose(); if (i == null) return; tried[i] = true; reply({ t: 'bs', i }); }
      later(() => reply({ t: 'br' }), 1200);
      return m => {
        if (m.t === 'br') { if (botFirst) later(shoot, 3200); }
        else if (m.t === 'bs') {
          const s = ships.find(s => cellsOf(s).includes(m.i)); let sunk = null, all = false;
          if (s) { s.hits++; if (s.hits >= s.len) { sunk = { len: s.len, x: s.x, y: s.y, v: s.v }; all = ships.every(o => o.hits >= o.len); } }
          if (all) over = true;
          reply({ t: 'bx', i: m.i, h: s ? 1 : 0, s: sunk, o: all });
          if (!all) later(shoot, 3300);
        }
        else if (m.t === 'bx') {
          if (m.h) live.push(m.i);
          if (m.s) { const c = cellsOf(m.s); live = live.filter(i => !c.includes(i)); }
          if (m.o) over = true;
        }
      };
    },

    // --- ふたりで宇宙船: プレイヤーがやらない方の係をうけもつ ---
    pilot(start, reply) {
      const W = 360, H = 640, gunner = !start.flip;     // プレイヤーがそうじゅう係なら、COMはしゃげき係
      let last = 0, prev = new Map(), curX = W / 2;
      return m => {
        if (m.t !== 'ps' || m.o) return;
        const now = performance.now(); if (now - last < 70) return; const dt = (now - last) / 1000; last = now;
        const S = m.s, e = m.e, sx = S[0], sy = S[1];
        if (gunner) {
          let best = null, bs = 1e9; const seen = new Map();
          for (let i = 0; i < e.length; i += 6) {
            const id = e[i], k = e[i + 1], x = e[i + 2], y = e[i + 3]; seen.set(id, [x, y]);
            if (k === 2 || y < -6) continue;
            const sc = Math.hypot(x - sx, y - sy) - (k === 1 ? 110 : 0) - (Math.abs(x - sx) < 50 ? 60 : 0);
            if (sc < bs) { bs = sc; best = [id, x, y]; }
          }
          if (best) {
            const p = prev.get(best[0]), d = Math.hypot(best[1] - sx, best[2] - sy), lead = d / 660;
            const vx = p && dt < 0.5 ? (best[1] - p[0]) / dt : 0, vy = p && dt < 0.5 ? (best[2] - p[1]) / dt : 0;
            reply({ t: 'pi', r: 'g', x: clamp(best[1] + vx * lead + rand(-16, 16), 0, W), y: clamp(best[2] + vy * lead + rand(-16, 16), 0, H), on: 1 });
          } else reply({ t: 'pi', r: 'g', x: sx, y: sy - 200, on: 0 });
          prev = seen;
        } else {
          const y0 = H - 125, th = [];
          for (let i = 0; i < e.length; i += 6) th.push([e[i + 2], e[i + 3], e[i + 4], e[i + 1]]);
          for (let i = 0; i < m.q.length; i += 2) th.push([m.q[i], m.q[i + 1], 10, 0]);
          let bx = curX, bd = 1e9;
          for (let x = 22; x <= W - 22; x += 16) {
            let d = Math.abs(x - W / 2) * 0.004 + Math.abs(x - sx) * 0.006;
            for (const t of th) {
              const up = y0 - t[1]; if (up < -45 || up > 300) continue;
              const near = 1 - Math.max(0, up) / 300, gap = Math.abs(t[0] - x) - t[2] - 16;
              if (t[3] === 2) { if (S[4] < 3) d -= near * 2 / (1 + Math.abs(t[0] - x) / 30); continue; }
              d += near * near * (gap < 0 ? 12 : 30 / (gap + 6));
            }
            if (d < bd) { bd = d; bx = x; }
          }
          curX = bx; reply({ t: 'pi', r: 'p', x: bx, y: y0 });
        }
      };
    }
    // 封印のとびら は、COMが古文書を読み上げる形にしているので、やりとりは escape.js の中で完結する
  }
};
