// Pixel-string sprites. One character per pixel, "." is transparent.
(function () {
  const HE = (window.HE = window.HE || {});

  const PALETTE = {
    K: "#1b1b1b", // outline
    E: "#000000", // eye / nose
    W: "#ffffff",
    L: "#cfd8dc", // light grey shade
    Y: "#fdd835", // yellow
    O: "#fb8c00", // orange
    R: "#e53935", // crab red
  };

  // Ground and arena things stay pixel art; everything that stands (pets,
  // heroes, the T-rex) is a cartoon PNG. See wiki/decisions/hunde-eventyr-stack.
  const ART = {
    crab: [
      "....W......W....",
      "....K......K....",
      "....R......R....",
      ".RR.RRRRRRRR.RR.",
      "RR.RRRRRRRRRR.RR",
      "R..RRRRRRRRRR..R",
      "...RRRRRRRRRR...",
      "...RRRRRRRRRR...",
      "....RRRRRRRR....",
      "...R.R.RR.R.R...",
      "..R..R....R..R..",
      "................",
    ],
    shot: ["YY", "YY", "YY", "OO", "OO", "OO"],
  };

  function build(rows) {
    const h = rows.length;
    const w = rows[0].length;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    rows.forEach((row, y) => {
      if (row.length !== w) throw new Error("sprite row width mismatch at row " + y);
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === ".") continue;
        ctx.fillStyle = PALETTE[ch];
        ctx.fillRect(x, y, 1, 1);
      }
    });
    return c;
  }

  HE.sprites = {};
  Object.keys(ART).forEach((name) => {
    HE.sprites[name] = build(ART[name]);
  });

  HE.drawSprite = function (ctx, name, x, y, scale) {
    const s = HE.sprites[name];
    const k = scale || 1;
    ctx.drawImage(s, Math.round(x), Math.round(y), s.width * k, s.height * k);
  };

  // Cartoon PNGs in assets/ (generated, keyed offline; see
  // wiki/decisions/hunde-eventyr-stack.md): every pet per level, the four
  // buildings, props, the heroes in three facings, the T-rex skater's two
  // frames, Hyæne Hans's five poses. Drawn smoothed.
  const IMAGES = {};
  function loadImage(name, file) {
    const img = new Image();
    img.src = "assets/" + file;
    IMAGES[name] = img;
  }
  Object.entries(HE.data.PETS).forEach(([id, def]) => {
    for (let lvl = 1; lvl <= 10; lvl++) loadImage(id + lvl, def.img + "-" + String(lvl).padStart(2, "0") + ".png");
  });
  ["house-home", "house-arena", "house-shop", "house-rescue", "house-race", "house-wall", "house-mines", "house-bridge", "tree", "bush", "gate", "trex-a", "trex-b"]
    .concat(["hans-idle", "hans-run-a", "hans-run-b", "hans-gloat", "hans-sulk"])
    .forEach((n) => loadImage(n, n + ".png"));
  Object.values(HE.data.HEROES).forEach((h) =>
    ["-down", "-up", "-left"].forEach((f) => loadImage(h.img + f, h.img + f + ".png"))
  );
  HE.data.OUTFITS.forEach((o) => loadImage("outfit-" + o.id, "outfit-" + o.id + ".png"));

  HE.img = (name) => {
    const img = IMAGES[name];
    return img && img.complete && img.naturalWidth ? img : null;
  };
  HE.imagesReady = () => Object.values(IMAGES).every((i) => i.complete);

  // Draw image `name` with its bottom-centre at (cx, bottom), scaled to height
  // h (or width w). flipX mirrors it; squash (<1) flattens and widens it.
  // Returns the drawn box or null.
  HE.drawImg = function (ctx, name, cx, bottom, o) {
    const img = HE.img(name);
    if (!img) return null;
    const ratio = img.naturalWidth / img.naturalHeight;
    const squash = o.squash || 1;
    const h0 = o.h || o.w / ratio;
    const h = h0 * squash;
    const w = (o.w || h0 * ratio) / squash;
    const x = Math.round(cx - w / 2);
    const y = Math.round(bottom - h);
    ctx.imageSmoothingEnabled = true;
    if (o.flipX) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
    ctx.imageSmoothingEnabled = false;
    return { x, y, w, h };
  };

  // Worn outfit overlays. Each slot is a point on the pet's box (fractions of
  // width/height; eye and neck rows vary per pet and level in data.PETS)
  // plus how the item hangs off it: "bottom" sits on the point, "centre"
  // straddles it. "back" slot items are drawn behind the animal.
  function slotPoint(slot, pet, lvl) {
    const eyeY = pet.eyeY[lvl - 1];
    const neckY = pet.neckY[lvl - 1];
    const x = pet.eyeX ? pet.eyeX[lvl - 1] : 0.5;
    switch (slot) {
      case "head":
        return { x, y: 0.08, hang: "bottom" };
      case "eyes":
        return { x, y: eyeY, hang: "centre" };
      case "neck":
        return { x, y: neckY, hang: "centre" };
      case "chest":
        return { x, y: neckY + 0.14, hang: "centre" };
      case "feet":
        return { x: 0.5, y: 1.0, hang: "bottom" };
      case "back":
        return { x: 0.5, y: neckY + 0.12, hang: "centre" };
    }
  }
  function drawOutfits(ctx, pet, lvl, box, ids, behind) {
    ids.forEach((id) => {
      const def = HE.data.OUTFITS.find((o) => o.id === id);
      if (!def || (def.slot === "back") !== behind) return;
      const p = slotPoint(def.slot, pet, lvl);
      const img = HE.img("outfit-" + id);
      if (!img) return;
      const w = box.w * def.w;
      const h = (w * img.naturalHeight) / img.naturalWidth;
      const px = box.x + box.w * p.x;
      const py = box.y + box.h * (p.y + (def.dy || 0));
      HE.drawImg(ctx, "outfit-" + id, px, p.hang === "bottom" ? py : py + h / 2, { w });
    });
  }

  // Draw pet `petId` at `level`, horizontally centred on cx, feet on
  // `baseline`. opts: frames (idle bob), height (override the level height),
  // dy (extra vertical offset, negative = up), squash (1 = normal; <1
  // flattens it, used for the sad sag), wearing (outfit ids; defaults to
  // that pet's in the save, [] for a bare animal), flipX. Returns the box.
  HE.drawPet = function (ctx, petId, level, cx, baseline, opts) {
    const o = opts || {};
    const pet = HE.data.PETS[petId];
    const lvl = Math.min(10, Math.max(1, level | 0));
    const img = pet && HE.img(petId + lvl);
    if (!img) return null;
    const squash = o.squash || 1;
    const h0 = o.height || HE.data.petHeight(lvl);
    const h = h0 * squash; // flatter ...
    const w = ((img.naturalWidth / img.naturalHeight) * h0) / squash; // ... and wider
    const bob = o.frames === undefined ? 0 : Math.round(Math.sin(o.frames / 20) * 1.5);
    const x = Math.round(cx - w / 2);
    const y = Math.round(baseline - h + bob + (o.dy || 0));
    const box = { x, y, w, h };
    const saved = HE.save && HE.save.pets && HE.save.pets[petId];
    const wearing = o.wearing || (saved && saved.wearing) || [];
    if (o.flipX) {
      ctx.save();
      ctx.translate(2 * cx, 0);
      ctx.scale(-1, 1);
    }
    drawOutfits(ctx, pet, lvl, box, wearing, true);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x, y, w, h);
    ctx.imageSmoothingEnabled = false;
    drawOutfits(ctx, pet, lvl, box, wearing, false);
    if (o.flipX) ctx.restore();
    return box;
  };
})();
