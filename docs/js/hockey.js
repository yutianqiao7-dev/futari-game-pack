'use strict';
// ===== エアホッケー: 1P側(ホスト)が物理計算。相手には上下反転した座標で送る =====
Games.hockey = {
  start(env) {
    const W = 360, H = 640, PR = 15, MR = 27, GW = 150, WIN = 7, MAXV = 1500, MSPD = 2600;
    const cv = el('canvas', 'gamecanvas'); env.root.appendChild(cv);
    const view = fitCanvas(cv, W, H), c = cv.getContext('2d'), host = env.host;
    const puck = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    const me = { x: W / 2, y: H - 90, vx: 0, vy: 0, tx: W / 2, ty: H - 90 };
    const op = { x: W / 2, y: 90, vx: 0, vy: 0, tx: W / 2, ty: 90 };
    let score = [0, 0], phase = 'count', timer = 3.3, lastC = 4, count = 3;
    let flash = 0, flashMine = true, shake = 0, banner = '', bannerT = 0, bannerCol = '#fff', pulse = [0, 0];
    let parts = [], trail = [], out = [], recvT = performance.now(), base = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    let prevCount = -1, countT = 0;
    let raf = 0, last = performance.now(), acc = 0, shown = false, bg = null, bgKey = '', wallCd = 0, t0 = 0;
    const MINE = ['#e8fbff', '#4cc9f0', '#0b4f8a', '#7ee8fa'], THEIRS = ['#ffe3ee', '#ff5d8f', '#8a0b46', '#ff9ebb'];

    // --- 入力 ---
    function aim(e) { const p = view.pt(e); me.tx = clamp(p.x, MR, W - MR); me.ty = clamp(p.y - 26, H / 2 + MR, H - MR); }
    cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} aim(e); });
    cv.addEventListener('pointermove', e => { if (e.pressure > 0 || e.buttons) aim(e); });

    // --- 演出 ---
    function spark(x, y, n, cols, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rand(0.2, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.25, 0.6), size: rand(1.5, 3.6), col: cols[i % cols.length] }); } }
    function fxEvent(k, x, y, a) {
      if (k === 'hit') { spark(x, y, 6 + (a * 12 | 0), ['#fff', '#ffd166', '#ffb703'], 150 + 280 * a); Snd.play('hit', a); if (a > 0.5) shake = Math.max(shake, 3 * a); }
      else if (k === 'wall') { spark(x, y, 5, ['#fff', '#7ee8fa'], 120); Snd.play('wall'); }
      else if (k === 'goal') {
        const mine = a === 1; flash = 1; flashMine = mine; shake = 14; pulse[mine ? 0 : 1] = 1;
        banner = mine ? 'ゴール!' : 'やられた…'; bannerCol = mine ? '#ffd166' : '#ff9ebb'; bannerT = 1.5;
        spark(W / 2, mine ? 8 : H - 8, 60, mine ? ['#fff', '#ffd166', '#4cc9f0'] : ['#fff', '#ff5d8f', '#ffb3c8'], 520);
        Snd.play(mine ? 'goal' : 'conceded'); Snd.vibrate(mine ? [40, 30, 90] : 180);
      }
      else if (k === 'count') Snd.play('count');
      else if (k === 'go') { Snd.play('go'); banner = 'スタート!'; bannerCol = '#7ee8fa'; bannerT = 0.8; }
    }
    // ホスト: 自分に見せつつ、相手用に反転して送る
    function emit(k, x, y, a) {
      fxEvent(k, x, y, a);
      out.push([k, Math.round(W - x), Math.round(H - y), k === 'goal' ? 1 - a : +(a || 0).toFixed(2)]);
    }

    // --- 物理(ホストのみ) ---
    function moveMallet(m, dt) {
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy), mx = MSPD * dt;
      const nx = d <= mx ? m.tx : m.x + dx / d * mx, ny = d <= mx ? m.ty : m.y + dy / d * mx;
      m.vx = (nx - m.x) / dt; m.vy = (ny - m.y) / dt; m.x = nx; m.y = ny;
    }
    function collide(m) {
      const dx = puck.x - m.x, dy = puck.y - m.y, d = Math.hypot(dx, dy) || 0.001, min = PR + MR;
      if (d >= min) return;
      const nx = dx / d, ny = dy / d; puck.x = m.x + nx * min; puck.y = m.y + ny * min;
      const vn = (puck.vx - m.vx) * nx + (puck.vy - m.vy) * ny;
      if (vn < 0) { puck.vx -= 1.85 * vn * nx; puck.vy -= 1.85 * vn * ny; if (-vn > 60) emit('hit', puck.x - nx * PR, puck.y - ny * PR, clamp(-vn / 1000, 0.15, 1)); }
    }
    function wallHit(x, y) { if (wallCd <= 0 && Math.hypot(puck.vx, puck.vy) > 90) { emit('wall', x, y, 0); wallCd = 0.05; } }
    function goal(mineScored) {
      score[mineScored ? 0 : 1]++; emit('goal', W / 2, 0, mineScored ? 1 : 0);
      phase = 'goal'; timer = 1.7; puck.vx = puck.vy = 0; puck.x = W / 2; puck.y = mineScored ? H / 2 - 120 : H / 2 + 120; trail = [];
    }
    function step(h) {
      moveMallet(me, h); moveMallet(op, h);
      if (phase !== 'play') {      // 開始前はパックに重なれないようにする
        for (const m of [me, op]) { const dx = m.x - puck.x, dy = m.y - puck.y, d = Math.hypot(dx, dy) || 0.001; if (d < PR + MR) { m.x = puck.x + dx / d * (PR + MR); m.y = puck.y + dy / d * (PR + MR); } }
        return;
      }
      puck.x += puck.vx * h; puck.y += puck.vy * h;
      const f = 1 - 0.32 * h; puck.vx *= f; puck.vy *= f;
      collide(me); collide(op);
      const sp = Math.hypot(puck.vx, puck.vy); if (sp > MAXV) { puck.vx *= MAXV / sp; puck.vy *= MAXV / sp; }
      if (puck.x < PR) { puck.x = PR; if (puck.vx < 0) { puck.vx *= -0.92; wallHit(0, puck.y); } }
      if (puck.x > W - PR) { puck.x = W - PR; if (puck.vx > 0) { puck.vx *= -0.92; wallHit(W, puck.y); } }
      const inGoal = Math.abs(puck.x - W / 2) < GW / 2 - PR * 0.5;
      if (puck.y < PR) { if (inGoal) { if (puck.y < -PR) goal(true); } else { puck.y = PR; if (puck.vy < 0) { puck.vy *= -0.92; wallHit(puck.x, 0); } } }
      else if (puck.y > H - PR) { if (inGoal) { if (puck.y > H + PR) goal(false); } else { puck.y = H - PR; if (puck.vy > 0) { puck.vy *= -0.92; wallHit(puck.x, H); } } }
    }
    function hostUpdate(dt) {
      wallCd -= dt;
      if (phase === 'count') {
        timer -= dt; const n = Math.ceil(timer - 0.3); count = clamp(n, 0, 3);
        if (n < lastC && n >= 1) { lastC = n; emit('count', 0, 0, 0); }
        if (timer <= 0.3) { phase = 'play'; emit('go', 0, 0, 0); }
      } else if (phase === 'goal') {
        timer -= dt;
        if (timer <= 0) { if (score[0] >= WIN || score[1] >= WIN) phase = 'over'; else phase = 'play'; }
      }
      acc += dt; const h = 1 / 240; let n = 0;
      while (acc >= h && n < 16) { step(h); acc -= h; n++; }
      if (n >= 16) acc = 0;
      const r = v => Math.round(v * 10) / 10;
      env.send({ t: 'hs', p: [r(W - puck.x), r(H - puck.y), r(-puck.vx), r(-puck.vy)], m: [r(W - me.x), r(H - me.y)], s: [score[1], score[0]], ph: phase, c: count, ev: out });
      out = [];
    }
    function guestUpdate(dt) {
      // 自分のマレットは手元で動かして、位置を送る
      const dx = me.tx - me.x, dy = me.ty - me.y, d = Math.hypot(dx, dy), mx = MSPD * dt;
      if (d <= mx) { me.x = me.tx; me.y = me.ty; } else { me.x += dx / d * mx; me.y += dy / d * mx; }
      env.send({ t: 'hm', x: Math.round((W - me.x) * 10) / 10, y: Math.round((H - me.y) * 10) / 10 });
      const age = Math.min(0.12, (performance.now() - recvT) / 1000);
      if (phase === 'play') { puck.x = clamp(base.x + base.vx * age, PR, W - PR); puck.y = clamp(base.y + base.vy * age, -PR, H + PR); }
      else { puck.x = base.x; puck.y = base.y; }
      puck.vx = base.vx; puck.vy = base.vy;
    }

    // --- 描画 ---
    function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function buildBg() {
      bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height; bgKey = cv.width + 'x' + cv.height;
      const g = bg.getContext('2d'); g.setTransform(view.s, 0, 0, view.s, 0, 0);
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a0f3f'); gr.addColorStop(0.5, '#0c1a48'); gr.addColorStop(1, '#06304f');
      rr(g, 0, 0, W, H, 14); g.fillStyle = gr; g.fill();
      gr = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 380); gr.addColorStop(0, 'rgba(120,170,255,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // 空気穴
      g.fillStyle = 'rgba(255,255,255,.09)'; for (let y = 20; y < H; y += 20) for (let x = 20 + (y / 20 % 2) * 10; x < W; x += 20) { g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill(); }
      // ライン
      g.lineWidth = 2.5; g.shadowBlur = 12;
      g.strokeStyle = 'rgba(190,220,255,.75)'; g.shadowColor = '#8ab4ff'; g.beginPath(); g.moveTo(8, H / 2); g.lineTo(W - 8, H / 2); g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, 52, 0, 7); g.stroke();
      g.fillStyle = 'rgba(190,220,255,.8)'; g.beginPath(); g.arc(W / 2, H / 2, 5, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,120,170,.8)'; g.shadowColor = '#ff5d8f'; g.beginPath(); g.arc(W / 2, 0, GW / 2 + 22, 0, Math.PI); g.stroke();
      g.strokeStyle = 'rgba(110,220,255,.8)'; g.shadowColor = '#4cc9f0'; g.beginPath(); g.arc(W / 2, H, GW / 2 + 22, Math.PI, 0); g.stroke();
      // 外枠
      g.shadowBlur = 16; g.lineWidth = 6;
      const edge = g.createLinearGradient(0, 0, 0, H); edge.addColorStop(0, '#ff5d8f'); edge.addColorStop(0.5, '#b9c7ff'); edge.addColorStop(1, '#4cc9f0');
      g.strokeStyle = edge; g.shadowColor = '#9fb8ff'; rr(g, 3, 3, W - 6, H - 6, 12); g.stroke();
      // ゴール口
      g.shadowBlur = 0; g.fillStyle = '#05060f'; g.fillRect(W / 2 - GW / 2, 0, GW, 7); g.fillRect(W / 2 - GW / 2, H - 7, GW, 7);
      g.shadowBlur = 18; g.lineWidth = 4; g.lineCap = 'round';
      g.strokeStyle = '#ffd0df'; g.shadowColor = '#ff5d8f'; g.beginPath(); g.moveTo(W / 2 - GW / 2, 7); g.lineTo(W / 2 + GW / 2, 7); g.stroke();
      g.strokeStyle = '#d6f6ff'; g.shadowColor = '#4cc9f0'; g.beginPath(); g.moveTo(W / 2 - GW / 2, H - 7); g.lineTo(W / 2 + GW / 2, H - 7); g.stroke();
      g.shadowBlur = 0;
    }
    function mallet(m, col) {
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(m.x + 3, m.y + 7, MR, MR * 0.92, 0, 0, 7); c.fill();
      let g = c.createRadialGradient(m.x - 9, m.y - 11, 3, m.x, m.y, MR); g.addColorStop(0, col[0]); g.addColorStop(0.45, col[1]); g.addColorStop(1, col[2]);
      c.shadowColor = col[1]; c.shadowBlur = 18; c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y, MR, 0, 7); c.fill(); c.shadowBlur = 0;
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(m.x, m.y, MR - 2, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 3; c.beginPath(); c.arc(m.x, m.y, MR * 0.62, 0, 7); c.stroke();
      g = c.createRadialGradient(m.x - 4, m.y - 6, 1, m.x, m.y - 1, MR * 0.5); g.addColorStop(0, '#fff'); g.addColorStop(0.5, col[3]); g.addColorStop(1, col[2]);
      c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y - 2, MR * 0.46, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(m.x - 5, m.y - 8, 5, 2.6, -0.6, 0, 7); c.fill();
    }
    function draw(dt) {
      if (!bg || bgKey !== cv.width + 'x' + cv.height) buildBg();
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      const sx = shake > 0.3 ? rand(-shake, shake) : 0, sy = shake > 0.3 ? rand(-shake, shake) : 0;
      c.setTransform(view.s, 0, 0, view.s, sx * view.s, sy * view.s);
      c.drawImage(bg, 0, 0, W, H);
      // うすい大きな得点
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let i = 0; i < 2; i++) {
        const sc = 1 + pulse[i] * 0.5; c.font = '900 ' + (130 * sc) + 'px system-ui,sans-serif';
        c.fillStyle = i === 0 ? `rgba(120,225,255,${0.16 + pulse[i] * 0.5})` : `rgba(255,130,175,${0.16 + pulse[i] * 0.5})`;
        c.fillText(String(score[i]), W / 2, i === 0 ? H * 0.72 : H * 0.28);
      }
      // 軌跡
      c.globalCompositeOperation = 'lighter';
      trail.forEach((p, i) => { const k = (i + 1) / trail.length; c.fillStyle = `rgba(255,200,90,${k * 0.28})`; c.beginPath(); c.arc(p.x, p.y, PR * (0.35 + k * 0.6), 0, 7); c.fill(); });
      c.globalCompositeOperation = 'source-over';
      // パック
      if (phase !== 'goal' || bannerT < 0.7) {
        c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(puck.x + 2, puck.y + 5, PR, 0, 7); c.fill();
        const g = c.createRadialGradient(puck.x - 5, puck.y - 6, 1, puck.x, puck.y, PR); g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#ffd166'); g.addColorStop(1, '#e36414');
        c.shadowColor = '#ffb703'; c.shadowBlur = 22; c.fillStyle = g; c.beginPath(); c.arc(puck.x, puck.y, PR, 0, 7); c.fill(); c.shadowBlur = 0;
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.6; c.beginPath(); c.arc(puck.x, puck.y, PR * 0.6, 0, 7); c.stroke();
      }
      mallet(op, THEIRS); mallet(me, MINE);
      // 火花
      c.globalCompositeOperation = 'lighter';
      parts = parts.filter(p => { p.t += dt; if (p.t >= p.life) return false; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; const k = 1 - p.t / p.life; c.globalAlpha = k; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size * k + 0.3, 0, 7); c.fill(); return true; });
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      if (flash > 0) { c.fillStyle = flashMine ? `rgba(120,225,255,${flash * 0.35})` : `rgba(255,90,140,${flash * 0.35})`; c.fillRect(0, 0, W, H); }
      // 文字
      let txt = '', col = '#fff', size = 64, k = 1;
      if (phase === 'count' && count >= 1) { txt = String(count); size = 130; col = '#ffd166'; k = 1 + Math.max(0, 0.35 - countT) * 1.6; }
      else if (bannerT > 0) { txt = banner; col = bannerCol; k = 1 + Math.max(0, bannerT - 1.2) * 1.5; c.globalAlpha = Math.min(1, bannerT * 3); }
      if (txt) {
        c.font = '900 ' + (size * k) + 'px "Hiragino Maru Gothic ProN","Yu Gothic",system-ui,sans-serif'; c.lineJoin = 'round';
        c.lineWidth = 10; c.strokeStyle = 'rgba(5,8,30,.8)'; c.strokeText(txt, W / 2, H / 2); c.shadowColor = col; c.shadowBlur = 24; c.fillStyle = col; c.fillText(txt, W / 2, H / 2); c.shadowBlur = 0; c.globalAlpha = 1;
      }
      if (phase === 'count' && t0 < 3) { c.font = '800 15px system-ui,sans-serif'; c.fillStyle = 'rgba(210,240,255,.9)'; c.fillText('▼ 下がわが あなたのゴール。指でマレットを動かそう', W / 2, H - 150); }
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t0 += dt;
      if (host) hostUpdate(dt); else guestUpdate(dt);
      if (count !== prevCount) { prevCount = count; countT = 0; } else countT += dt;
      if (phase === 'play') { trail.push({ x: puck.x, y: puck.y }); if (trail.length > 12) trail.shift(); }
      flash = Math.max(0, flash - dt * 2); shake *= Math.pow(0.02, dt); bannerT -= dt; pulse[0] = Math.max(0, pulse[0] - dt * 1.5); pulse[1] = Math.max(0, pulse[1] - dt * 1.5);
      draw(dt);
      if (phase === 'over' && !shown) {
        shown = true; const win = score[0] > score[1];
        env.later(() => env.result({ kind: win ? 'win' : 'lose', title: win ? 'かち!' : 'まけ…', sub: `${score[0]} - ${score[1]}` }), 300);
      }
    }
    raf = requestAnimationFrame(loop);

    return {
      msg(m) {
        if (m.t === 'hm' && host) { op.tx = clamp(m.x, MR, W - MR); op.ty = clamp(m.y, MR, H / 2 - MR); }
        else if (m.t === 'hs' && !host) {
          base = { x: m.p[0], y: m.p[1], vx: m.p[2], vy: m.p[3] }; recvT = performance.now();
          op.x = m.m[0]; op.y = m.m[1]; score = m.s; if (m.ph !== phase && m.ph === 'goal') trail = []; phase = m.ph; count = m.c;
          (m.ev || []).forEach(e => fxEvent(e[0], e[1], e[2], e[3]));
        }
      },
      stop() { cancelAnimationFrame(raf); view.off(); }
    };
  }
};
