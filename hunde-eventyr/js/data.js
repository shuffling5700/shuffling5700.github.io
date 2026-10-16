// Every tunable number lives here. See wiki/designs/hunde-eventyr.md.
(function () {
  const HE = (window.HE = window.HE || {});

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // What Guldarenaen asks lives in js/tasks/ (age10.js, age7.js), chosen by
  // the save's profile. The hero only changes the walking sprite.
  const HEROES = {
    freja: { name: "Freja", img: "freja" },
    gregers: { name: "Gregers", img: "ninja" },
  };
  const AGES = [7, 10];

  // Town, 31x23 tiles of 16 px (the camera scrolls). Legend:
  // T trees (solid)  ~ pond (solid)  . grass  b bush (solid)  # fence
  // f flowers  M hill (both walkable)  Y the big tree (solid; the pets
  // nap on the tiles beside it)  H Hjem  A Guldarenaen  Q Fartringen
  // S Snackbutikken  P Dyreredningen  W Tabelmuren  X Minefeltet  d door (walk
  // onto it)  G locked gate  F hero spawn  B pet spawn. Building letters
  // are solid; a building is 5 wide and 4 tall including the door row, and
  // its image is scaled to that footprint plus an 8 px roof edge so nobody
  // vanishes behind a roof while walking past. Door columns match the
  // doors painted on the generated building images (Hjem, arena and
  // Dyreredningen centred, shop right). Keep two free tiles between
  // buildings and a free row under every door. The fenced L (rows 1–5
  // across the top, cols 8–14 down the west side of Hjem to the row above
  // Guldarenaen) is Dyrenes Paradis, where the pets you are not walking
  // with live: two ponds, a hill, flowers and the big tree. `g` is the gap
  // in the fence — open to the hero, a wall to the residents — and `R`
  // marks where residents may roam (flood-filled from there over grass,
  // flowers and hill).
  const MAP = [
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    "T.......##################....T",
    "T.......#..f~~~..MMM..T..#....T",
    "T.......#.Y.~~~..MMM.f...#....T",
    "T.......#....f...MMM..R..#....T",
    "T.......#.....############....T",
    "T.LLLLL.#....f#...............T",
    "T.LLLLL.#..~~.#.HHHHH.....TTTTT",
    "T.LLLLL.#..~~.g.HHHHH.....T####",
    "T.LLdLL.#.f...#.HHHHH.....T#..#",
    "T.......#######.HHdHH......G..#",
    "T..........................####",
    "T.QQQQQ..AAAAA.........SSSSS..T",
    "T.QQQQQ..AAAAA.........SSSSS..T",
    "T.QQQQQ..AAAAA.........SSSSS..T",
    "T.QQdQQ..AAdAA.........SSSdS..T",
    "T........b....................T",
    "T..WWWWW.....F...PPPPP..XXXXX.T",
    "T..WWWWW.....B...PPPPP..XXXXX.T",
    "T..WWWWW.........PPPPP..XXXXX.T",
    "T..WWdWW.........PPdPP..XXdXX.T",
    "T...........~~~...............T",
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  ];
  const BUILDING_SCENE = { H: "home", A: "arena", S: "shop", P: "pets", Q: "race", W: "wall", X: "mines", L: "bridge" };

  // Dyrenes Paradis's interior: open ground reachable from R without
  // crossing the fence or its gap.
  const OPEN = new Set([".", "R", "f", "M"]);
  function sanctuaryTiles() {
    const start = findTile("R");
    const seen = new Set();
    const out = [];
    const stack = [start];
    while (stack.length) {
      const { x, y } = stack.pop();
      const key = x + "," + y;
      if (seen.has(key)) continue;
      const ch = MAP[y] && MAP[y][x];
      if (!OPEN.has(ch)) continue;
      seen.add(key);
      out.push({ x, y });
      stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
    }
    return out;
  }

  // Doors: each 'd' belongs to the building letter directly above it.
  function doors() {
    const out = [];
    MAP.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== "d") continue;
        const above = MAP[y - 1][x];
        out.push({ x, y, building: above, scene: BUILDING_SCENE[above] });
      }
    });
    return out;
  }

  function findTile(ch) {
    for (let y = 0; y < MAP.length; y++) {
      const x = MAP[y].indexOf(ch);
      if (x >= 0) return { x, y };
    }
    return null;
  }

  HE.data = {
    pick,
    HEROES,
    AGES,
    // Age 7: how often a game is Plus, Minus or a 2/5/10-table.
    age7: { weights: { plus: 60, minus: 30, tables: 10 } },
    MAP,
    TILE: 16,
    BUILDING_SCENE,
    DOORS: doors(),
    SPAWN: { freja: findTile("F"), bandit: findTile("B") },
    SANCTUARY: sanctuaryTiles(),
    SANCTUARY_GAP: findTile("g"),
    BIG_TREE: findTile("Y"),
    SANCTUARY_SIGN: { x: 17, y: 1 }, // fence tile the sign hangs on
    town: {
      walkSpeed: 2, // px per frame; 8 frames per tile
      hudHeight: 16,
      roofEdge: 8, // px a building image rises above its footprint
      idleSpeed: 1, // residents amble at half pace
      idleWaitMin: 60, // frames between a resident's decisions
      idleWaitMax: 180,
      idleHopChance: 0.25,
      idleCallChance: 0.15,
      napChance: 0.5, // beside the big tree: chance a decision is a nap instead
      napMin: 240, // frames a nap lasts (4–8 s)
      napMax: 480,
    },
    // The active pet trotting behind the hero on the map: 15 px at level 1, 24 at 10.
    petMapHeight: (lvl) => 14 + lvl,
    arena: {
      trexSpeed: 2, // px per frame
      shotSpeed: 4, // px per frame
      hitPauseCorrect: 60, // frames (1 s)
      hitPauseWrong: 100, // frames; longer so the answer can be read
      bonusGold: 1,
      trexMinX: 52, // keeps the T-rex clear of the pet on the sideline
      trexHeight: 28, // cartoon skater (was a 16 px pixel sprite)
      banditX: 26, // sideline centre x
      hopHeight: 8, // px, correct-hit cheer
      hopsPerSecond: 2,
    },
    // P7 Fartringen: nine questions against Hyæne Hans on an oval; see
    // wiki/designs/hunde-eventyr-fartringen.md for the calibration.
    race: {
      stepsPerQuestion: 6, // lap = rounds × 6: all-Turbo is exactly one lap; Hans averages 4 a turn
      hansSteps: [3, 5], // Hans's random steps per answer, inclusive
      tableBudget: [25, 50], // s for a whole nine-question table (age 10); was 20–40, +25% after the 2026-09-09 playtest
      questionBudget: [5, 10], // s per question for plus, minus and the age-7 mix
      // Steps for a correct answer by time as a fraction of the budget b.
      tiers: [
        { upTo: 0.5, steps: 6, shout: "turbo" },
        { upTo: 0.75, steps: 5, shout: "fast" },
        { upTo: 1, steps: 4, shout: "good" },
        { upTo: 1.5, steps: 3, shout: "faster" },
        { upTo: Infinity, steps: 2, shout: "comeOn" },
      ],
      movePause: 50, // frames the step animation takes
      wrongPause: 90, // frames the right answer stays up
      // The prize follows the table: 7 for the 3-table up to 25 for the
      // 9-table (3 a step, clamped so the age-7 2- and 10-tables pay 7 and
      // 25); plus and minus pay a flat 15. Scaled so the best race — the
      // 9-table against Hans in top form — pays 50 (was 10–40 and 80 at the
      // top until the user capped it the same evening).
      winGold: 15,
      winGoldForTable: (t) => Math.max(7, Math.min(25, 7 + (t - 3) * 3)),
      // …then scaled by Hans's form (the budget draw): top form ×2, sleepy ×½.
      formPrize: { top: 2, ok: 1, sleepy: 0.5 },
      // No stake since 2026-09-10 (user): a loss costs nothing, and the old
      // 5-gold stake is taken off the prize instead, never below minPrize.
      entryFromPrize: 5,
      flatTable: 2, // the table whose prize every age-7 table race pays
      minPrize: 3,
      perfectGold: 5, // nine Turbo answers
      recordGold: 10, // new course record: fastest nine-of-nine win per task key
      hansHeight: 30,
      trexHeight: 26, // the referee
    },
    // Minefeltet: plates 1 … 10t in a serpentine. Ten across shows a table as
    // a pattern; the 5- and 10-tables would show as plain columns at ten, so
    // they get an uneven width (user, 2026-09-10).
    mines: {
      cols: { 5: 8, 10: 12 },
      defaultCols: 10,
      eatPause: 60, // frames for the bomb rising, the belly bang and the burp
      boomPause: 80, // frames for the explosion and the arc back to start
      bonusGold: 1, // no explosions
    },
    // Brobyggeren (age 10 only): five island hops, planks t metres long.
    // Gap factors are a shuffle of gapKs, tree factors a shuffle of treeKs,
    // so a game asks every multiple 1t … 10t once; the leftovers on each
    // island are the difference, which is what stops the right tree from
    // simply being as tall as the gap.
    // Brobyggeren v3 (2026-09-13, user): multiplication only. Nine islands,
    // nine trees of k logs t metres each in a shuffled order of k; "t × k = ?"
    // says how long a bridge the tree gives, the bridge is built, the camera
    // pans along the chain to the caged pet.
    bridge: {
      ks: [2, 3, 4, 5, 6, 7, 8, 9, 10], // shuffled: nine rounds, one bridge each
      maxTries: 3, // the third wrong answer shows the answer and moves on
      fallPause: 60, // frames: the tree tipping over
      buildPause: 60, // frames: the planks sliding into the gap
      crossPause: 60, // frames: skating over while the camera pans
      rightGold: 2, // double Guldarenaen (user, 2026-09-13)
      wrongGold: 1,
      bonusGold: 2, // nine right
      span: 112, // world px from one island's left edge to the next
      landW: 64, // island width; the gap is span - landW
      minAge: 10,
    },
    // A pet's drawn height in logical px per level: 32 at level 1, 86 at 10.
    petHeight: (lvl) => 32 + 6 * (lvl - 1),
    // Smaller on the arena sideline so it never dwarfs the T-rex: 24 to 51.
    petArenaHeight: (lvl) => 24 + 3 * (lvl - 1),
    // P6: every animal is a full Bandit-equivalent. `img` is the file stem
    // under assets/ (levels -01..-10), `price` in gold at Dyrehandlen (a
    // ladder: cat 100, desert rat 200, tiger 300, elephant 400, dragon 500,
    // so the fifth animal is a real goal), and
    // eyeY / neckY say where the eyes and neck sit in each level's image as
    // fractions of its height (outfit anchors; babies are mostly head).
    // Names and calls are in strings.js. Bandit is the pet you start with.
    PETS: {
      bandit: {
        img: "bandit",
        price: 0,
        eyeY: [0.38, 0.35, 0.32, 0.29, 0.26, 0.25, 0.24, 0.23, 0.22, 0.21],
        neckY: [0.64, 0.6, 0.57, 0.54, 0.51, 0.49, 0.48, 0.47, 0.46, 0.46],
      },
      tiger: {
        img: "pets/tiger",
        price: 300,
        eyeY: [0.34, 0.32, 0.3, 0.28, 0.27, 0.27, 0.26, 0.24, 0.23, 0.22],
        neckY: [0.56, 0.53, 0.5, 0.48, 0.47, 0.47, 0.45, 0.43, 0.41, 0.4],
      },
      elefant: {
        img: "pets/elefant",
        price: 400,
        eyeY: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.29, 0.29, 0.3, 0.3],
        neckY: [0.52, 0.52, 0.52, 0.52, 0.52, 0.52, 0.5, 0.5, 0.5, 0.5],
      },
      kat: {
        img: "pets/kat",
        price: 100,
        eyeY: [0.34, 0.3, 0.27, 0.25, 0.24, 0.22, 0.2, 0.18, 0.17, 0.16],
        neckY: [0.56, 0.5, 0.45, 0.42, 0.4, 0.4, 0.38, 0.36, 0.35, 0.34],
      },
      drage: {
        img: "pets/drage",
        price: 500,
        // coiled upright: from level 3 the head sits at the top left of a
        // wide coil, so the anchors also move left (eyeX; others sit at 0.5)
        eyeX: [0.5, 0.5, 0.45, 0.42, 0.4, 0.5, 0.45, 0.42, 0.4, 0.38],
        eyeY: [0.3, 0.24, 0.16, 0.14, 0.13, 0.3, 0.2, 0.15, 0.14, 0.16],
        neckY: [0.5, 0.4, 0.3, 0.27, 0.26, 0.5, 0.35, 0.28, 0.27, 0.3],
      },
      oerkenrotte: {
        img: "pets/oerkenrotte",
        price: 200,
        eyeY: [0.3, 0.26, 0.22, 0.2, 0.18, 0.2, 0.19, 0.17, 0.16, 0.16],
        neckY: [0.5, 0.44, 0.38, 0.35, 0.33, 0.35, 0.34, 0.31, 0.3, 0.3],
      },
    },
    PET_ORDER: ["bandit", "kat", "oerkenrotte", "tiger", "elefant", "drage"], // cheapest first
    // P3 onwards
    // Five snacks for a mixed menagerie (2026-09-10: no more dog biscuits);
    // the bigger the plate the more nam-nam per gold.
    SNACKS: {
      aeble: { np: 5, gold: 5 },
      banan: { np: 11, gold: 10 },
      burger: { np: 24, gold: 20 },
      pizza: { np: 38, gold: 30 },
      kage: { np: 65, gold: 50 },
    },
    THRESHOLD: (n) => 10 * n,
    // P4: Hunde-stil. One wearable unlocks per dog level; the price follows
    // the nam-nam needed to leave that level (10n gold), so a new outfit
    // costs about one level's worth of snacks. One item per slot may be worn.
    // `w` is the item width as a fraction of Bandit's drawn width; `dy`
    // nudges it down by a fraction of his height.
    OUTFITS: [
      { id: "sloejfe", level: 1, slot: "head", w: 0.45 },
      { id: "bandana", level: 2, slot: "neck", w: 0.5 },
      { id: "briller", level: 3, slot: "eyes", w: 0.55 },
      { id: "festhat", level: 4, slot: "head", w: 0.35 },
      { id: "halstoerklaede", level: 5, slot: "neck", w: 0.42, dy: 0.06 }, // tall ring: hang it lower
      { id: "stoevler", level: 6, slot: "feet", w: 0.6 },
      { id: "kappe", level: 7, slot: "back", w: 1.1 },
      { id: "stjerne", level: 8, slot: "chest", w: 0.22 },
      { id: "vinger", level: 9, slot: "back", w: 1.5 },
      { id: "krone", level: 10, slot: "head", w: 0.4 },
    ],
    OUTFIT_PRICE: (level) => 10 * level,
  };
})();
