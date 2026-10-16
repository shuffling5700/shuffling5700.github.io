// Minefeltet: Hyæne Hans has caged the active pet at the far end of a
// minefield — plates 1 … 10t in a serpentine from bottom-left, bombs hidden
// under the multiples of the table. Drive the T-rex skater with the arrows,
// stop on the plate you believe is the next multiple and press Space or
// Enter to eat the bomb: right secures it (+1 gold), wrong blows him back to
// plate 1 (−1 gold, secured plates kept). Ten bombs free the pet; +1 for a
// field with no explosions. Tables only. Up is a move here, not ok.
(function () {
  const HE = window.HE;
  const S = HE.strings.mines;
  const SA = HE.strings.arena;
  const D = HE.data;
  const M = D.mines;
  const W = 256;
  const H = 224;
  const FX = 6; // field origin
  const FY = 40; // room above for the cage and Hans
  const PANEL_X = W - 28;

  const st = {};
  let frames = 0;

  function newField() {
    const tasks = HE.activeTasks();
    const forced = parseInt(HE.params.get("table"), 10);
    const t = tasks.tables.includes(forced) ? forced : D.pick(tasks.tables);
    st.table = t;
    st.n = 10 * t;
    st.cols = M.cols[t] || M.defaultCols;
    st.rows = Math.ceil(st.n / st.cols);
    st.plate = Math.min(18, Math.floor(216 / st.cols), Math.floor(160 / st.rows));
    st.idx = 0; // the T-rex stands on plate idx + 1
    st.next = 1; // the next bomb is next × t
    st.secured = new Set();
    st.correct = 0;
    st.wrong = 0;
    st.gold = 0;
    st.bonus = false;
    st.timer = 0;
    st.boomAt = null;
    st.message = "";
    st.phase = "intro";
    decorate();
  }

  // Swamp scenery scattered on the free ground around the stone path.
  function free(x0, y0, x1, y1) {
    if (x0 < 0 || x1 > PANEL_X - 3 || y0 < FY - 2 || y1 > 197) return false;
    const fx1 = FX + st.cols * st.plate + 2;
    const fy1 = FY + st.rows * st.plate + 2;
    return x1 < FX - 2 || x0 > fx1 || y1 < FY - 2 || y0 > fy1;
  }
  function place(n, hw, up, down, tries) {
    const out = [];
    for (let i = 0; i < n * tries && out.length < n; i++) {
      const x = Math.floor(Math.random() * PANEL_X);
      const y = FY + Math.floor(Math.random() * (197 - FY));
      if (free(x - hw, y - up, x + hw, y + down)) out.push({ x, y, p: Math.random() * 6 });
    }
    return out;
  }
  function decorate() {
    st.decor = {
      shade: place(6, 22, 8, 8, 4),
      pools: place(3, 16, 7, 7, 40),
      trees: place(6, 9, 17, 0, 40),
      reeds: place(8, 2, 12, 0, 20),
      grass: place(45, 3, 3, 0, 8),
      flies: place(6, 2, 2, 2, 10),
    };
  }
  function drawSwamp(ctx) {
    const d = st.decor;
    ctx.fillStyle = "#1d3b1f"; // jungle floor
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#173118";
    for (const s of d.shade) {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of d.pools) {
      ctx.fillStyle = "#274e4a";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a6f69";
      ctx.fillRect(p.x - 8, p.y - 3, 7, 1);
      ctx.fillRect(p.x + 2, p.y + 2, 6, 1);
      ctx.fillStyle = "#66bb6a"; // lily pad
      ctx.fillRect(p.x - 3, p.y + 1, 4, 3);
      ctx.fillStyle = "#274e4a";
      ctx.fillRect(p.x - 1, p.y + 1, 1, 1);
    }
    // murky water under the stones so the gaps between them glint
    ctx.fillStyle = "#274e4a";
    for (let i = 0; i < st.n; i++) {
      const { x, y } = plateXY(i);
      ctx.fillRect(x - 1, y - 1, st.plate + 2, st.plate + 2);
    }
    for (const g of d.grass) {
      ctx.fillStyle = "#3f8a3a";
      ctx.fillRect(g.x - 2, g.y - 2, 1, 2);
      ctx.fillRect(g.x, g.y - 3, 1, 3);
      ctx.fillRect(g.x + 2, g.y - 2, 1, 2);
    }
    for (const r of d.reeds) {
      ctx.fillStyle = "#6d4c41";
      ctx.fillRect(r.x, r.y - 9, 1, 9);
      ctx.fillStyle = "#795548";
      ctx.fillRect(r.x - 1, r.y - 12, 3, 4);
    }
    for (const t of d.trees) {
      ctx.fillStyle = "#4e342e";
      ctx.fillRect(t.x - 1, t.y - 11, 3, 11);
      ctx.fillStyle = "#1b5e20";
      ctx.beginPath();
      ctx.arc(t.x, t.y - 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2e7d32";
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 13, 5, 0, Math.PI * 2);
      ctx.arc(t.x + 4, t.y - 12, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#43a047";
      ctx.fillRect(t.x - 2, t.y - 16, 3, 2);
    }
    for (const f of d.flies) {
      if ((frames / 20 + f.p) % 3 < 1) {
        ctx.fillStyle = "rgba(255, 241, 118, 0.3)";
        ctx.fillRect(f.x - 2, f.y - 2, 5, 5);
        ctx.fillStyle = "#fff176";
        ctx.fillRect(f.x, f.y, 1, 1);
      }
    }
  }

  // Serpentine: row 0 is the bottom row and runs left to right, row 1 right
  // to left, and so on. Column is a screen column.
  function rowCol(idx) {
    const row = Math.floor(idx / st.cols);
    const k = idx % st.cols;
    return { row, col: row % 2 === 0 ? k : st.cols - 1 - k };
  }
  function index(row, col) {
    const k = row % 2 === 0 ? col : st.cols - 1 - col;
    const idx = row * st.cols + k;
    return idx >= 0 && idx < st.n && col >= 0 && col < st.cols && row >= 0 && row < st.rows ? idx : -1;
  }
  function plateXY(idx) {
    const { row, col } = rowCol(idx);
    return { x: FX + col * st.plate, y: FY + (st.rows - 1 - row) * st.plate };
  }

  function move(drow, dcol) {
    const { row, col } = rowCol(st.idx);
    const to = index(row + drow, col + dcol);
    if (to >= 0) st.idx = to;
  }

  function eat() {
    const number = st.idx + 1;
    if (number === st.next * st.table) {
      st.secured.add(number);
      st.correct += 1;
      st.gold += 1;
      st.next += 1;
      st.phase = "eat";
      st.timer = M.eatPause;
      HE.sfx.gulp();
      return;
    }
    st.wrong += 1;
    st.gold = Math.max(0, st.gold - 1);
    st.boomAt = plateXY(st.idx);
    st.message = S.wrongPlate(number);
    st.phase = "boom";
    st.timer = M.boomPause;
    HE.sfx.boom();
  }

  function finish() {
    const sv = HE.save;
    if (st.wrong === 0) {
      st.bonus = true;
      st.gold += M.bonusGold;
    }
    sv.gold += st.gold;
    const stat = HE.stat(String(st.table));
    stat.correct += st.correct;
    stat.wrong += st.wrong;
    HE.persist();
    HE.sfx.fanfare();
    st.phase = "won";
  }

  function update() {
    frames += 1;
    const inp = HE.input;
    if (st.door && inp.leave()) return HE.go("town", { door: st.door });
    switch (st.phase) {
      case "intro":
        if (inp.ok()) st.phase = "play";
        break;
      case "play":
        if (inp.pressed("ArrowLeft")) move(0, -1);
        if (inp.pressed("ArrowRight")) move(0, 1);
        if (inp.pressed("ArrowUp")) move(1, 0);
        if (inp.pressed("ArrowDown")) move(-1, 0);
        if (inp.ok()) eat();
        break;
      case "eat":
        if (--st.timer <= 0) {
          if (st.next > 10) finish();
          else st.phase = "play";
        }
        break;
      case "boom":
        if (--st.timer <= 0) {
          st.idx = 0;
          st.phase = "play";
        }
        break;
      case "won":
        if (inp.ok()) newField();
        break;
    }
  }

  // --- drawing ---------------------------------------------------------

  function drawPlates(ctx) {
    const P = st.plate;
    for (let i = 0; i < st.n; i++) {
      const { x, y } = plateXY(i);
      const number = i + 1;
      const done = st.secured.has(number);
      // plank to the next stepping stone so the path reads as one trail
      if (i + 1 < st.n) {
        const nx = plateXY(i + 1);
        ctx.fillStyle = "#6d4c41";
        if (nx.y === y) ctx.fillRect(Math.min(x, nx.x) + P - 2, y + 5, 4, P - 10);
        else ctx.fillRect(x + 5, Math.min(y, nx.y) + P - 2, P - 10, 4);
      }
      // mossy stepping stone with rounded corners
      ctx.fillStyle = done ? "#5e9a4a" : "#8a8f7e";
      ctx.fillRect(x + 2, y + 1, P - 4, P - 2);
      ctx.fillRect(x + 1, y + 2, P - 2, P - 4);
      ctx.fillStyle = done ? "#3d6b30" : "#5f665a";
      ctx.fillRect(x + 2, y + P - 3, P - 4, 2);
      if (!done) {
        ctx.fillStyle = "#4f8a3a"; // moss tuft
        ctx.fillRect(x + 1, y + 2, 2, 3);
        ctx.fillRect(x + 3, y + 2, 1, 1);
      }
      if (done) {
        // bite mark
        ctx.fillStyle = "#2e3b2f";
        ctx.fillRect(x + P - 6, y + 2, 4, 3);
        ctx.fillRect(x + P - 4, y + 5, 2, 2);
      }
      HE.text(ctx, String(number), x + P / 2, y + (P - 8) / 2, { size: 8, color: done ? "#e8f5e9" : "#eceff1" });
    }
    // start line beside plate 1
    const s = plateXY(0);
    for (let j = 0; j < st.plate; j += 3) {
      ctx.fillStyle = Math.floor(j / 3) % 2 ? "#fafafa" : "#212121";
      ctx.fillRect(1, s.y + j, 4, 3);
    }
  }

  function drawCage(ctx, sagging) {
    // above the last plate's column
    const last = plateXY(st.n - 1);
    const cx = Math.max(24, Math.min(W - 56, last.x + st.plate / 2));
    const bottom = FY - 3;
    const pet = HE.petId();
    const lvl = HE.petLevel();
    const box = HE.drawPet(ctx, pet, lvl, cx, bottom, { height: 18, squash: sagging ? 0.9 : 1, dy: sagging ? 0 : -Math.abs(Math.sin(frames / 6)) * 4 });
    if (sagging) {
      ctx.fillStyle = "#3e2723";
      for (let i = -12; i <= 12; i += 6) ctx.fillRect(cx + i, bottom - 22, 2, 22);
      ctx.fillRect(cx - 13, bottom - 23, 28, 2);
      ctx.fillRect(cx - 13, bottom - 1, 28, 2);
    } else if (box) HE.bubble(ctx, HE.strings.calls[pet], cx, box.y - 2);
    const hx = cx + 30 <= W - 40 ? cx + 30 : cx - 30;
    HE.drawImg(ctx, sagging ? "hans-gloat" : "hans-sulk", hx, bottom, { h: 24, flipX: hx > cx });
  }

  function drawTrex(ctx) {
    const P = st.plate;
    let { x, y } = plateXY(st.idx);
    let cx = x + P / 2;
    let bottom = y + P - 1;
    let squash = 1;
    let img = Math.floor(frames / 8) % 2 ? "trex-b" : "trex-a";
    if (st.phase === "boom") {
      // arc from the plate back to the start line
      const k = 1 - st.timer / M.boomPause;
      const from = st.boomAt;
      const to = plateXY(0);
      cx = from.x + (to.x - from.x) * k + P / 2;
      bottom = from.y + (to.y - from.y) * k + P - 1 - Math.sin(k * Math.PI) * 40;
      img = "trex-a";
    } else if (st.phase === "eat") {
      // chewing: quick squashes while the bomb is in his mouth
      const k = 1 - st.timer / M.eatPause;
      squash = k > 0.3 && k < 0.7 ? 1 - Math.abs(Math.sin((k - 0.3) * Math.PI * 7.5)) * 0.14 : 1;
    }
    if (st.phase === "eat") {
      // the plate lights up while the bomb is pulled out of it
      const k = 1 - st.timer / M.eatPause;
      if (k < 0.5 && Math.floor(frames / 3) % 2) {
        ctx.fillStyle = "#fff176";
        ctx.fillRect(x + 1, y + 1, P - 2, P - 2);
      }
    }
    const box = HE.drawImg(ctx, img, cx, bottom, { h: P + 8, squash });
    if (st.phase === "eat" && box) {
      const k = 1 - st.timer / M.eatPause;
      const h = P + 8;
      const belly = bottom - h * 0.45;
      if (k < 0.35) {
        // a black bomb rises from the plate into his mouth
        const t = k / 0.35;
        const bx = cx + t * P * 0.35;
        const by = bottom - 3 - t * h * 0.6;
        ctx.fillStyle = "#212121";
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#616161";
        ctx.fillRect(bx, by - 7, 1, 3);
        ctx.fillStyle = frames % 4 < 2 ? "#fff176" : "#ff7043";
        ctx.fillRect(bx - 1, by - 9, 3, 3);
      } else if (k < 0.7) {
        // chewing: crumbs fall from his mouth and the lump slides down
        const t = (k - 0.35) / 0.35;
        const mx = cx + P * 0.35;
        const my = bottom - h * 0.6;
        ctx.fillStyle = "#212121";
        for (let i = 0; i < 3; i++) {
          const ft = (t * 3 + i * 0.33) % 1; // each crumb falls in its own time
          ctx.fillRect(mx - 2 + i * 3, my + 4 + ft * (bottom - my - 4), 2, 2);
        }
        // the bomb as a lump moving from the throat down into the belly
        const ly = my + 4 + t * (belly - my - 4);
        ctx.fillStyle = "rgba(33, 33, 33, 0.6)";
        ctx.beginPath();
        ctx.arc(cx + (1 - t) * P * 0.2, ly, 3 + t * 2, 0, Math.PI * 2);
        ctx.fill();
        HE.bubble(ctx, S.chew, cx, box.y - 2);
      } else {
        // a muffled pop in the belly, a little grey puff, and the burp
        const t = (k - 0.7) / 0.3;
        ctx.fillStyle = "rgba(33, 33, 33, " + (0.6 - t * 0.5) + ")";
        ctx.beginPath();
        ctx.arc(cx, belly, 5 + Math.sin(t * Math.PI) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(189, 189, 189, " + (0.8 - t * 0.7) + ")";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(cx - 6 + i * 6, belly - 6 - t * 12 - i * 2, 3 + t * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        HE.bubble(ctx, S.burp, cx, box.y - 2);
      }
      // the gold this bomb earned floats up
      if (k > 0.7) HE.text(ctx, S.plusOne, cx, box.y - 22 - (k - 0.7) * 40, { size: 8, color: "#fdd835" });
    }
    if (st.phase === "boom" && st.timer > M.boomPause * 0.6) {
      const k = (M.boomPause - st.timer) / (M.boomPause * 0.4);
      const r = 6 + k * 14;
      ctx.fillStyle = k < 0.5 ? "#fff59d" : "#ff7043";
      ctx.beginPath();
      ctx.arc(st.boomAt.x + P / 2, st.boomAt.y + P / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#616161";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + k;
        ctx.fillRect(st.boomAt.x + P / 2 + Math.cos(a) * r * 1.3 - 2, st.boomAt.y + P / 2 + Math.sin(a) * r * 1.3 - 2, 4, 4);
      }
      HE.text(ctx, S.bang, st.boomAt.x + P / 2, st.boomAt.y - 12, { size: 10, color: "#ffb74d" });
    }
  }

  function drawHud(ctx) {
    HE.text(ctx, SA.table(st.table), 4, 4, { size: 8, align: "left", color: "#cfd8dc" });
    HE.text(ctx, S.bombs(st.correct, 10), 112, 4, { size: 8, color: "#cfd8dc" });
    HE.text(ctx, SA.gold(st.gold), W - 4, 4, { size: 8, align: "right", color: "#fdd835" });
    HE.drawTablePanel(ctx, st.table, st.correct, PANEL_X, 18);
  }

  function draw(ctx) {
    ctx.fillStyle = "#1b1a17"; // packed earth
    ctx.fillRect(0, 0, W, H);
    const blink = frames % 60 < 40;
    const name = HE.petName();
    if (st.phase === "intro") {
      HE.text(ctx, S.name, W / 2, 22, { size: 16, color: "#fdd835" });
      HE.text(ctx, S.taken(name), W / 2, 48, { size: 12, color: "#ef9a9a" });
      HE.text(ctx, S.where(st.table), W / 2, 70, { size: 8, color: "#cfd8dc" });
      HE.text(ctx, S.how, W / 2, 86, { size: 8, color: "#cfd8dc" });
      HE.text(ctx, S.how2, W / 2, 98, { size: 8, color: "#cfd8dc" });
      HE.text(ctx, S.controls, W / 2, 118, { size: 8, color: "#90a4ae" });
      HE.text(ctx, S.controls2, W / 2, 130, { size: 8, color: "#90a4ae" });
      if (blink) HE.text(ctx, S.start, W / 2, 150, { size: 8 });
      ctx.fillStyle = "#2e7d32";
      ctx.fillRect(0, 196, W, H - 196);
      HE.drawImg(ctx, "trex-a", 48, 196, { h: 28 });
      const pet = HE.petId();
      const box = HE.drawPet(ctx, pet, HE.petLevel(), 176, 196, { height: 20, squash: 0.9 });
      ctx.fillStyle = "#3e2723";
      for (let i = -12; i <= 12; i += 6) ctx.fillRect(176 + i, 172, 2, 24);
      ctx.fillRect(163, 171, 28, 2);
      if (box) HE.bubble(ctx, SA.sad, 176, box.y - 4);
      HE.drawImg(ctx, "hans-gloat", 216, 196, { h: 28, flipX: true });
      return;
    }
    if (st.phase === "won") {
      HE.text(ctx, S.freed(name), W / 2, 24, { size: 16, color: "#fdd835" });
      HE.text(ctx, SA.table(st.table), W / 2, 48, { size: 8, color: "#cfd8dc" });
      HE.text(ctx, SA.correctCount(st.correct), W / 2, 70, { size: 10, color: "#81c784" });
      HE.text(ctx, SA.wrongCount(st.wrong), W / 2, 86, { size: 10, color: "#ef9a9a" });
      if (st.bonus) HE.text(ctx, S.clean, W / 2, 106, { size: 8, color: "#fdd835" });
      HE.text(ctx, SA.earned(st.gold), W / 2, 124, { size: 12, color: "#fdd835" });
      if (blink) HE.text(ctx, st.door ? S.again : SA.again, W / 2, 156, { size: 8 });
      ctx.fillStyle = "#2e7d32";
      ctx.fillRect(0, 196, W, H - 196);
      HE.drawImg(ctx, "trex-a", 64, 196, { h: 28 });
      const pet = HE.petId();
      const lvl = HE.petLevel();
      const hop = -Math.abs(Math.sin(frames / 8)) * 8;
      const box = HE.drawPet(ctx, pet, lvl, 128, 196, { height: D.petArenaHeight(lvl), dy: hop });
      if (box) HE.bubble(ctx, HE.strings.calls[pet], 128, box.y - 2);
      HE.drawImg(ctx, "hans-sulk", 208, 196, { h: 28, flipX: true });
      return;
    }
    drawSwamp(ctx);
    drawHud(ctx);
    drawPlates(ctx);
    drawCage(ctx, true);
    drawTrex(ctx);
    if (st.phase === "boom") HE.text(ctx, st.message, W / 2 - 14, H - 22, { size: 8, color: "#ffb74d" });
    else if (blink) HE.text(ctx, S.controls, W / 2 - 14, H - 12, { size: 8, color: "#607d8b" });
  }

  HE.registerScene("mines", {
    enter(payload) {
      st.door = payload.door || null;
      newField();
    },
    update,
    draw,
  });
  HE.minesState = st;
})();
