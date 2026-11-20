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
          if (m.o) {                       // COM の勝ち: 残っていた艦の位置を見せる
            over = true;
            reply({ t: 'bf', ships: ships.filter(s => s.hits < s.len).map(s => ({ len: s.len, x: s.x, y: s.y, v: s.v })) });
          }
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
    },
    // 封印のとびら は、COMが古文書を読み上げる形にしているので、やりとりは escape.js の中で完結する

    // --- 心理戦じゃんけん: 前と同じ手は出さない。ダブルはたまに使う ---
    janken(start, reply, later) {
      let prev = -1, used = false, picked = null, playerLocked = false, sent = false;
      const reveal = () => { if (picked && playerLocked && !sent) { sent = true; reply({ t: 'jr', h: picked.h, d: picked.d ? 1 : 0 }); } };
      const pick = () => {
        if (picked) return;
        const ok = [0, 1, 2].filter(h => h !== prev), w = ok.map(h => [1, 1.1, 1.25][h]); let r = Math.random() * w.reduce((a, b) => a + b), h = ok[0];
        for (let i = 0; i < ok.length; i++) { r -= w[i]; if (r <= 0) { h = ok[i]; break; } }
        const d = !used && Math.random() < 0.2; if (d) used = true;
        picked = { h, d }; reply({ t: 'jp' }); reveal();
      };
      later(pick, rand(1500, 4000));
      return m => {
        if (m.t === 'jp') { playerLocked = true; if (!picked) later(pick, rand(400, 1300)); reveal(); }
        else if (m.t === 'jr') { prev = picked ? picked.h : -1; picked = null; playerLocked = false; sent = false; later(pick, rand(4600, 8000)); }
      };
    },

    // --- 地雷原しかけ合い: 数字から危ないマスをよけて掘り、ほどほどで得点にする ---
    mines(start, reply, later) {
      const N = 6, C = N * N, MINES = 7, GOAL = 15;
      const nb = i => { const x = i % N, y = Math.floor(i / N), a = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < N && Y < N) a.push(Y * N + X); } return a; };
      const mine = new Array(C).fill(false); shuffle([...Array(C).keys()]).slice(0, MINES).forEach(i => mine[i] = true);
      const myOpen = new Array(C).fill(-1), view = new Array(C).fill(-1);
      let ready = [false, false], turn = start.flip ? 0 : 1, bank = 0, tp = 0, goal = rand(3, 6), over = false;   // turn 0 = COM
      function dig(i) {
        if (mine[i]) return { b: 1, c: [i, -2] };
        return { b: 0, c: [i, nb(i).filter(j => mine[j]).length] };
      }
      function risk(i) {
        let r = -1;
        for (const k of nb(i)) {
          if (view[k] < 0) continue;
          const ns = nb(k), known = ns.filter(j => view[j] === -2).length, unk = ns.filter(j => view[j] === -1).length;
          if (unk) r = Math.max(r, (view[k] - known) / unk);
        }
        if (r >= 0) return r;
        const unkAll = view.filter(v => v === -1).length, left = MINES - view.filter(v => v === -2).length;
        return unkAll ? left / unkAll : 1;
      }
      function choose() {
        let best = [], bs = 9;
        for (let i = 0; i < C; i++) { if (view[i] !== -1) continue; const r = risk(i) + Math.random() * 0.04; if (r < bs - 1e-9) { bs = r; best = [i]; } }
        return { i: best[0], r: bs };
      }
      function go() {
        if (over || turn !== 0 || !ready[0] || !ready[1]) return;
        const ch = choose(); if (ch.i == null) return;
        if (tp > 0 && (tp >= goal || ch.r > 0.32)) { bank += tp; tp = 0; turn = 1; goal = rand(3, 6); reply({ t: 'me' }); if (bank >= GOAL) over = true; return; }
        reply({ t: 'mo', i: ch.i });
      }
      later(() => { ready[0] = true; reply({ t: 'mready' }); later(go, 1200); }, rand(1500, 2600));
      return m => {
        if (m.t === 'mready') { ready[1] = true; later(go, 1500); }
        else if (m.t === 'mr') {
          for (let k = 0; k < m.c.length; k += 2) view[m.c[k]] = m.c[k + 1];
          if (m.b) { tp = 0; turn = 1; }
          else { tp += m.c.length / 2; if (bank + tp >= GOAL) { over = true; bank += tp; tp = 0; reply({ t: 'me' }); return; } later(go, rand(900, 1500)); }
        }
        else if (m.t === 'mo') {
          const r = dig(m.i); for (let k = 0; k < r.c.length; k += 2) myOpen[r.c[k]] = r.c[k + 1];
          reply({ t: 'mr', i: m.i, b: r.b, c: r.c });
          if (r.b) { turn = 0; later(go, 1800); }
        }
        else if (m.t === 'me') { turn = 0; later(go, 1400); }
        else if (m.t === 'mf') { over = true; reply({ t: 'mf', m: mine.map((v, i) => v ? i : -1).filter(i => i >= 0) }); }
      };
    },

    // --- 入札オークション: のこりのお宝に合わせてコインを配分する ---
    auction(start, reply, later) {
      const V = [8, 6, 5, 4, 3, 2, -5, -3], lots = shuffle(V.slice(), rng(start.seed));
      if (lots[0] < 0) lots.push(lots.shift());
      let idx = 0, coins = 100, bid = null, playerLocked = false, sent = false;
      const reveal = () => { if (bid != null && playerLocked && !sent) { sent = true; reply({ t: 'av', v: bid }); } };
      const pick = () => {
        if (bid != null || idx >= lots.length) return;
        const v = lots[idx], rest = lots.slice(idx).filter(x => x > 0).reduce((a, b) => a + b, 0) || 1;
        let b = v > 0 ? coins * v / rest * rand(0.75, 1.45) : Math.abs(v) * rand(1.5, 4.5);
        bid = clamp(Math.round(b), 0, coins); reply({ t: 'ab' }); reveal();
      };
      later(pick, rand(2000, 4500));
      return m => {
        if (m.t === 'ab') { playerLocked = true; if (bid == null) later(pick, rand(500, 1500)); reveal(); }
        else if (m.t === 'av') {
          if (bid !== m.v && bid > m.v) coins -= bid;
          idx++; bid = null; playerLocked = false; sent = false;
          later(pick, rand(4200, 7500));
        }
      };
    },

    // --- ピンポン: 玉がくる位置を読んで動く(少しおくれて、少しずれる) ---
    pong(start, reply) {
      const W = 360, H = 640, PY = H - 74, PW = 74;
      let x = W / 2, last = performance.now(), err = 0, lastVy = 0, hits = 0;
      return m => {
        if (m.t !== 'gs') return;
        const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
        const [bx, by, vx, vy] = m.b; let tx = W / 2;
        if (m.ph !== 'play') hits = 0;
        if (Math.sign(vy) !== Math.sign(lastVy)) { hits++; err = rand(-1, 1) * (24 + Math.min(hits, 14) * 4.5); }   // ラリーが続くほどずれやすい
        lastVy = vy;
        if (m.ph === 'play' && vy > 0) {
          let px = bx + vx * ((PY - by) / vy); const L = W - 16;          // 壁で反射する分も計算
          px -= 8; px = ((px % (2 * L)) + 2 * L) % (2 * L); if (px > L) px = 2 * L - px; px += 8;
          tx = px + err;
        } else if (m.ph === 'serve' && m.sv === 1) tx = W / 2 + Math.sin(now / 400) * 60;
        x += clamp(tx - x, -440 * dt, 440 * dt); x = clamp(x, PW / 2, W - PW / 2);
        reply({ t: 'gm', x: W - x });
      };
    },

    // --- 陣取りペイント: まだ塗っていない所をねらい、近くにきたら体当たり ---
    paint(start, reply) {
      const W = 360, H = 640, CS = 20, GX = 18, NC = GX * 32;
      const grid = new Int8Array(NC).fill(-1); let tgt = null, tgtT = 0, last = performance.now();
      return m => {
        if (m.t !== 'ts') return;
        const now = performance.now(), dt = (now - last) / 1000; last = now; tgtT -= dt;
        for (let k = 0; k < m.g.length; k += 2) grid[m.g[k]] = m.g[k + 1];
        const [x, y, ox, oy] = m.p;
        if (m.ph !== 'play' || m.f[0] > 0) { reply({ t: 'tm', x: 0, y: 0, d: 0 }); return; }
        if (m.it && Math.hypot(m.it[0] - x, m.it[1] - y) < 230) tgt = { x: m.it[0], y: m.it[1] };
        else if (!tgt || tgtT <= 0 || Math.hypot(tgt.x - x, tgt.y - y) < 12) {
          let best = null, bs = 1e9;
          for (let n = 0; n < 50; n++) {
            const i = Math.floor(Math.random() * NC); if (grid[i] === 0) continue;
            const cx = (i % GX) * CS + CS / 2, cy = Math.floor(i / GX) * CS + CS / 2, s = Math.hypot(cx - x, cy - y) - (grid[i] === 1 ? 40 : 0);
            if (s < bs) { bs = s; best = { x: cx, y: cy }; }
          }
          tgt = best || { x: rand(40, W - 40), y: rand(40, H - 40) }; tgtT = rand(0.8, 1.6);
        }
        let vx = tgt.x - x, vy = tgt.y - y; const d = Math.hypot(vx, vy) || 1; vx /= d; vy /= d;
        let dash = 0; const od = Math.hypot(ox - x, oy - y);
        if (od < 90 && m.f[4] <= 0 && Math.random() < 0.08) { vx = (ox - x) / od; vy = (oy - y) / od; dash = 1; }
        reply({ t: 'tm', x: +(-vx).toFixed(2), y: +(-vy).toFixed(2), d: dash });
      };
    }
  }
};
