// Dyreredningen: animals that need help, one of each. Gold pays the vet,
// the food and the journey (100–500 by animal); a rescued animal arrives at
// level 1 with no nam-nam and you are asked whether it walks with you —
// no sends it to Dyrenes Paradis. Switching later happens at Hjem. Bandit
// heads the list as your friend so it is plain he stays.
(function () {
  const HE = window.HE;
  const S = HE.strings;
  const D = HE.data;
  const W = 256;
  const H = 224;
  const IDS = D.PET_ORDER;

  const st = { door: null, sel: 0, msg: "", msgTimer: 0, frames: 0, asking: null };

  function say(msg, t) {
    st.msg = msg;
    st.msgTimer = t || 60;
  }

  function rescue() {
    const id = IDS[st.sel];
    const sv = HE.save;
    if (sv.pets[id]) return say(S.pets.ownedMsg);
    const price = D.PETS[id].price;
    if (sv.gold < price) return say(S.shop.noGold);
    sv.gold -= price;
    sv.pets[id] = HE.newPet();
    HE.persist();
    st.asking = id;
    say(S.pets.takeHome, 100000);
  }

  function answer(yes) {
    const id = st.asking;
    st.asking = null;
    if (yes) {
      HE.save.activePet = id;
      HE.persist();
      say(S.pets.comesAlong(HE.petName(id)), 90);
    } else say(S.pets.toSanctuary(HE.petName(id)), 90);
  }

  function update() {
    st.frames += 1;
    if (st.msgTimer > 0) st.msgTimer -= 1;
    const inp = HE.input;
    if (st.asking) {
      if (inp.ok()) answer(true);
      else if (inp.leave()) answer(false);
      return;
    }
    const n = IDS.length;
    if (inp.pressed("ArrowUp")) st.sel = (st.sel + n - 1) % n;
    if (inp.pressed("ArrowDown")) st.sel = (st.sel + 1) % n;
    if (inp.ok()) rescue();
    if (inp.leave()) HE.go("town", { door: st.door });
  }

  function items() {
    return IDS.map((id) => {
      const def = D.PETS[id];
      const have = !!HE.save.pets[id];
      let label = def.price && !have ? S.pets.item(S.species[id], S.petNames[id], def.price) : `${S.species[id]} ${S.petNames[id]}`;
      let disabled = false;
      if (!def.price) label += "  " + S.pets.friend;
      else if (have) label += "  " + S.pets.owned;
      else disabled = HE.save.gold < def.price;
      return { label, disabled };
    });
  }

  function draw(ctx) {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, W, H);
    // counter
    ctx.fillStyle = "#a5d6a7";
    ctx.fillRect(0, 178, W, 4);
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, 182, W, H - 182);
    HE.text(ctx, S.town.pets, W / 2, 4, { size: 16, color: "#fdd835" });
    HE.text(ctx, S.pets.subtitle, W / 2, 24, { size: 8, color: "#cfd8dc" });
    HE.text(ctx, S.arena.gold(HE.save.gold), W - 6, 6, { size: 8, align: "right", color: "#fdd835" });
    HE.drawMenu(ctx, items(), st.sel, 14, 40);

    // the highlighted animal's story and what the rescue costs
    const id = st.asking || IDS[st.sel];
    const def = D.PETS[id];
    HE.text(ctx, S.pets.story[id], 8, 132, { size: 8, align: "left", color: "#e8f5e9" });
    if (def.price && !HE.save.pets[id]) HE.text(ctx, S.pets.cost(def.price), 8, 146, { size: 8, align: "left", color: "#ffb74d" });

    // preview: at its level if rescued, else the youngster waiting for help
    const lvl = HE.save.pets[id] ? HE.save.pets[id].level : 1;
    const PET_X = W - 40;
    const box = HE.drawPet(ctx, id, lvl, PET_X, 214, { height: 52, frames: st.frames });
    if (st.msgTimer > 0 && box) HE.bubble(ctx, st.msg, st.asking ? W / 2 : Math.min(PET_X, W - 44), box.y - 2);
    if (!st.asking && st.frames % 60 < 40) HE.text(ctx, S.pets.controls, 4, 204, { size: 8, align: "left", color: "#e8f5e9" });
  }

  HE.registerScene("pets", {
    enter(payload) {
      st.door = payload.door || null;
      st.sel = 1; // first animal in need
      st.msg = "";
      st.msgTimer = 0;
      st.asking = null;
    },
    update,
    draw,
  });
  HE.petsState = st;
})();
