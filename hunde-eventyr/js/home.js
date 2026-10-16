// Hjem: see the pet you walk with, its level and nam-nam-point bar; feed it
// snacks from the inventory; a level-up cuts to the ceremony in levelup.js
// and comes back. "Skift dyr" picks who walks with you when you own more
// than one (the rest live in Dyrenes Paradis). Also "Gem spil til fil".
(function () {
  const HE = window.HE;
  const S = HE.strings;
  const D = HE.data;
  const W = 256;
  const H = 224;
  const IDS = Object.keys(D.SNACKS);
  const FLOOR_Y = 150;
  const MAX_LEVEL = 10;

  const st = { door: null, sel: 0, msg: "", msgTimer: 0, frames: 0, picking: false, pick: 0 };

  function say(msg, t) {
    st.msg = msg;
    st.msgTimer = t || 60;
  }

  function feed(id) {
    const sv = HE.save;
    const pet = HE.pet();
    if (sv.inventory[id] <= 0) return;
    sv.inventory[id] -= 1;
    pet.np += D.SNACKS[id].np;
    const from = pet.level;
    while (pet.level < MAX_LEVEL && pet.np >= D.THRESHOLD(pet.level)) {
      pet.np -= D.THRESHOLD(pet.level);
      pet.level += 1;
    }
    if (pet.level >= MAX_LEVEL) pet.np = Math.min(pet.np, D.THRESHOLD(MAX_LEVEL - 1));
    HE.persist();
    if (pet.level > from) {
      // the ceremony (levelup.js) shows the change and brings us back here
      HE.go("levelup", { petId: HE.petId(), from, to: pet.level, back: { scene: "home", payload: { door: st.door, sel: st.sel } } });
    } else {
      say(S.home.yum);
    }
  }

  // Menu rows: snacks, then Skift dyr (when there is a choice), then save.
  function menu() {
    const items = IDS.map((id) => {
      const have = HE.save.inventory[id];
      return { label: S.home.feed(S.snacks[id], D.SNACKS[id].np, have), disabled: have <= 0, act: () => feed(id) };
    });
    if (HE.ownedPets().length > 1) {
      items.push({
        label: S.home.switchPet,
        act: () => {
          st.picking = true;
          st.pick = HE.ownedPets().indexOf(HE.petId());
        },
      });
    }
    items.push({
      label: S.home.saveFile,
      act: () => {
        HE.exportSave();
        say(S.home.saved);
      },
    });
    return items;
  }

  function updatePick(inp) {
    const owned = HE.ownedPets();
    if (inp.pressed("ArrowLeft")) st.pick = (st.pick + owned.length - 1) % owned.length;
    if (inp.pressed("ArrowRight")) st.pick = (st.pick + 1) % owned.length;
    if (inp.ok()) {
      HE.save.activePet = owned[st.pick];
      HE.persist();
      st.picking = false;
      say(S.home.switched(HE.petName()), 90);
    }
    if (inp.leave()) st.picking = false;
  }

  function update() {
    st.frames += 1;
    if (st.msgTimer > 0) st.msgTimer -= 1;
    const inp = HE.input;
    if (st.picking) return updatePick(inp);
    const items = menu();
    const n = items.length;
    if (inp.pressed("ArrowUp")) st.sel = (st.sel + n - 1) % n;
    if (inp.pressed("ArrowDown")) st.sel = (st.sel + 1) % n;
    if (inp.ok()) items[st.sel].act();
    if (inp.leave()) HE.go("town", { door: st.door });
  }

  function drawNpBar(ctx) {
    const pet = HE.pet();
    const full = pet.level >= MAX_LEVEL;
    const need = D.THRESHOLD(Math.min(pet.level, MAX_LEVEL - 1));
    const frac = full ? 1 : Math.min(1, pet.np / need);
    const x = 24;
    const y = 30;
    const w = W - 48;
    ctx.fillStyle = "#263238";
    ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = full ? "#fdd835" : "#f48fb1";
    ctx.fillRect(x, y, Math.round(w * frac), 8);
    ctx.fillStyle = "#cfd8dc";
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + 7, w, 1);
    ctx.fillRect(x, y, 1, 8);
    ctx.fillRect(x + w - 1, y, 1, 8);
    HE.text(ctx, full ? S.home.full : S.home.npBar(pet.np, need), W / 2, 41, { size: 8, color: "#cfd8dc" });
  }

  // Skift dyr: every owned pet in a row on the floor, the highlighted one lit.
  function drawPick(ctx) {
    const owned = HE.ownedPets();
    HE.text(ctx, S.home.whoWalks, W / 2, 10, { size: 12, color: "#fdd835" });
    const cell = Math.min(60, (W - 16) / owned.length);
    const x0 = W / 2 - (cell * owned.length) / 2 + cell / 2;
    owned.forEach((id, i) => {
      const cx = Math.round(x0 + i * cell);
      const lvl = HE.pet(id).level;
      const on = i === st.pick;
      if (on) {
        ctx.fillStyle = "#3e2723";
        ctx.fillRect(cx - cell / 2 + 2, 52, cell - 4, FLOOR_Y - 52);
      }
      const box = HE.drawPet(ctx, id, lvl, cx, FLOOR_Y, { height: Math.min(cell - 12, 24 + lvl * 3), frames: on ? st.frames : undefined });
      if (box && on) HE.bubble(ctx, S.town.resident(HE.petName(id), lvl), Math.min(Math.max(cx, 40), W - 40), box.y - 2);
      if (id === HE.petId()) HE.text(ctx, "•", cx, FLOOR_Y + 4, { size: 8, color: "#fdd835" });
    });
    if (st.frames % 60 < 40) HE.text(ctx, S.home.pickControls, W / 2, 204, { size: 8, color: "#cfd8dc" });
  }

  function draw(ctx) {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, W, H);
    // floor
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.fillStyle = "#6d4c41";
    for (let x = 0; x < W; x += 32) ctx.fillRect(x, FLOOR_Y, 1, H - FLOOR_Y);
    if (st.picking) return drawPick(ctx);

    const pet = HE.pet();
    HE.text(ctx, `${HE.petName()} · ${S.level(pet.level)}`, W / 2, 10, { size: 12, color: "#fdd835" });
    drawNpBar(ctx);

    const DOG_X = W - 40;
    const box = HE.drawPet(ctx, HE.petId(), pet.level, DOG_X, FLOOR_Y, { frames: st.frames });
    if (st.msgTimer > 0 && box) HE.bubble(ctx, st.msg, Math.min(DOG_X, W - 44), box.y - 2);

    const items = menu();
    HE.drawMenu(ctx, items, st.sel, 14, 60);
    if (IDS.every((id) => HE.save.inventory[id] <= 0)) {
      HE.text(ctx, S.home.none, 14, 60 + items.length * 14 + 6, { size: 8, align: "left", color: "#90a4ae" });
    }
    HE.text(ctx, S.arena.gold(HE.save.gold), W - 6, 168, { size: 8, align: "right", color: "#fdd835" });
    if (st.frames % 60 < 40) HE.text(ctx, S.home.controls, W / 2, 204, { size: 8, color: "#cfd8dc" });
  }

  HE.registerScene("home", {
    enter(payload) {
      st.door = payload.door || null;
      st.sel = payload.sel || 0; // kept across the level-up ceremony
      st.msg = "";
      st.msgTimer = 0;
      st.picking = false;
    },
    update,
    draw,
  });
  HE.homeState = st;
})();
