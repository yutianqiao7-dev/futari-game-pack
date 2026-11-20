'use strict';
// ===== 陣取りペイント: 通った所が自分の色になる。60秒で多く塗ったほうの勝ち。
//   ダッシュで体当たりすると相手を少し止められる。ペンキ爆弾を取るとまわりを一気に塗る =====
Games.paint = {
  start(env) {
    const W = 360, H = 640, CS = 20, GX = W / CS, GY = H / CS, NC = GX * GY, TIME = 60, SPD = 140, PR = 17;
    const cv = el('canvas', 'gamecanvas'); env.root.appendChild(cv);
    const hud = el('div', 'pt-hud', `<div class="pt-bar"><i class="me"></i><i class="op"></i></div><div class="pt-time">${TIME}</div>`); env.root.appendChild(hud);
    const dashBtn = el('button', 'pt-dash', 'ダッシュ'); env.root.appendChild(dashBtn);
    const view = fitCanvas(cv, W, H), c = cv.getContext('2d'), host = env.host;
    const grid = new Int8Array(NC).fill(-1);            // 自分の画面の向きで: 0 = じぶん, 1 = あいて
    const P = [{ x: W / 2, y: H - 70, dx: 0, dy: -1, stun: 0, dash: 0, cd: 0 }, { x: W / 2, y: 70, dx: 0, dy: 1, stun: 0, dash: 0, cd: 0 }];
    const inp = [{ x: 0, y: 0, d: 0 }, { x: 0, y: 0, d: 0 }];
    let phase = 'count', timer = 3.3, count = 3, lastC = 4, tm = TIME, item = null, itemT = 5, changed = [], out = [], raf = 0, last = performance.now(), shown = false;
    let parts = [], banner = '', bannerT = 0, bannerCol = '#fff', stick = null, keys = {}, layer = null, layerS = 0, dirty = [];

    // --- 入力: 画面のどこでもドラッグ = スティック、ボタン = ダッシュ ---
    cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} const p = view.pt(e); stick = { ox: p.x, oy: p.y, x: p.x, y: p.y, id: e.pointerId }; });
    cv.addEventListener('pointermove', e => { if (stick && e.pointerId === stick.id) { const p = view.pt(e); stick.x = p.x; stick.y = p.y; } });
    const up = e => { if (stick && e.pointerId === stick.id) stick = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    let dashReq = 0;
    dashBtn.addEventListener('pointerdown', e => { e.preventDefault(); dashReq = 1; });
    const kd = e => { keys[e.key] = e.type === 'keydown'; if (e.key === ' ' && e.type === 'keydown') dashReq = 1; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', kd);
    function myInput() {
      let x = 0, y = 0;
      if (stick) { x = stick.x - stick.ox; y = stick.y - stick.oy; const d = Math.hypot(x, y); if (d < 6) { x = 0; y = 0; } else { const k = Math.min(1, d / 40) / d; x *= k; y *= k; } }
      if (keys.ArrowLeft) x -= 1; if (keys.ArrowRight) x += 1; if (keys.ArrowUp) y -= 1; if (keys.ArrowDown) y += 1;
      const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; }
      const r = { x, y, d: dashReq }; dashReq = 0; return r;
    }

    // --- 演出 ---
    const COL = [['#4cc9f0', '#1e6fd9'], ['#ff5d8f', '#c9184a']];
    function splash(x, y, who, n) { const cs = COL[who]; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rand(40, 220); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.3, 0.6), size: rand(2, 5), col: cs[i % 2] }); } }
    function fxEvent(k, x, y, a) {
      if (k === 'count') Snd.play('count');
      else if (k === 'go') { Snd.play('go'); banner = 'スタート!'; bannerCol = '#7ee8fa'; bannerT = 0.8; }
      else if (k === 'dash') { Snd.play('laser'); splash(x, y, a, 8); }
      else if (k === 'bump') { Snd.play('clash'); Snd.vibrate(a === 1 ? 60 : 160); splash(x, y, a, 26); banner = a === 0 ? '体当たり!' : 'ぶつけられた!'; bannerCol = a === 0 ? '#ffd166' : '#ff9ebb'; bannerT = 0.9; }
      else if (k === 'bomb') { Snd.play('splash'); splash(x, y, a, 40); if (a === 0) { banner = 'ペンキ爆弾!'; bannerCol = '#ffd166'; bannerT = 0.8; } }
      else if (k === 'tick') Snd.play('tick');
    }
    function emit(k, x, y, a) { fxEvent(k, x, y, a); out.push([k, Math.round(W - x), Math.round(H - y), a === 0 || a === 1 ? 1 - a : a]); }

    // --- ゲームの計算(ホストのみ) ---
    function paintAt(x, y, who, r) {
      const x0 = Math.max(0, Math.floor((x - r) / CS)), x1 = Math.min(GX - 1, Math.floor((x + r) / CS)), y0 = Math.max(0, Math.floor((y - r) / CS)), y1 = Math.min(GY - 1, Math.floor((y + r) / CS));
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const cx = gx * CS + CS / 2, cy = gy * CS + CS / 2; if (Math.hypot(cx - x, cy - y) > r + 4) continue;
        const i = gy * GX + gx; if (grid[i] !== who) { grid[i] = who; changed.push(i, who); dirty.push(i); }
      }
    }
    function hostStep(dt) {
      for (let k = 0; k < 2; k++) {
        const p = P[k], o = P[1 - k], u = inp[k];
        p.cd = Math.max(0, p.cd - dt); p.stun = Math.max(0, p.stun - dt); p.dash = Math.max(0, p.dash - dt);
        if (p.stun > 0) continue;
        if (u.d && p.cd <= 0) { p.dash = 0.28; p.cd = 2.2; u.d = 0; emit('dash', p.x, p.y, k); }
        const mv = Math.hypot(u.x, u.y); if (mv > 0.05) { p.dx = u.x / mv; p.dy = u.y / mv; }
        const sp = p.dash > 0 ? SPD * 3.1 : SPD * Math.min(1, mv);
        const vx = p.dash > 0 ? p.dx : u.x, vy = p.dash > 0 ? p.dy : u.y;
        p.x = clamp(p.x + vx * sp * dt, PR, W - PR); p.y = clamp(p.y + vy * sp * dt, PR, H - PR);
        paintAt(p.x, p.y, k, PR + (p.dash > 0 ? 4 : 0));
        // 体当たり: ダッシュ中にぶつかると相手が止まる
        if (p.dash > 0 && o.stun <= 0 && Math.hypot(p.x - o.x, p.y - o.y) < PR * 2) {
          o.stun = 1.6; p.dash = 0; o.x = clamp(o.x + p.dx * 46, PR, W - PR); o.y = clamp(o.y + p.dy * 46, PR, H - PR);
          emit('bump', o.x, o.y, k);
        }
        if (item && Math.hypot(p.x - item.x, p.y - item.y) < PR + 16) { paintAt(item.x, item.y, k, 66); emit('bomb', item.x, item.y, k); item = null; itemT = rand(6, 9); }
      }
      // 2人が重なったら押し合う
      const dx = P[1].x - P[0].x, dy = P[1].y - P[0].y, d = Math.hypot(dx, dy) || 0.01;
      if (d < PR * 2) { const push = (PR * 2 - d) / 2; P[0].x -= dx / d * push; P[0].y -= dy / d * push; P[1].x += dx / d * push; P[1].y += dy / d * push; }
      itemT -= dt; if (!item && itemT <= 0) item = { x: rand(50, W - 50), y: rand(120, H - 120) };
    }
    function hostUpdate(dt) {
      const mi = myInput(); inp[0].x = mi.x; inp[0].y = mi.y; if (mi.d) inp[0].d = 1;
      if (phase === 'count') {
        timer -= dt; const n = Math.ceil(timer - 0.3); count = clamp(n, 0, 3);
        if (n < lastC && n >= 1) { lastC = n; emit('count', 0, 0, 2); }
        if (timer <= 0.3) { phase = 'play'; emit('go', 0, 0, 2); }
      } else if (phase === 'play') {
        const before = Math.ceil(tm); tm -= dt; if (Math.ceil(tm) !== before && tm <= 5 && tm > 0) emit('tick', 0, 0, 2);
        hostStep(dt);
        if (tm <= 0) { tm = 0; phase = 'over'; }
      }
      const r = v => Math.round(v);
      const g = []; for (let k = 0; k < changed.length; k += 2) g.push(NC - 1 - changed[k], 1 - changed[k + 1]);
      env.send({ t: 'ts', p: [r(W - P[1].x), r(H - P[1].y), r(W - P[0].x), r(H - P[0].y)], f: [+P[1].stun.toFixed(2), +P[0].stun.toFixed(2), P[1].dash > 0 ? 1 : 0, P[0].dash > 0 ? 1 : 0, +P[1].cd.toFixed(1)],
        it: item ? [r(W - item.x), r(H - item.y)] : 0, tm: +tm.toFixed(1), ph: phase, c: count, g, ev: out,
        fin: phase === 'over' ? Array.from(grid, v => v < 0 ? 2 : 1 - v).join('') : undefined });
      changed = []; out = [];
    }
    function guestUpdate() { const mi = myInput(); env.send({ t: 'tm', x: +(-mi.x).toFixed(2), y: +(-mi.y).toFixed(2), d: mi.d }); }

    // --- 描画 ---
    function buildLayer() { layer = document.createElement('canvas'); layer.width = cv.width; layer.height = cv.height; layerS = view.s; dirty = []; for (let i = 0; i < NC; i++) if (grid[i] >= 0) dirty.push(i); }
    // ペンキの層: マスごとに少し大きめの丸を重ねて、ぬった所がなめらかにつながるようにする(変化があった時だけ描き直す)
    const PAL = [['#3a9bea'], ['#ec4f86']];
    function paintLayer() {
      if (!layer || layer.width !== cv.width || layerS !== view.s) buildLayer();
      if (!dirty.length) return; dirty = [];
      const g = layer.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, layer.width, layer.height); g.setTransform(view.s, 0, 0, view.s, 0, 0);
      for (let pass = 0; pass < 1; pass++) for (let v = 0; v < 2; v++) {
        g.fillStyle = PAL[v][pass]; g.globalAlpha = pass ? 0.35 : 1; g.beginPath();
        for (let i = 0; i < NC; i++) {
          if (grid[i] !== v) continue;
          const x = (i % GX) * CS + CS / 2, y = Math.floor(i / GX) * CS + CS / 2, w = ((i * 7919) % 5) * 0.6;   // 丸の大きさを少しずつ変えてペンキらしく
          if (pass) { g.moveTo(x - 2 + CS * 0.3, y - 3); g.arc(x - 2, y - 3, CS * 0.3, 0, 7); } else { g.moveTo(x + CS * 0.74 + w, y); g.arc(x, y, CS * 0.74 + w, 0, 7); }
        }
        g.fill();
      }
      g.globalAlpha = 1;
    }
    function hero(p, mine) {
      const im = Img.get(mine ? 'pt_blue' : 'pt_pink'), s = PR * 2.6, bob = Math.sin(performance.now() / 130 + (mine ? 0 : 2)) * 1.5;
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(p.x, p.y + PR * 0.75, PR * 0.95, PR * 0.45, 0, 0, 7); c.fill();
      c.save(); c.translate(p.x, p.y + bob); if (p.stun > 0) { c.rotate(Math.sin(performance.now() / 50) * 0.3); c.globalAlpha = 0.75; }
      if (p.dash > 0) { c.shadowColor = mine ? '#4cc9f0' : '#ff5d8f'; c.shadowBlur = 20; }
      if (im) c.drawImage(im, -s / 2, -s / 2 - 4, s, s); else { c.fillStyle = COL[mine ? 0 : 1][0]; c.beginPath(); c.arc(0, 0, PR, 0, 7); c.fill(); }
      c.restore(); c.globalAlpha = 1; c.shadowBlur = 0;
      if (p.stun > 0) { c.font = '900 16px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('★', p.x + Math.cos(performance.now() / 120) * 14, p.y - PR - 8); }
    }
    function draw(dt) {
      paintLayer();
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      c.setTransform(view.s, 0, 0, view.s, 0, 0);
      const fl = Img.get('pt_floor'); if (fl) c.drawImage(fl, 0, 0, W, H); else { c.fillStyle = '#d9dde6'; c.fillRect(0, 0, W, H); }
      c.globalAlpha = 0.88; c.drawImage(layer, 0, 0, W, H); c.globalAlpha = 1;
      if (item) { const s = 40 + Math.sin(performance.now() / 160) * 3, im = Img.get('pt_bomb'); c.fillStyle = 'rgba(255,220,80,.35)'; c.beginPath(); c.arc(item.x, item.y, s * 0.6, 0, 7); c.fill(); if (im) c.drawImage(im, item.x - s / 2, item.y - s / 2, s, s); }
      hero(P[1], false); hero(P[0], true);
      parts = parts.filter(p => { p.t += dt; if (p.t >= p.life) return false; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy *= 0.93; c.globalAlpha = 1 - p.t / p.life; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size, 0, 7); c.fill(); return true; });
      c.globalAlpha = 1;
      if (stick) { c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(stick.ox, stick.oy, 40, 0, 7); c.stroke(); const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy), k = d > 40 ? 40 / d : 1; c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(stick.ox + dx * k, stick.oy + dy * k, 16, 0, 7); c.fill(); }
      let txt = '', col = '#fff', size = 58;
      if (phase === 'count' && count >= 1) { txt = String(count); size = 120; col = '#ffd166'; } else if (bannerT > 0) { txt = banner; col = bannerCol; c.globalAlpha = Math.min(1, bannerT * 3); }
      if (txt) { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 ' + size + 'px "Hiragino Maru Gothic ProN","Yu Gothic",system-ui,sans-serif'; c.lineJoin = 'round'; c.lineWidth = 10; c.strokeStyle = 'rgba(5,8,30,.8)'; c.strokeText(txt, W / 2, H / 2); c.fillStyle = col; c.fillText(txt, W / 2, H / 2); c.globalAlpha = 1; }
      if (phase === 'count') { c.textAlign = 'center'; c.font = '800 14px system-ui,sans-serif'; c.fillStyle = '#1b1f3b'; c.fillText('画面をドラッグして移動・ボタンでダッシュ体当たり', W / 2, H - 120); }
      // HUD
      let a = 0, b = 0; for (let i = 0; i < NC; i++) { if (grid[i] === 0) a++; else if (grid[i] === 1) b++; }
      hud.querySelector('.me').style.width = (a / NC * 100) + '%'; hud.querySelector('.op').style.width = (b / NC * 100) + '%';
      hud.querySelector('.pt-time').textContent = Math.ceil(tm); hud.querySelector('.pt-time').classList.toggle('low', tm <= 10);
      dashBtn.classList.toggle('cd', P[0].cd > 0);
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (host) hostUpdate(dt); else guestUpdate();
      bannerT -= dt; draw(dt);
      if (phase === 'over' && !shown) {
        shown = true; let a = 0, b = 0; for (let i = 0; i < NC; i++) { if (grid[i] === 0) a++; else if (grid[i] === 1) b++; }
        const k = a > b ? 'win' : a < b ? 'lose' : 'draw', pa = Math.round(a / NC * 100), pb = Math.round(b / NC * 100);
        Snd.play('alarm');
        env.later(() => env.result({ kind: k, title: k === 'win' ? 'かち!' : k === 'lose' ? 'まけ…' : 'ひきわけ', sub: `じぶん ${pa}% ・ あいて ${pb}%`, peek: true }), 900);
      }
    }
    raf = requestAnimationFrame(loop);

    return {
      msg(m) {
        if (m.t === 'tm' && host) { inp[1].x = m.x; inp[1].y = m.y; if (m.d) inp[1].d = 1; }
        else if (m.t === 'ts' && !host) {
          P[0].x = m.p[0]; P[0].y = m.p[1]; P[1].x = m.p[2]; P[1].y = m.p[3];
          P[0].stun = m.f[0]; P[1].stun = m.f[1]; P[0].dash = m.f[2] ? 1 : 0; P[1].dash = m.f[3] ? 1 : 0; P[0].cd = m.f[4];
          item = m.it ? { x: m.it[0], y: m.it[1] } : null; tm = m.tm; phase = m.ph; count = m.c;
          for (let k = 0; k < m.g.length; k += 2) { grid[m.g[k]] = m.g[k + 1]; dirty.push(m.g[k]); }
          if (m.fin) { for (let i = 0; i < NC; i++) { const v = +m.fin[NC - 1 - i]; grid[i] = v === 2 ? -1 : v; } buildLayer(); }
          (m.ev || []).forEach(e => fxEvent(e[0], e[1], e[2], e[3]));
        }
      },
      stop() { cancelAnimationFrame(raf); view.off(); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', kd); }
    };
  }
};
