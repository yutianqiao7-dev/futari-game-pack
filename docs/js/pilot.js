'use strict';
// ===== ふたりで宇宙船: 1人がそうじゅう、1人がしゃげき。1P側が計算して、毎フレーム画面の状態を送る =====
Games.pilot = {
  start(env) {
    const W = 360, H = 640, host = env.host, pilot = (env.slot === 0) !== env.flip;
    const cv = el('canvas', 'gamecanvas'); env.root.appendChild(cv);
    const view = fitCanvas(cv, W, H), c = cv.getContext('2d');
    // ホスト側の状態
    const ship = { x: W / 2, y: H - 120 };
    let ptx = W / 2, pty = H - 120, aim = { x: W / 2, y: 200, on: false }, ang = -Math.PI / 2;
    let lives = 3, inv = 0, score = 0, time = 0, fireCd = 0, spawnT = 2.4, droneT = 9, nextId = 1, over = false;
    let en = [], bl = [], eb = [], evq = [];
    // 表示用
    let V = { s: [W / 2, H - 120, -Math.PI / 2, 0, 3, 0, W / 2, 200, 0], e: [], b: [], q: [] };
    let parts = [], shake = 0, red = 0, t0 = 0, raf = 0, last = performance.now(), shown = false, laserCd = 0, bg = null, bgKey = '';
    const stars = []; for (let i = 0; i < 70; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() });
    const shapes = {};
    let myIn = { x: W / 2, y: pilot ? H - 120 : 200, on: false }, dirty = true;

    // --- 入力 ---
    function setIn(e, on) {
      const p = view.pt(e);
      if (pilot) { myIn.x = clamp(p.x, 18, W - 18); myIn.y = clamp(p.y - 48, H * 0.42, H - 34); }
      else { myIn.x = clamp(p.x, 0, W); myIn.y = clamp(p.y, 0, H); myIn.on = on; }
      dirty = true;
    }
    cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} setIn(e, true); });
    cv.addEventListener('pointermove', e => { if (e.pressure > 0 || e.buttons) setIn(e, true); });
    const up = () => { if (!pilot) { myIn.on = false; dirty = true; } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    function applyIn(role, m) { if (role === 'p') { ptx = m.x; pty = m.y; } else { aim.x = m.x; aim.y = m.y; aim.on = !!m.on; } }

    // --- 演出(両方の端末で同じものを出す) ---
    function boom(x, y, n, cols, sp, size) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rand(0.15, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.3, 0.8), size: rand(0.5, 1) * size, col: cols[i % cols.length] }); } }
    function fxEvent(k, x, y, a) {
      if (k === 'laser') { if (laserCd <= 0) { Snd.play('laser'); laserCd = 0.07; } }
      else if (k === 'ehit') { boom(x, y, 4, ['#fff', '#7ee8fa'], 120, 3); Snd.play('ehit'); }
      else if (k === 'expl') { boom(x, y, 14 + a * 16 | 0, ['#fff', '#ffd166', '#ff7b00', '#ff3d00', '#8d99ae'], 160 + a * 120, 4 + a * 2.5); parts.push({ x, y, ring: true, t: 0, life: 0.4, size: 22 + a * 26, col: '#ffe8a3', vx: 0, vy: 0 }); Snd.play('expl', Math.min(1.6, a)); shake = Math.max(shake, 2 + a * 3); }
      else if (k === 'hurt') { Snd.play('hurt'); Snd.vibrate(250); shake = 16; red = 1; boom(x, y, 40, ['#fff', '#ff5d8f', '#ffb703'], 380, 6); }
      else if (k === 'eshot') Snd.play('eshot');
      else if (k === 'power') { Snd.play('power'); boom(x, y, 24, ['#fff', '#ff9ebb', '#ffd166'], 240, 5); FX.text(innerWidth / 2, innerHeight * 0.6, 'ライフ +1', '#ff9ebb', 34); }
    }
    function emit(k, x, y, a) { fxEvent(k, x, y, a); evq.push([k, Math.round(x), Math.round(y), +(a || 0).toFixed(2)]); }

    // --- ゲーム計算(ホストのみ) ---
    function spawnRock(x, y, r, vx, vy) { en.push({ id: nextId++, k: 0, x, y, r, vx, vy, hp: Math.ceil(r / 8) }); }
    function kill(e, byShot) {
      e.dead = true; emit('expl', e.x, e.y, e.k === 1 ? 1.3 : e.r / 22);
      if (byShot) score += e.k === 1 ? 50 : Math.round(e.r / 2) * 2;
      if (e.k === 0 && e.r > 23) { const r = e.r * 0.56; spawnRock(e.x - r * 0.6, e.y, r, e.vx - rand(40, 80), e.vy * rand(0.9, 1.2)); spawnRock(e.x + r * 0.6, e.y, r, e.vx + rand(40, 80), e.vy * rand(0.9, 1.2)); }
      if (e.k === 1 && lives < 3 && Math.random() < 0.45) en.push({ id: nextId++, k: 2, x: e.x, y: e.y, r: 11, vx: 0, vy: 75, hp: 99 });
    }
    function damage() {
      lives--; inv = 2.2; emit('hurt', ship.x, ship.y, 0);
      if (lives <= 0) { over = true; emit('expl', ship.x, ship.y, 2.5); }
    }
    function hostUpdate(dt) {
      if (pilot) applyIn('p', myIn); else applyIn('g', myIn);
      if (!over) {
        time += dt; inv = Math.max(0, inv - dt);
        const dif = 1 + time / 45;
        // 宇宙船
        const dx = ptx - ship.x, dy = pty - ship.y, d = Math.hypot(dx, dy), mx = 560 * dt;
        if (d <= mx) { ship.x = ptx; ship.y = pty; } else { ship.x += dx / d * mx; ship.y += dy / d * mx; }
        if (Math.hypot(aim.x - ship.x, aim.y - ship.y) > 12) ang = Math.atan2(aim.y - ship.y, aim.x - ship.x);
        fireCd -= dt;
        if (aim.on && fireCd <= 0) { fireCd = 0.125; const cx = Math.cos(ang), sy = Math.sin(ang); bl.push({ x: ship.x + cx * 20, y: ship.y + sy * 20, vx: cx * 660, vy: sy * 660 }); emit('laser', ship.x, ship.y, 0); }
        // 出現
        spawnT -= dt;
        if (spawnT <= 0) { const r = rand(13, 31); spawnRock(rand(r, W - r), -r - 4, r, rand(-35, 35), rand(55, 100) * Math.min(2.1, Math.sqrt(dif))); spawnT = Math.max(0.3, 1.25 - time * 0.011) * rand(0.7, 1.3); }
        droneT -= dt;
        if (droneT <= 0 && time > 6) { en.push({ id: nextId++, k: 1, x: rand(40, W - 40), y: -22, r: 17, vx: 0, vy: 0, hp: 3, ty: rand(70, 230), ph: rand(0, 6), st: rand(1, 2) }); droneT = Math.max(3, 9 - time * 0.07) * rand(0.8, 1.2); }
        // 敵
        for (const e of en) {
          if (e.k === 1) {
            if (e.y < e.ty) e.y += 95 * dt; else { e.x = clamp(e.x + Math.sin(time * 1.4 + e.ph) * 80 * dt, 24, W - 24); e.st -= dt; if (e.st <= 0) { e.st = Math.max(0.9, 2.3 - time * 0.012); const a = Math.atan2(ship.y - e.y, ship.x - e.x), v = 185 + Math.min(120, time * 1.2); eb.push({ x: e.x, y: e.y + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v }); emit('eshot', e.x, e.y, 0); } }
          } else { e.x += e.vx * dt; e.y += e.vy * dt; if (e.k === 0 && ((e.x < e.r && e.vx < 0) || (e.x > W - e.r && e.vx > 0))) e.vx *= -1; }
          if (e.y > H + e.r + 12) e.dead = true;
          if (!e.dead && Math.hypot(e.x - ship.x, e.y - ship.y) < e.r + 13) {
            if (e.k === 2) { e.dead = true; lives = Math.min(3, lives + 1); emit('power', e.x, e.y, 0); }
            else if (inv <= 0) { kill(e, false); damage(); }
          }
        }
        // 弾
        for (const b of bl) {
          b.x += b.vx * dt; b.y += b.vy * dt; if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) { b.dead = true; continue; }
          for (const e of en) { if (e.dead || e.k === 2) continue; if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 4) { b.dead = true; e.hp--; e.fl = 0.08; if (e.hp <= 0) kill(e, true); else emit('ehit', b.x, b.y, 0); break; } }
        }
        for (const q of eb) {
          q.x += q.vx * dt; q.y += q.vy * dt; if (q.x < -10 || q.x > W + 10 || q.y < -10 || q.y > H + 10) q.dead = true;
          else if (inv <= 0 && !over && Math.hypot(q.x - ship.x, q.y - ship.y) < 15) { q.dead = true; damage(); }
        }
        en = en.filter(e => !e.dead); bl = bl.filter(b => !b.dead); eb = eb.filter(q => !q.dead);
        for (const e of en) if (e.fl > 0) e.fl -= dt;
      }
      const r1 = v => Math.round(v * 10) / 10;
      V = { s: [r1(ship.x), r1(ship.y), Math.round(ang * 100) / 100, inv > 0 ? 1 : 0, lives, score, Math.round(aim.x), Math.round(aim.y), aim.on ? 1 : 0], e: [], b: [], q: [] };
      for (const e of en) V.e.push(e.id, e.k, r1(e.x), r1(e.y), r1(e.r), e.fl > 0 ? 1 : 0);
      for (const b of bl) V.b.push(r1(b.x), r1(b.y));
      for (const q of eb) V.q.push(r1(q.x), r1(q.y));
      env.send({ t: 'ps', s: V.s, e: V.e, b: V.b, q: V.q, ev: evq, o: over ? 1 : 0 }); evq = [];
    }

    // --- 描画 ---
    function buildBg() {
      bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height; bgKey = cv.width + 'x' + cv.height + (Img.get('space_planet') ? 'i' : '');
      const g = bg.getContext('2d'); g.setTransform(view.s, 0, 0, view.s, 0, 0);
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#050316'); gr.addColorStop(0.55, '#0d0b3a'); gr.addColorStop(1, '#1b0f4a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      [[70, 150, 190, 'rgba(120,60,220,.33)'], [300, 380, 220, 'rgba(20,150,200,.22)'], [120, 560, 200, 'rgba(220,50,120,.2)']].forEach(([x, y, r, col]) => { gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
      // 遠くの惑星(Blender で作った画像があればそれを使う)
      const pl = Img.get('space_planet');
      if (pl) { const ph = 184 * pl.naturalHeight / pl.naturalWidth; g.drawImage(pl, 300 - 92, 104 - ph / 2, 184, ph); return; }
      gr = g.createRadialGradient(288, 92, 4, 300, 104, 46); gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(0.6, '#c2553a'); gr.addColorStop(1, '#3a1030'); g.fillStyle = gr; g.beginPath(); g.arc(300, 104, 40, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,220,170,.55)'; g.lineWidth = 3; g.beginPath(); g.ellipse(300, 104, 64, 13, -0.35, 0, 7); g.stroke();
    }
    function shapeOf(id, r) {
      if (!shapes[id]) { const q = rng(id * 7919 + 13), pts = []; const n = 10; for (let i = 0; i < n; i++) pts.push(0.76 + q() * 0.3); shapes[id] = { pts, spin: (q() - 0.5) * 1.8, cr: [[q() * 0.8 - 0.4, q() * 0.8 - 0.4, 0.14 + q() * 0.14], [q() * 0.9 - 0.45, q() * 0.9 - 0.45, 0.1 + q() * 0.1], [q() * 0.8 - 0.4, q() * 0.8 - 0.4, 0.07 + q() * 0.08]] }; }
      return shapes[id];
    }
    function rock(id, x, y, r, fl) {
      const s = shapeOf(id), n = s.pts.length, rot = t0 * s.spin;
      const im = Img.get('space_rock' + (id % 4));
      if (im) {     // 画像は半径の2.5倍の幅
        const d = r * 2.5; c.save(); c.translate(x, y); c.rotate(rot + id); c.drawImage(im, -d / 2, -d / 2, d, d);
        if (fl) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; c.drawImage(im, -d / 2, -d / 2, d, d); }
        c.restore(); return;
      }
      c.save(); c.translate(x, y); c.rotate(rot);
      c.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * 6.283, k = s.pts[i % n] * r, px = Math.cos(a) * k, py = Math.sin(a) * k; if (i === 0) c.moveTo(px, py); else { const a0 = (i - 0.5) / n * 6.283, k0 = (s.pts[i % n] + s.pts[(i - 1) % n]) / 2 * r * 1.04; c.quadraticCurveTo(Math.cos(a0) * k0, Math.sin(a0) * k0, px, py); } } c.closePath();
      c.rotate(-rot); const g = c.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.15); g.addColorStop(0, fl ? '#fff' : '#c9b8a8'); g.addColorStop(0.55, fl ? '#ffe' : '#7d6b62'); g.addColorStop(1, '#2e2530');
      c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#1b1520'; c.stroke();
      c.clip(); c.rotate(rot); for (const k of s.cr) { c.fillStyle = 'rgba(30,20,30,.42)'; c.beginPath(); c.arc(k[0] * r, k[1] * r, k[2] * r, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,235,215,.25)'; c.lineWidth = 1.2; c.beginPath(); c.arc(k[0] * r, k[1] * r, k[2] * r, 0.6, 2.6); c.stroke(); }
      c.restore();
    }
    function drone(x, y, fl) {
      c.save(); c.translate(x, y + Math.sin(t0 * 5 + x) * 2);
      let g = c.createRadialGradient(0, 14, 0, 0, 14, 22); g.addColorStop(0, 'rgba(255,90,140,.7)'); g.addColorStop(1, 'rgba(255,90,140,0)'); c.fillStyle = g; c.fillRect(-24, -4, 48, 40);
      const im = Img.get('space_drone');
      if (im) {
        const dh = 52 * im.naturalHeight / im.naturalWidth;      // 画像の縦横比のまま
        c.drawImage(im, -26, -dh / 2 - 2, 52, dh);
        if (fl) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; c.drawImage(im, -26, -dh / 2 - 2, 52, dh); }
        c.restore(); return;
      }
      g = c.createLinearGradient(0, -10, 0, 12); g.addColorStop(0, fl ? '#fff' : '#e9ecf5'); g.addColorStop(0.5, fl ? '#fff' : '#8791b3'); g.addColorStop(1, '#343a5c');
      c.fillStyle = g; c.strokeStyle = '#161a33'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 3, 21, 9, 0, 0, 7); c.fill(); c.stroke();
      g = c.createRadialGradient(-4, -9, 1, 0, -4, 12); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ff8fb1'); g.addColorStop(1, '#a01a58'); c.fillStyle = g; c.beginPath(); c.arc(0, -1, 10.5, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      for (let i = -2; i <= 2; i++) { c.fillStyle = (Math.floor(t0 * 6) + i) % 2 ? '#ffd166' : '#ff3d6e'; c.beginPath(); c.arc(i * 7.5, 5.5, 1.8, 0, 7); c.fill(); }
      c.restore();
    }
    function heart(x, y) {
      c.save(); c.translate(x, y); const s = 1 + Math.sin(t0 * 8) * 0.1; c.scale(s, s); c.shadowColor = '#ff5d8f'; c.shadowBlur = 16;
      const im = Img.get('space_heart');
      if (im) { c.drawImage(im, -18, -18, 36, 36); c.restore(); return; }
      const g = c.createRadialGradient(-3, -4, 1, 0, 0, 13); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ff8fb1'); g.addColorStop(1, '#e01e5a'); c.fillStyle = g;
      c.beginPath(); c.moveTo(0, 10); c.bezierCurveTo(-16, -2, -8, -13, 0, -5); c.bezierCurveTo(8, -13, 16, -2, 0, 10); c.fill(); c.restore();
    }
    function drawShip(x, y, a, invOn) {
      c.save(); c.translate(x, y);
      if (invOn) { c.globalAlpha = 0.45 + 0.4 * Math.sin(t0 * 30); }
      const sp = Img.get('space_ship'), tu = Img.get('space_turret');
      if (sp && tu) {     // Blender で作った機体(画像の幅 0.64 単位 = 60px)
        for (const ex of [-5.9, 5.6]) {     // Gemini の機体のエンジン位置に合わせた、ゆらめく噴射
          const f = 9 + Math.random() * 8, g = c.createLinearGradient(0, 22, 0, 22 + f); g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#7ee8fa'); g.addColorStop(1, 'rgba(40,120,255,0)');
          c.fillStyle = g; c.beginPath(); c.moveTo(ex - 3, 22); c.quadraticCurveTo(ex, 22 + f * 1.5, ex + 3, 22); c.fill();
        }
        c.drawImage(sp, -30, -30, 60, 60);
        c.save(); c.translate(0, 5); c.rotate(a); c.drawImage(tu, -15, -15, 30, 30); c.restore();
        if (invOn) { c.globalAlpha = 0.5 + 0.3 * Math.sin(t0 * 12); c.strokeStyle = '#7ee8fa'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, 31, 0, 7); c.stroke(); }
        c.restore(); return;
      }
      // 炎
      const fl = 16 + Math.random() * 10; let g = c.createLinearGradient(0, 14, 0, 14 + fl); g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#ffd166'); g.addColorStop(1, 'rgba(255,60,0,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(-6, 14); c.quadraticCurveTo(0, 14 + fl * 1.5, 6, 14); c.fill();
      // 翼
      g = c.createLinearGradient(-24, 0, 24, 0); g.addColorStop(0, '#b3123f'); g.addColorStop(0.5, '#ff5d8f'); g.addColorStop(1, '#b3123f');
      c.fillStyle = g; c.strokeStyle = '#2a0b1c'; c.lineWidth = 1.6; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(-7, 0); c.lineTo(-25, 14); c.lineTo(-22, 20); c.lineTo(-6, 15); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(7, 0); c.lineTo(25, 14); c.lineTo(22, 20); c.lineTo(6, 15); c.closePath(); c.fill(); c.stroke();
      // 胴体
      g = c.createLinearGradient(-10, 0, 10, 0); g.addColorStop(0, '#8d9ab8'); g.addColorStop(0.45, '#ffffff'); g.addColorStop(1, '#7c89a8');
      c.fillStyle = g; c.strokeStyle = '#1d2540'; c.beginPath(); c.moveTo(0, -24); c.bezierCurveTo(11, -12, 11, 6, 8, 16); c.lineTo(-8, 16); c.bezierCurveTo(-11, 6, -11, -12, 0, -24); c.closePath(); c.fill(); c.stroke();
      g = c.createLinearGradient(0, -14, 0, 0); g.addColorStop(0, '#bff3ff'); g.addColorStop(1, '#1d4ed8'); c.fillStyle = g; c.beginPath(); c.ellipse(0, -9, 4.6, 7.5, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(-1.6, -12, 1.4, 2.8, 0, 0, 7); c.fill();
      // 砲台
      c.save(); c.translate(0, 5); c.rotate(a);
      c.fillStyle = '#39445e'; c.strokeStyle = '#11162b'; c.lineWidth = 1.4; c.beginPath(); c.rect(2, -2.6, 17, 5.2); c.fill(); c.stroke();
      c.fillStyle = '#80ffdb'; c.fillRect(16, -2.6, 3, 5.2);
      g = c.createRadialGradient(-2, -2, 1, 0, 0, 7); g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#80ffdb'); g.addColorStop(1, '#0d7a66'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 6.5, 0, 7); c.fill(); c.stroke();
      c.restore();
      if (invOn) { c.globalAlpha = 0.5 + 0.3 * Math.sin(t0 * 12); c.strokeStyle = '#7ee8fa'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, 31, 0, 7); c.stroke(); }
      c.restore();
    }
    function draw(dt) {
      if (!bg || bgKey !== cv.width + 'x' + cv.height + (Img.get('space_planet') ? 'i' : '')) buildBg();
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      const sx = shake > 0.3 ? rand(-shake, shake) : 0, sy = shake > 0.3 ? rand(-shake, shake) : 0;
      c.setTransform(view.s, 0, 0, view.s, sx * view.s, sy * view.s);
      c.drawImage(bg, 0, 0, W, H);
      for (const s of stars) { s.y += (30 + s.z * 150) * dt; if (s.y > H) { s.y = -2; s.x = Math.random() * W; } c.fillStyle = `rgba(255,255,255,${0.3 + s.z * 0.7})`; c.fillRect(s.x, s.y, 1 + s.z * 1.2, 1.5 + s.z * 6); }
      const S = V.s, e = V.e, b = V.b, q = V.q, dead = S[4] <= 0;
      // ねらい線
      if (!dead) { c.strokeStyle = S[8] ? 'rgba(128,255,219,.38)' : 'rgba(128,255,219,.14)'; c.lineWidth = 1.5; c.setLineDash([5, 7]); c.beginPath(); c.moveTo(S[0], S[1] + 5); c.lineTo(S[0] + Math.cos(S[2]) * 520, S[1] + 5 + Math.sin(S[2]) * 520); c.stroke(); c.setLineDash([]); }
      for (let i = 0; i < e.length; i += 6) { if (e[i + 1] === 0) rock(e[i], e[i + 2], e[i + 3], e[i + 4], e[i + 5]); else if (e[i + 1] === 1) drone(e[i + 2], e[i + 3], e[i + 5]); else heart(e[i + 2], e[i + 3]); }
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < b.length; i += 2) { const g = c.createRadialGradient(b[i], b[i + 1], 0, b[i], b[i + 1], 9); g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#80ffdb'); g.addColorStop(1, 'rgba(0,255,200,0)'); c.fillStyle = g; c.fillRect(b[i] - 9, b[i + 1] - 9, 18, 18); }
      for (let i = 0; i < q.length; i += 2) { const g = c.createRadialGradient(q[i], q[i + 1], 0, q[i], q[i + 1], 11); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ff5d8f'); g.addColorStop(1, 'rgba(255,0,80,0)'); c.fillStyle = g; c.fillRect(q[i] - 11, q[i + 1] - 11, 22, 22); }
      c.globalCompositeOperation = 'source-over';
      if (!dead) drawShip(S[0], S[1], S[2], S[3]);
      // 照準
      if (S[8] && !dead) { c.strokeStyle = '#80ffdb'; c.lineWidth = 2; c.beginPath(); c.arc(S[6], S[7], 13 + Math.sin(t0 * 14) * 2, 0, 7); c.moveTo(S[6] - 20, S[7]); c.lineTo(S[6] - 7, S[7]); c.moveTo(S[6] + 7, S[7]); c.lineTo(S[6] + 20, S[7]); c.moveTo(S[6], S[7] - 20); c.lineTo(S[6], S[7] - 7); c.moveTo(S[6], S[7] + 7); c.lineTo(S[6], S[7] + 20); c.stroke(); }
      // 爆発
      c.globalCompositeOperation = 'lighter';
      parts = parts.filter(p => { p.t += dt; if (p.t >= p.life) return false; const k = 1 - p.t / p.life; c.globalAlpha = k; if (p.ring) { c.strokeStyle = p.col; c.lineWidth = 3 * k + 0.5; c.beginPath(); c.arc(p.x, p.y, p.size * (1 - k) + 3, 0, 7); c.stroke(); } else { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size * k + 0.3, 0, 7); c.fill(); } return true; });
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      if (red > 0) { c.fillStyle = `rgba(255,40,80,${red * 0.4})`; c.fillRect(0, 0, W, H); }
      // 表示
      for (let i = 0; i < 3; i++) { c.save(); c.translate(22 + i * 27, 24); c.scale(0.95, 0.95); c.fillStyle = i < S[4] ? '#ff5d8f' : 'rgba(255,255,255,.16)'; if (i < S[4]) { c.shadowColor = '#ff5d8f'; c.shadowBlur = 10; } c.beginPath(); c.moveTo(0, 10); c.bezierCurveTo(-16, -2, -8, -13, 0, -5); c.bezierCurveTo(8, -13, 16, -2, 0, 10); c.fill(); c.restore(); }
      c.textAlign = 'right'; c.textBaseline = 'middle'; c.font = '900 24px system-ui,sans-serif'; c.lineWidth = 5; c.strokeStyle = 'rgba(5,5,25,.7)'; c.strokeText(String(S[5]), W - 14, 24); c.fillStyle = '#ffd166'; c.fillText(String(S[5]), W - 14, 24);
      c.textAlign = 'center'; c.font = '800 13px "Hiragino Maru Gothic ProN","Yu Gothic",system-ui,sans-serif'; c.fillStyle = pilot ? 'rgba(255,160,190,.9)' : 'rgba(128,255,219,.9)'; c.fillText(pilot ? 'あなたは そうじゅう係' : 'あなたは しゃげき係', W / 2, H - 14);
      if (t0 < 4.5) {
        c.globalAlpha = Math.min(1, (4.5 - t0) * 2); c.font = '900 30px "Hiragino Maru Gothic ProN","Yu Gothic",system-ui,sans-serif'; c.lineWidth = 8; c.lineJoin = 'round'; c.strokeStyle = 'rgba(5,5,25,.85)';
        const l1 = pilot ? 'そうじゅう係' : 'しゃげき係', l2 = pilot ? '指で船を動かして よけろ!' : '画面をおさえて うちまくれ!', col = pilot ? '#ff9ebb' : '#80ffdb';
        c.strokeText(l1, W / 2, H * 0.38); c.fillStyle = col; c.fillText(l1, W / 2, H * 0.38); c.font = '800 19px "Hiragino Maru Gothic ProN","Yu Gothic",system-ui,sans-serif'; c.lineWidth = 6; c.strokeText(l2, W / 2, H * 0.38 + 40); c.fillStyle = '#fff'; c.fillText(l2, W / 2, H * 0.38 + 40); c.globalAlpha = 1;
      }
    }
    function finish(sc) {
      if (shown) return; shown = true;
      let best = 0; try { best = +localStorage.getItem('fp_pilot_best') || 0; } catch (e) {}
      const rec = sc > best; if (rec) { try { localStorage.setItem('fp_pilot_best', String(sc)); } catch (e) {} }
      env.later(() => env.result({ kind: rec ? 'clear' : 'draw', title: rec ? 'しんきろく!' : 'ゲームオーバー', sub: rec ? 'ふたりの最高スコア こうしん!' : 'この端末のベスト ' + best, extra: `<div class="res-score">${sc}</div>` }), 1300);
    }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t0 += dt; laserCd -= dt;
      if (host) { hostUpdate(dt); if (over) finish(score); }
      else if (dirty) { dirty = false; env.send({ t: 'pi', r: pilot ? 'p' : 'g', x: Math.round(myIn.x), y: Math.round(myIn.y), on: myIn.on ? 1 : 0 }); }
      shake *= Math.pow(0.02, dt); red = Math.max(0, red - dt * 2);
      draw(dt);
    }
    raf = requestAnimationFrame(loop);

    return {
      msg(m) {
        if (m.t === 'pi' && host) applyIn(m.r, m);
        else if (m.t === 'ps' && !host) { V = m; (m.ev || []).forEach(e => fxEvent(e[0], e[1], e[2], e[3])); if (m.o) finish(m.s[5]); }
      },
      stop() { cancelAnimationFrame(raf); view.off(); }
    };
  }
};
