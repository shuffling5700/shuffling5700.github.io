// Town: tile map, the hero walks tile to tile, the active pet trots one
// tile behind, doors open buildings (arena.js, race.js, shop.js, home.js,
// pets.js).
// Dyrenes Paradis (the fenced L around Hjem) holds the pets you are not
// walking with as idle walkers; stand next to one and press ok to hear its
// name and level.
(function () {
  const HE = window.HE;
  const D = HE.data;
  const S = HE.strings;
  const T = D.TILE;
  const MAP = D.MAP;
  const W = 256;
  const H = 224;
  const HUD = D.town.hudHeight;
  const VIEW_H = H - HUD;
  const MAP_W = MAP[0].length * T;
  const MAP_H = MAP.length * T;

  const BUILDING = {
    H: { img: "house-home", name: () => S.town.home },
    A: { img: "house-arena", name: () => S.arena.name },
    S: { img: "house-shop", name: () => S.town.shop },
    P: { img: "house-rescue", name: () => S.town.pets },
    W: { img: "house-wall", name: () => S.town.wall },
    X: { img: "house-mines", name: () => S.town.mines },
    L: { img: "house-bridge", name: () => (HE.activeTasks().division ? S.town.bridge : S.bridge.onlyTen) },
    Q: { img: "house-race", name: () => S.race.name },
  };

  // Footprint per building letter (door row included): image is drawn
  // bottom-aligned at the footprint height plus a small roof edge, width
  // from its aspect, so the roof barely overhangs the row above.
  const HOUSES = Object.keys(BUILDING).map((ch) => {
    let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
    MAP.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== ch && !(row[x] === "d" && MAP[y - 1][x] === ch)) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    });
    return { ch, cx: ((x0 + x1 + 1) / 2) * T, h: (y1 - y0 + 1) * T + D.town.roofEdge, bottom: (y1 + 1) * T };
  });

  const st = { freja: null, bandit: null, residents: [], cam: { x: 0, y: 0 }, msg: "", msgTimer: 0 };
  let frames = 0;

  function tileAt(x, y) {
    if (y < 0 || y >= MAP.length || x < 0 || x >= MAP[0].length) return "T";
    return MAP[y][x];
  }
  const walkable = (ch) => ".dFBRgfM".includes(ch);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

  function walker(tx, ty) {
    return { tx, ty, toX: tx, toY: ty, x: tx * T, y: ty * T, dir: "down", moving: false, speed: D.town.walkSpeed };
  }

  // Advance a walker towards its target tile. True on the frame it arrives.
  function step(w) {
    const sp = w.speed;
    const gx = w.toX * T;
    const gy = w.toY * T;
    if (w.x < gx) w.x = Math.min(gx, w.x + sp);
    else if (w.x > gx) w.x = Math.max(gx, w.x - sp);
    if (w.y < gy) w.y = Math.min(gy, w.y + sp);
    else if (w.y > gy) w.y = Math.max(gy, w.y - sp);
    if (w.x === gx && w.y === gy) {
      w.tx = w.toX;
      w.ty = w.toY;
      w.moving = false;
      return true;
    }
    return false;
  }

  function say(msg) {
    st.msg = msg;
    st.msgTimer = 90;
  }

  function tryMove(dx, dy, dir) {
    const f = st.freja;
    f.dir = dir;
    const nx = f.tx + dx;
    const ny = f.ty + dy;
    const ch = tileAt(nx, ny);
    if (ch === "G") {
      say(S.town.locked);
      return;
    }
    if (!walkable(ch)) return;
    if (st.residents.some((r) => (r.tx === nx && r.ty === ny) || (r.toX === nx && r.toY === ny))) return; // no walking through a resident
    // The pet heads for the tile the hero is leaving.
    const b = st.bandit;
    if (b.tx !== f.tx || b.ty !== f.ty) {
      b.dir = b.tx < f.tx ? "right" : b.tx > f.tx ? "left" : b.ty < f.ty ? "down" : "up";
      b.toX = f.tx;
      b.toY = f.ty;
      b.moving = true;
    }
    f.toX = nx;
    f.toY = ny;
    f.moving = true;
  }

  // ---- Reservatet -----------------------------------------------------------
  // Every owned pet except the active one lives here as an idle walker: a
  // random step every 1–3 s, sometimes a hop or its call, facing a neighbour
  // when one is adjacent. They only ever step onto SANCTUARY tiles, so the
  // fence (and its gap) holds them in.
  const inSanctuary = (x, y) => D.SANCTUARY.some((t) => t.x === x && t.y === y);

  function placeResidents() {
    const free = D.SANCTUARY.slice();
    st.residents = HE.ownedPets()
      .filter((id) => id !== HE.petId())
      .map((id) => {
        const t = free.splice(Math.floor(Math.random() * free.length), 1)[0];
        const r = walker(t.x, t.y);
        r.id = id;
        r.speed = D.town.idleSpeed;
        r.wait = rnd(D.town.idleWaitMin, D.town.idleWaitMax);
        r.hop = 0;
        r.call = 0;
        r.nap = 0;
        return r;
      });
  }

  const occupied = (x, y) =>
    st.residents.some((r) => (r.tx === x && r.ty === y) || (r.toX === x && r.toY === y)) ||
    (st.freja.tx === x && st.freja.ty === y) ||
    (st.bandit.tx === x && st.bandit.ty === y);

  const besideTree = (x, y) => D.BIG_TREE && Math.abs(x - D.BIG_TREE.x) <= 1 && Math.abs(y - D.BIG_TREE.y) <= 1;

  function decide(r) {
    r.wait = rnd(D.town.idleWaitMin, D.town.idleWaitMax);
    const roll = Math.random();
    // in the shade of the big tree: often just lie down for a while
    if (besideTree(r.tx, r.ty) && roll < D.town.napChance) {
      r.wait = rnd(D.town.napMin, D.town.napMax);
      return (r.nap = r.wait);
    }
    if (roll < D.town.idleCallChance) return (r.call = 60);
    if (roll < D.town.idleCallChance + D.town.idleHopChance) return (r.hop = 16);
    // face a neighbour instead of walking away from it
    const near = st.residents.find((o) => o !== r && Math.abs(o.tx - r.tx) + Math.abs(o.ty - r.ty) === 1);
    if (near) {
      r.dir = near.tx < r.tx ? "left" : near.tx > r.tx ? "right" : near.ty < r.ty ? "up" : "down";
      return;
    }
    const dirs = [
      [1, 0, "right"],
      [-1, 0, "left"],
      [0, 1, "down"],
      [0, -1, "up"],
    ].filter(([dx, dy]) => inSanctuary(r.tx + dx, r.ty + dy) && !occupied(r.tx + dx, r.ty + dy));
    if (!dirs.length) return;
    const [dx, dy, dir] = dirs[Math.floor(Math.random() * dirs.length)];
    r.dir = dir;
    r.toX = r.tx + dx;
    r.toY = r.ty + dy;
    r.moving = true;
  }

  function updateResidents() {
    for (const r of st.residents) {
      if (r.hop > 0) r.hop -= 1;
      if (r.call > 0) r.call -= 1;
      if (r.nap > 0) r.nap -= 1;
      if (r.tell > 0) r.tell -= 1;
      if (r.moving) step(r);
      else if (--r.wait <= 0) decide(r);
    }
  }

  // The resident the hero faces, if any.
  function facing() {
    const f = st.freja;
    const dx = f.dir === "left" ? -1 : f.dir === "right" ? 1 : 0;
    const dy = f.dir === "up" ? -1 : f.dir === "down" ? 1 : 0;
    return st.residents.find((r) => r.tx === f.tx + dx && r.ty === f.ty + dy && !r.moving);
  }

  function update() {
    frames += 1;
    const inp = HE.input;
    const f = st.freja;
    if (st.msgTimer > 0) st.msgTimer -= 1;

    if (!f.moving) {
      // held for walking, pressed so a quick tap still moves one tile
      const want = (k) => inp.held(k) || inp.pressed(k);
      if (want("ArrowLeft")) tryMove(-1, 0, "left");
      else if (want("ArrowRight")) tryMove(1, 0, "right");
      else if (want("ArrowUp")) tryMove(0, -1, "up");
      else if (want("ArrowDown")) tryMove(0, 1, "down");
      else if (inp.ok()) {
        const r = facing();
        if (r) {
          r.dir = f.dir === "left" ? "right" : f.dir === "right" ? "left" : f.dir === "up" ? "down" : "up";
          r.wait = Math.max(r.wait, 90);
          r.tell = 90;
        }
      }
    }
    if (f.moving && step(f)) {
      const door = D.DOORS.find((d) => d.x === f.tx && d.y === f.ty);
      if (door && door.scene === "bridge" && !HE.activeTasks().division) {
        say(S.bridge.tooYoung); // the 7-year-old profile has no division
      } else if (door) {
        HE.go(door.scene, { door });
        return;
      }
    }
    if (st.bandit.moving) step(st.bandit);
    updateResidents();

    st.cam.x = clamp(f.x + T / 2 - W / 2, 0, MAP_W - W);
    st.cam.y = clamp(f.y + T / 2 - VIEW_H / 2, 0, MAP_H - VIEW_H);
  }

  // ---- drawing -----------------------------------------------------------
  // Ground tiles are procedural (grass, pond, fence). Everything that stands
  // on the ground (houses, trees, bushes, gate, Freja, Bandit) is a generated
  // image drawn bottom-aligned and painter-sorted by its bottom edge, so a
  // roof hides whoever walks behind the house and Freja covers a door she
  // stands in front of.

  function drawGround(ctx, ch, x, y, tx, ty) {
    ctx.fillStyle = "#5cb85c";
    ctx.fillRect(x, y, T, T);
    if ((tx * 7 + ty * 13) % 5 === 0) {
      ctx.fillStyle = "#4caf50";
      ctx.fillRect(x + 4, y + 6, 2, 2);
      ctx.fillRect(x + 10, y + 11, 2, 2);
    }
    if (ch === "~") {
      ctx.fillStyle = "#42a5f5";
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "#90caf9";
      const o = Math.floor(frames / 30) % 2;
      ctx.fillRect(x + 2 + o, y + 5, 5, 1);
      ctx.fillRect(x + 9 - o, y + 11, 5, 1);
      if ((tx * 3 + ty * 5) % 4 === 0) {
        ctx.fillStyle = "#66bb6a"; // lily pad
        ctx.fillRect(x + 9, y + 3, 4, 3);
        ctx.fillStyle = "#f8bbd0";
        ctx.fillRect(x + 10, y + 3, 1, 1);
      }
    } else if (ch === "#") {
      ctx.fillStyle = "#8d6e63";
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "#6d4c41";
      ctx.fillRect(x, y + 7, T, 1);
      ctx.fillRect(x + 7, y, 1, 7);
      ctx.fillRect(x + 3, y + 8, 1, 8);
      ctx.fillRect(x + 11, y + 8, 1, 8);
    } else if (ch === "f") {
      // a flower patch: petals in three colours on the grass
      const cols = ["#f06292", "#fff176", "#ba68c8", "#ff8a65"];
      for (let i = 0; i < 4; i++) {
        const fx = x + 2 + ((i * 5 + tx * 3) % 11);
        const fy = y + 2 + ((i * 7 + ty * 5) % 11);
        ctx.fillStyle = cols[(i + tx + ty) % cols.length];
        ctx.fillRect(fx, fy, 2, 2);
        ctx.fillStyle = "#fff8e1";
        ctx.fillRect(fx, fy, 1, 1);
      }
    }
  }

  // The hill: one rounded mound over the block of M tiles, drawn on the
  // ground layer — shaded foot, sunlit top, a highlight up and left.
  const HILL = (() => {
    let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
    MAP.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== "M") continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    });
    return x1 < 0 ? null : { cx: ((x0 + x1 + 1) / 2) * T, cy: ((y0 + y1 + 1) / 2) * T, rx: ((x1 - x0 + 1) * T) / 2, ry: ((y1 - y0 + 1) * T) / 2 };
  })();

  function drawHill(ctx, sx, sy) {
    if (!HILL) return;
    const mound = (dx, dy, kx, ky, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(sx(HILL.cx) + dx, sy(HILL.cy) + dy, HILL.rx * kx, HILL.ry * ky, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    mound(0, 2, 1, 1, "#558b2f");
    mound(0, -1, 0.96, 0.92, "#8bc34a");
    mound(-3, -5, 0.6, 0.5, "#aed581");
    ctx.fillStyle = "#689f38"; // a few tufts
    for (let i = 0; i < 6; i++) ctx.fillRect(sx(HILL.cx) - 18 + i * 7, sy(HILL.cy) + 4 + (i % 2) * 5, 2, 1);
  }

  function drawSign(ctx, name, cx, y) {
    ctx.font = "bold 8px Menlo, 'Courier New', monospace";
    const w = Math.ceil(ctx.measureText(name).width) + 6;
    const x = Math.round(cx - w / 2);
    ctx.fillStyle = "#fff8e1";
    ctx.fillRect(x, y, w, 11);
    ctx.fillStyle = "#3e2723";
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + 10, w, 1);
    HE.text(ctx, name, cx, y + 2, { size: 8, color: "#3e2723" });
  }

  function drawWorld(ctx) {
    const cx = st.cam.x;
    const cy = st.cam.y; // world -> screen: subtract cam, add HUD
    const sx = (wx) => wx - cx;
    const sy = (wy) => wy - cy + HUD;
    const x0 = Math.floor(cx / T);
    const y0 = Math.floor(cy / T);
    const items = [];
    for (let ty = y0; ty <= y0 + VIEW_H / T + 1; ty++) {
      for (let tx = x0; tx <= x0 + W / T + 1; tx++) {
        const ch = tileAt(tx, ty);
        drawGround(ctx, ch, tx * T - cx, ty * T - cy + HUD, tx, ty);
        const bottom = (ty + 1) * T;
        const mid = tx * T + T / 2;
        if (ch === "T") items.push({ bottom, draw: () => HE.drawImg(ctx, "tree", sx(mid), sy(bottom), { h: 18 }) });
        else if (ch === "Y") items.push({ bottom, draw: () => HE.drawImg(ctx, "tree", sx(mid), sy(bottom + 2), { h: 44 }) });
        else if (ch === "b") items.push({ bottom, draw: () => HE.drawImg(ctx, "bush", sx(mid), sy(bottom), { h: 14 }) });
        else if (ch === "G") items.push({ bottom, draw: () => HE.drawImg(ctx, "gate", sx(mid), sy(bottom), { w: 20 }) });
      }
    }
    drawHill(ctx, sx, sy);
    for (const h of HOUSES) {
      items.push({
        bottom: h.bottom,
        draw: () => {
          const box = HE.drawImg(ctx, BUILDING[h.ch].img, sx(h.cx), sy(h.bottom), { h: h.h });
          if (box) drawSign(ctx, BUILDING[h.ch].name(), sx(h.cx), box.y + 3);
        },
      });
    }
    // Dyrenes Paradis's sign hangs on the north fence, above the top arm's
    // middle (the gap is beside Hjem, whose own sign would collide).
    const fence = D.SANCTUARY_SIGN;
    items.push({ bottom: fence.y * T + 1, draw: () => drawSign(ctx, S.town.sanctuary, sx(fence.x * T + T / 2), sy(fence.y * T + 2)) });

    const f = st.freja;
    items.push({
      bottom: f.y + T,
      draw: () => {
        const bob = f.moving && frames % 16 < 8 ? -1 : 0;
        const facing = f.dir === "up" ? "-up" : f.dir === "down" ? "-down" : "-left";
        HE.drawImg(ctx, HE.hero().img + facing, sx(f.x + T / 2), sy(f.y + T + bob), { h: 22, flipX: f.dir === "right" });
      },
    });
    const b = st.bandit;
    items.push({
      bottom: b.y + T + 0.5, // the pet in front when level with the hero
      draw: () => {
        const lvl = HE.petLevel();
        const opts = { height: D.petMapHeight(lvl) };
        if (b.moving) opts.dy = frames % 8 < 4 ? -1 : 0;
        else opts.frames = frames;
        HE.drawPet(ctx, HE.petId(), lvl, sx(b.x + T / 2), sy(b.y + T), opts);
      },
    });
    for (const r of st.residents) {
      items.push({
        bottom: r.y + T + 0.25,
        draw: () => {
          const lvl = HE.pet(r.id).level;
          const opts = { height: D.petMapHeight(lvl), flipX: r.dir === "right" };
          if (r.moving) opts.dy = frames % 8 < 4 ? -1 : 0;
          else if (r.hop > 0) opts.dy = -Math.round(Math.sin((r.hop / 16) * Math.PI) * 4);
          else if (r.nap > 0) opts.squash = 0.8; // lying down
          else opts.frames = frames;
          const box = HE.drawPet(ctx, r.id, lvl, sx(r.x + T / 2), sy(r.y + T), opts);
          if (!box) return;
          const bx = clamp(sx(r.x + T / 2), 30, W - 30);
          if (r.tell > 0) HE.bubble(ctx, S.town.resident(HE.petName(r.id), lvl), bx, box.y - 2);
          else if (r.call > 0) HE.bubble(ctx, S.calls[r.id], bx, box.y - 2);
          else if (r.nap > 0 && Math.floor(frames / 40) % 2) HE.bubble(ctx, S.town.nap, bx, box.y - 2);
        },
      });
    }
    items.sort((p, q) => p.bottom - q.bottom);
    for (const it of items) it.draw();
  }

  function drawHud(ctx) {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, W, HUD);
    HE.text(ctx, S.arena.gold(HE.save.gold), 4, 4, { size: 8, align: "left", color: "#fdd835" });
    HE.text(ctx, `${HE.petName()} · ${S.level(HE.petLevel())}`, W - 4, 4, { size: 8, align: "right", color: "#cfd8dc" });
  }

  function draw(ctx) {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, W, H);
    drawWorld(ctx);
    const f = st.freja;
    const tipY = f.y - st.cam.y + HUD - 8; // just above her 22 px image
    if (st.msgTimer > 0) HE.bubble(ctx, st.msg, f.x - st.cam.x + T / 2, tipY);
    else if (HE.save.games === 0) HE.bubble(ctx, S.town.hint, f.x - st.cam.x + T / 2, tipY);
    drawHud(ctx);
  }

  HE.registerScene("town", {
    enter(payload) {
      if (payload.door) {
        // Back out of a building: the hero on the door tile, the pet just below.
        st.freja = walker(payload.door.x, payload.door.y);
        st.bandit = walker(payload.door.x, payload.door.y + 1);
      } else if (!st.freja || payload.reset) {
        st.freja = walker(D.SPAWN.freja.x, D.SPAWN.freja.y);
        st.bandit = walker(D.SPAWN.bandit.x, D.SPAWN.bandit.y);
      }
      placeResidents(); // the active pet may have changed inside
      st.msg = "";
      st.msgTimer = 0;
      update(); // settle the camera before the first draw
    },
    update,
    draw,
  });
  HE.townState = st; // read-only view for playtest tooling
})();
