// Brobyggeren (age 10 only), v3: multiplication only. Hyæne Hans has rowed
// the pet out along a chain of nine islands. Each island has a tree of k
// logs, t metres each; "t × k = ?" says how long a bridge the tree gives,
// the tree is felled and laid across the gap, the T-rex skates over and the
// camera pans on — the bridges already built stay behind him, the caged
// pet gets closer. k runs 2 … 10 in a shuffled order, nine rounds. +2 gold
// a right answer (double Guldarenaen), −1 a wrong one (never below 0), the
// third wrong answer shows the answer and builds anyway; +2 for nine
// right. Design: wiki/designs/hunde-eventyr-brobyggeren.md
(function () {
  const HE = window.HE;
  const S = HE.strings.bridge;
  const SA = HE.strings.arena;
  const D = HE.data;
  const B = D.bridge;
  const W = 256;
  const H = 224;
  const PANEL_X = W - 28;
  const VIEW_W = PANEL_X - 2; // the world is drawn left of the table panel
  const GROUND_Y = 150;
  const SEA_Y = 62;
  const TREE_DX = 26; // tree and T-rex offsets from an island's left edge
  const TREX_DX = 46;
  const CAM_LEAD = 60; // the T-rex stands this far from the left of the view

  const st = {};
  let frames = 0;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newGame() {
    const tasks = HE.activeTasks();
    const forced = parseInt(HE.params.get("table"), 10);
    const t = tasks.tables.includes(forced) ? forced : D.pick(tasks.tables);
    st.table = t;
    st.hops = shuffle(B.ks).map((k) => ({ k, p: t * k, built: false, given: false }));
    st.n = st.hops.length;
    st.hop = 0;
    st.correct = 0;
    st.wrong = 0;
    st.gold = 0;
    st.bonus = false;
    st.message = "";
    st.msgTimer = 0;
    st.cam = 0;
    st.phase = "intro";
    newHop();
  }

  function newHop() {
    st.typed = "";
    st.tries = 0;
    st.timer = 0;
    if (st.phase !== "intro") st.phase = "ask";
  }

  function say(msg, t) {
    st.message = msg;
    st.msgTimer = t;
  }

  function cur() {
    return st.hops[st.hop];
  }

  function answer(n) {
    const h = cur();
    st.typed = "";
    if (n === h.p) {
      st.correct += 1;
      st.gold += B.rightGold;
      say(SA.correct, 50);
      HE.sfx.tick(1);
    } else {
      st.wrong += 1;
      st.gold = Math.max(0, st.gold - B.wrongGold);
      st.tries += 1;
      if (st.tries < B.maxTries) {
        say(S.tryAgain, 50);
        HE.sfx.splash();
        return;
      }
      h.given = true;
      say(S.reveal(h.p), 90);
      HE.sfx.splash();
    }
    st.phase = "fall";
    st.timer = B.fallPause;
    HE.sfx.chop();
  }

  function finish() {
    const sv = HE.save;
    if (st.wrong === 0) {
      st.bonus = true;
      st.gold += B.bonusGold;
    }
    sv.gold += st.gold;
    const stat = HE.stat(String(st.table));
    stat.correct += st.correct;
    stat.wrong += st.wrong;
    HE.persist();
    HE.sfx.fanfare();
    st.phase = "won";
  }

  // --- world geometry -----------------------------------------------------

  const landX = (i) => i * B.span; // left edge of island i (0 = the shore)
  const gapW = B.span - B.landW;
  const worldW = landX(st.n || 9) + B.landW;

  // Where the T-rex stands in world px.
  function trexWorldX() {
    const x = landX(st.hop) + TREX_DX;
    if (st.phase === "cross") {
      const k = 1 - st.timer / B.crossPause;
      return x + B.span * k;
    }
    return x;
  }

  function update() {
    frames += 1;
    if (st.msgTimer > 0) st.msgTimer -= 1;
    const inp = HE.input;
    const typing = st.phase === "ask" && st.typed;
    if (st.door && (inp.pressed("Escape") || (inp.pressed("Backspace") && !typing))) return HE.go("town", { door: st.door });
    switch (st.phase) {
      case "intro":
        if (inp.go()) st.phase = "ask";
        break;
      case "ask": {
        const d = inp.digit();
        if (d !== null && st.typed.length < 3) st.typed += d;
        if (typing && inp.pressed("Backspace")) st.typed = st.typed.slice(0, -1);
        if (inp.go() && st.typed) answer(parseInt(st.typed, 10));
        break;
      }
      case "fall":
        if (--st.timer <= 0) {
          st.phase = "build";
          st.timer = B.buildPause;
          HE.sfx.saw();
        }
        break;
      case "build":
        if (--st.timer <= 0) {
          cur().built = true;
          st.phase = "cross";
          st.timer = B.crossPause;
        }
        break;
      case "cross":
        if (--st.timer <= 0) {
          st.hop += 1;
          if (st.hop >= st.n) finish();
          else newHop();
        }
        break;
      case "won":
        if (inp.go()) {
          newGame();
          st.phase = "ask";
        }
        break;
    }
    // the camera follows the T-rex, clamped to the world
    if (st.phase !== "intro" && st.phase !== "won") {
      const want = Math.max(0, Math.min(worldW - VIEW_W, trexWorldX() - CAM_LEAD));
      st.cam += (want - st.cam) * 0.2;
      if (Math.abs(want - st.cam) < 0.5) st.cam = want;
    }
  }

  // --- drawing ---------------------------------------------------------

  const sx = (wx) => Math.round(wx - st.cam);

  function drawSea(ctx) {
    ctx.fillStyle = "#8ecae6"; // sky
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2a7fb8";
    ctx.fillRect(0, SEA_Y, W, H - SEA_Y);
    ctx.fillStyle = "#3d95cc";
    for (let y = SEA_Y + 8; y < H; y += 14) {
      for (let x = ((y * 7 + frames) % 40) - 40 - (st.cam % 40); x < W; x += 40) ctx.fillRect(x, y + Math.round(Math.sin((x + frames) / 9)), 12, 1);
    }
  }

  function drawIsland(ctx, x0, w) {
    ctx.fillStyle = "#c9a96a";
    ctx.fillRect(x0, GROUND_Y - 2, w, H - GROUND_Y + 2);
    ctx.fillStyle = "#5c9e3a";
    ctx.fillRect(x0, GROUND_Y, w, 6);
    ctx.fillStyle = "#8d6e4a";
    ctx.fillRect(x0, GROUND_Y + 6, w, 30);
    ctx.fillStyle = "#6d5238";
    ctx.fillRect(x0, GROUND_Y + 36, w, H - GROUND_Y - 36);
  }

  // The tree on island i: k logs of t metres, labelled, a canopy on top; it
  // tilts over during "fall" and is a stump once its bridge is built.
  function drawTree(ctx, i) {
    const h = st.hops[i];
    const cx = sx(landX(i) + TREE_DX);
    if (cx < -30 || cx > VIEW_W + 30) return;
    if (h.built || (i === st.hop && st.phase === "build")) {
      ctx.fillStyle = "#6d4c41";
      ctx.fillRect(cx - 4, GROUND_Y - 6, 8, 6);
      ctx.fillStyle = "#a1887f";
      ctx.fillRect(cx - 4, GROUND_Y - 6, 8, 1);
      return;
    }
    const seg = h.k <= 6 ? 10 : h.k <= 8 ? 8 : 7;
    const trunkH = seg * h.k;
    let angle = 0;
    if (i === st.hop && st.phase === "fall") {
      const k = 1 - st.timer / B.fallPause;
      angle = k > 0.4 ? ((k - 0.4) / 0.6) * (Math.PI / 2) : Math.sin(k * 40) * 0.04;
    }
    ctx.save();
    ctx.translate(cx, GROUND_Y);
    ctx.rotate(angle);
    for (let j = 0; j < h.k; j++) {
      const y = -(j + 1) * seg;
      ctx.fillStyle = j % 2 ? "#8d5524" : "#a0622d";
      ctx.fillRect(-7, y, 14, seg);
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(-7, y + seg - 1, 14, 1);
      HE.text(ctx, String(st.table), 0, y + (seg - 7) / 2, { size: 7, color: "#fff8e1" });
    }
    ctx.fillStyle = "#2e7d32";
    ctx.beginPath();
    ctx.arc(0, -trunkH - 13, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#43a047";
    ctx.beginPath();
    ctx.arc(-5, -trunkH - 17, 7, 0, Math.PI * 2);
    ctx.arc(6, -trunkH - 16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // The gap after island i: a rope while open, planks once built (sliding
  // in during "build"), the length on a label below.
  function drawGap(ctx, i) {
    const h = st.hops[i];
    const x0 = sx(landX(i) + B.landW);
    if (x0 + gapW < 0 || x0 > VIEW_W) return;
    const ropeY = GROUND_Y - 8;
    let n = 0; // planks laid, out of k
    if (h.built) n = h.k;
    else if (i === st.hop && st.phase === "build") n = Math.min(h.k, Math.ceil((1 - st.timer / B.buildPause) * h.k));
    if (!h.built && n === 0) {
      ctx.fillStyle = "#efe1b0";
      ctx.fillRect(x0, ropeY, gapW, 1);
      ctx.fillRect(x0, ropeY - 4, 1, 8);
      ctx.fillRect(x0 + gapW - 1, ropeY - 4, 1, 8);
      return;
    }
    const pw = gapW / h.k;
    for (let j = 0; j < n; j++) {
      const px = Math.round(x0 + j * pw);
      ctx.fillStyle = h.given ? "#78909c" : "#8d5524";
      ctx.fillRect(px + 1, GROUND_Y - 3, Math.max(2, Math.round(pw) - 2), 4);
      ctx.fillStyle = h.given ? "#546e7a" : "#5d4037";
      ctx.fillRect(px + 1, GROUND_Y, Math.max(2, Math.round(pw) - 2), 1);
    }
    if (n === h.k) HE.text(ctx, S.bridgeLen(h.p), x0 + gapW / 2, GROUND_Y + 6, { size: 8, color: "#fff8e1" });
  }

  function drawCage(ctx) {
    const cx = sx(landX(st.n) + B.landW / 2);
    if (cx < -40 || cx > VIEW_W + 40) return;
    HE.drawPet(ctx, HE.petId(), HE.petLevel(), cx - 8, GROUND_Y, { height: 20, squash: 0.9 });
    ctx.fillStyle = "#3e2723";
    for (let i = -12; i <= 12; i += 6) ctx.fillRect(cx - 8 + i, GROUND_Y - 24, 2, 24);
    ctx.fillRect(cx - 21, GROUND_Y - 25, 28, 2);
    HE.drawImg(ctx, "hans-gloat", cx + 16, GROUND_Y, { h: 24, flipX: true });
  }

  function drawTrex(ctx) {
    const cx = sx(trexWorldX());
    let img = Math.floor(frames / 8) % 2 ? "trex-b" : "trex-a";
    let squash = 1;
    let dx = 0;
    if (st.phase === "fall") {
      const k = 1 - st.timer / B.fallPause;
      dx = -(TREX_DX - TREE_DX + 16); // step round to the left of the tree, which falls towards the gap
      squash = 1 - Math.abs(Math.sin(k * Math.PI * 3)) * 0.15;
      if (k < 0.4 && Math.floor(k * 6) % 2 === 0) HE.bubble(ctx, S.chop, cx + dx, GROUND_Y - 30);
    } else if (st.phase === "cross") img = "trex-a";
    const box = HE.drawImg(ctx, img, cx + dx, GROUND_Y, { h: 26, squash });
    if (st.msgTimer > 0 && st.message === SA.correct && box) HE.text(ctx, S.plusTwo, cx + dx, box.y - 12 - (50 - st.msgTimer) * 0.4, { size: 8, color: "#fdd835" });
  }

  function drawHud(ctx) {
    HE.text(ctx, SA.table(st.table), 4, 4, { size: 8, align: "left", color: "#263238" });
    HE.text(ctx, SA.gold(st.gold), W - 4, 4, { size: 8, align: "right", color: "#7a5a00" });
    drawMinimap(ctx);
    // the table panel lights the k of every bridge built so far
    const revealed = new Set();
    st.hops.forEach((h, i) => {
      if (h.built || (i === st.hop && st.phase !== "ask")) revealed.add(h.k);
    });
    const w = 26;
    const bh = 12;
    for (let k = 1; k <= 10; k++) {
      const yy = 18 + (10 - k) * (bh + 3);
      const on = revealed.has(k);
      ctx.fillStyle = on ? "#fff8e1" : "rgba(38, 50, 56, 0.35)";
      ctx.fillRect(PANEL_X, yy, w, bh);
      ctx.fillStyle = on ? "#8d6e63" : "rgba(38, 50, 56, 0.5)";
      ctx.fillRect(PANEL_X, yy + bh - 1, w, 1);
      if (on) HE.text(ctx, String(st.table * k), PANEL_X + w / 2, yy + 2, { size: 8, color: "#3e2723" });
    }
  }

  // Minimap: the shore, nine islands, bridges built in brown, the T-rex
  // where he stands and the caged pet at the end.
  function drawMinimap(ctx) {
    const step = 14;
    const x0 = 70; // clear of the title on the left and the gold on the right
    const y = 12;
    ctx.fillStyle = "rgba(42, 127, 184, 0.6)";
    ctx.fillRect(x0 - 8, y - 4, step * st.n + 24, 12);
    for (let i = 0; i <= st.n; i++) {
      const x = x0 + i * step;
      if (i < st.n) {
        ctx.fillStyle = st.hops[i].built ? "#8d5524" : "rgba(255, 248, 225, 0.5)";
        ctx.fillRect(x + 4, y + 1, step - 8, 2);
      }
      ctx.fillStyle = "#5c9e3a";
      ctx.fillRect(x - 3, y, 7, 4);
      ctx.fillStyle = "#c9a96a";
      ctx.fillRect(x - 3, y + 4, 7, 1);
    }
    const px = x0 + st.n * step;
    HE.drawPet(ctx, HE.petId(), HE.petLevel(), px, y, { height: 9 });
    ctx.fillStyle = "#3e2723";
    for (let i = -4; i <= 4; i += 4) ctx.fillRect(px + i, y - 10, 1, 10);
    const tx = x0 + (trexWorldX() - TREX_DX) / B.span * step;
    HE.drawImg(ctx, "trex-a", tx, y, { h: 10 });
  }

  // One sum at a time, big, in the sky.
  function drawSum(ctx) {
    const h = cur();
    const asking = st.phase === "ask";
    if (!asking && st.msgTimer <= 0) return;
    const y = 20;
    ctx.fillStyle = "rgba(13, 43, 66, 0.8)";
    ctx.fillRect(4, y, PANEL_X - 8, 34);
    if (asking) {
      HE.text(ctx, S.fell(h.k, st.table), 112, y + 3, { size: 8, color: "#b3e5fc" });
      const cursor = frames % 40 < 20 ? "_" : " ";
      HE.text(ctx, S.mul(st.table, h.k) + (st.typed || "") + cursor, 112, y + 15, { size: 14, color: "#fdd835" });
    }
    if (st.msgTimer > 0) {
      const ok = st.message === SA.correct;
      HE.text(ctx, st.message, 112, asking ? y + 36 : y + 12, { size: asking ? 8 : 12, color: ok ? "#c8e6c9" : "#ffb74d" });
    }
  }

  function drawEndScreen(ctx, title, colour) {
    ctx.fillStyle = "#8ecae6";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2a7fb8";
    ctx.fillRect(0, 170, W, H - 170);
    ctx.fillStyle = "#5c9e3a";
    ctx.fillRect(0, 196, W, H - 196);
    HE.text(ctx, title, W / 2, 22, { size: 16, color: colour });
  }

  function draw(ctx) {
    const blink = frames % 60 < 40;
    const name = HE.petName();
    if (st.phase === "intro") {
      drawEndScreen(ctx, S.name, "#7a5a00");
      HE.text(ctx, S.taken(name), W / 2, 46, { size: 10, color: "#b71c1c" });
      HE.text(ctx, S.how, W / 2, 68, { size: 8, color: "#263238" });
      HE.text(ctx, S.how2, W / 2, 80, { size: 8, color: "#263238" });
      HE.text(ctx, S.how3, W / 2, 92, { size: 8, color: "#263238" });
      HE.text(ctx, S.controls, W / 2, 112, { size: 8, color: "#37474f" });
      HE.text(ctx, S.controls2, W / 2, 124, { size: 8, color: "#37474f" });
      if (blink) HE.text(ctx, S.start, W / 2, 148, { size: 8, color: "#263238" });
      HE.drawImg(ctx, "tree", 30, 196, { h: 56 });
      HE.drawImg(ctx, "trex-a", 70, 196, { h: 28 });
      const pet = HE.petId();
      const box = HE.drawPet(ctx, pet, HE.petLevel(), 190, 196, { height: 20, squash: 0.9 });
      ctx.fillStyle = "#3e2723";
      for (let i = -12; i <= 12; i += 6) ctx.fillRect(190 + i, 172, 2, 24);
      ctx.fillRect(177, 171, 28, 2);
      if (box) HE.bubble(ctx, SA.sad, 190, box.y - 4);
      HE.drawImg(ctx, "hans-gloat", 226, 196, { h: 28, flipX: true });
      return;
    }
    if (st.phase === "won") {
      drawEndScreen(ctx, S.freed(name), "#7a5a00");
      HE.text(ctx, SA.table(st.table), W / 2, 48, { size: 8, color: "#263238" });
      HE.text(ctx, SA.correctCount(st.correct), W / 2, 70, { size: 10, color: "#2e7d32" });
      HE.text(ctx, SA.wrongCount(st.wrong), W / 2, 86, { size: 10, color: "#b71c1c" });
      if (st.bonus) HE.text(ctx, S.clean, W / 2, 106, { size: 8, color: "#7a5a00" });
      HE.text(ctx, SA.earned(st.gold), W / 2, 120, { size: 12, color: "#7a5a00" });
      if (blink) HE.text(ctx, st.door ? S.again : SA.again, W / 2, 140, { size: 8, color: "#263238" });
      HE.drawImg(ctx, "trex-a", 64, 196, { h: 28 });
      const pet = HE.petId();
      const lvl = HE.petLevel();
      const hop = -Math.abs(Math.sin(frames / 8)) * 8;
      const box = HE.drawPet(ctx, pet, lvl, 128, 196, { height: D.petArenaHeight(lvl), dy: hop });
      if (box) HE.bubble(ctx, HE.strings.calls[pet], 128, box.y - 2);
      HE.drawImg(ctx, "hans-sulk", 208, 196, { h: 28, flipX: true });
      return;
    }
    drawSea(ctx);
    // the shore, then every island, gap and tree in world order
    for (let i = 0; i <= st.n; i++) {
      const x = sx(landX(i));
      if (x + B.landW >= 0 && x <= VIEW_W) drawIsland(ctx, x, B.landW);
    }
    if (sx(0) > -40) HE.drawImg(ctx, "tree", sx(-2), GROUND_Y, { h: 34 }); // the big tree on the shore
    for (let i = 0; i < st.n; i++) {
      drawGap(ctx, i);
      drawTree(ctx, i);
    }
    drawCage(ctx);
    drawTrex(ctx);
    // the world stops at the table panel
    ctx.fillStyle = "#8ecae6";
    ctx.fillRect(VIEW_W, 0, W - VIEW_W, SEA_Y);
    ctx.fillStyle = "#2a7fb8";
    ctx.fillRect(VIEW_W, SEA_Y, W - VIEW_W, H - SEA_Y);
    drawHud(ctx);
    drawSum(ctx);
    if (blink && st.phase === "ask") HE.text(ctx, S.controls, 112, H - 12, { size: 8, color: "#e3f2fd" });
  }

  HE.registerScene("bridge", {
    enter(payload) {
      st.door = payload.door || null;
      st.phase = "intro";
      newGame();
    },
    update,
    draw,
  });
  HE.bridgeState = st;
})();
