// localStorage saves, schema version 3, one slot per game. See
// wiki/designs/hunde-eventyr-profiles.md and hunde-eventyr-pets.md (v3:
// several pets, one active, a shared wardrobe). Slots are append-only: a new game
// or an imported file always becomes a new slot and nothing in the game
// deletes one (HE.deleteSlot exists for the console only). Change the shape
// only by bumping `version` and adding a step to upgrade().
(function () {
  const HE = (window.HE = window.HE || {});
  const PREFIX = "hunde-eventyr.save."; // + slot id
  const OLD_KEY = "hunde-eventyr.save"; // the single v1 slot
  const ls = window.localStorage;

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function fresh(profile) {
    return {
      version: 3,
      id: newId(),
      created: new Date().toISOString(),
      played: new Date().toISOString(),
      profile: profile || { hero: "freja", age: 10 },
      gold: 0,
      pets: { bandit: newPet() }, // per pet id: level, np, wearing
      activePet: "bandit", // who walks with you; the rest live in Reservatet
      wardrobe: [], // outfit ids owned, shared by every pet
      inventory: { aeble: 0, banan: 0, burger: 0, pizza: 0, kage: 0 },
      stats: {}, // per task key: { correct, wrong }, created on first bank
      games: 0,
      races: { won: 0, lost: 0 }, // P7 Fartringen tally
      records: {}, // per task key: fastest nine-of-nine winning race, seconds
    };
  }
  function newPet() {
    return { level: 1, np: 0, wearing: [] };
  }

  // Bring any past save shape up to the current one; null if not a save.
  function upgrade(s) {
    if (!s || !(s.dog || s.pets) || typeof s.gold !== "number") return null;
    if (s.version === 1) {
      s.version = 2;
      s.id = newId();
      s.created = s.played = new Date().toISOString();
      s.profile = { hero: "freja", age: 10 };
      s.stats = s.tables || {};
      delete s.tables;
    }
    if (s.version === 2) {
      // The single dog becomes the first of several pets.
      s.version = 3;
      s.pets = { bandit: { level: s.dog.level, np: s.dog.np, wearing: s.dog.wearing || [] } };
      s.activePet = "bandit";
      s.wardrobe = s.dog.owned || [];
      delete s.dog;
    }
    if (s.version !== 3) return null;
    // P7 fields, added to v3 without a bump: absent in saves from before Fartringen.
    s.races = s.races || { won: 0, lost: 0 };
    delete s.races.debt; // a short-lived rule from the afternoon of 2026-09-09
    s.records = s.records || {};
    // 2026-09-10: five snacks, no dog biscuits — old biscuits become apples.
    if (s.inventory.hundekiks !== undefined) {
      s.inventory.aeble = (s.inventory.aeble || 0) + s.inventory.hundekiks;
      delete s.inventory.hundekiks;
    }
    for (const id of Object.keys(HE.data.SNACKS)) s.inventory[id] = s.inventory[id] || 0;
    return s;
  }
  HE.newPet = newPet;

  function read(key) {
    try {
      return upgrade(JSON.parse(ls.getItem(key)));
    } catch (e) {
      return null;
    }
  }

  function write(s) {
    try {
      ls.setItem(PREFIX + s.id, JSON.stringify(s));
    } catch (e) {
      // Storage blocked (private mode, file:// quirks): the game still runs,
      // it just forgets between reloads.
    }
  }

  // One-off: move the single v1 save into a slot of its own.
  try {
    const old = read(OLD_KEY);
    if (old) {
      write(old);
      ls.removeItem(OLD_KEY);
    }
  } catch (e) {
    /* no storage */
  }

  // Every saved game, most recently played first.
  HE.slots = function () {
    const out = [];
    try {
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k.startsWith(PREFIX)) {
          const s = read(k);
          if (s) out.push(s);
        }
      }
    } catch (e) {
      /* no storage */
    }
    return out.sort((a, b) => (a.played < b.played ? 1 : -1));
  };

  // The active game: the last one played, or a blank one that is only
  // stored once something changes (dev shortcuts land here).
  HE.save = HE.slots()[0] || fresh();

  HE.persist = function () {
    HE.save.played = new Date().toISOString();
    write(HE.save);
  };

  HE.newGame = function (profile) {
    HE.save = fresh(profile);
    HE.persist();
  };

  HE.useSlot = function (slot) {
    HE.save = slot;
    HE.persist();
  };

  // Console only — the game never calls this. Same as deleting a file.
  HE.deleteSlot = function (id) {
    ls.removeItem(PREFIX + id);
  };

  // Stat bucket for a task key ("6", "plus", …), created on first use.
  HE.stat = function (key) {
    const st = HE.save.stats;
    if (!st[key]) st[key] = { correct: 0, wrong: 0 };
    return st[key];
  };

  HE.hero = () => HE.data.HEROES[HE.save.profile.hero] || HE.data.HEROES.freja;

  // Portable saves: localStorage never leaves the browser it was written in,
  // so Hjem can write the save to a file and the title screen can read one.
  HE.exportSave = function () {
    const blob = new Blob([JSON.stringify(HE.save, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hunde-eventyr-${HE.hero().name.toLowerCase()}-${HE.save.profile.age}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  };

  // Import a JSON string as a NEW slot (fresh id, so it can never land on
  // top of an existing game, even one exported from this browser).
  HE.importSaveText = function (text) {
    try {
      const s = upgrade(JSON.parse(text));
      if (!s) return false;
      s.id = newId();
      HE.save = s;
      HE.persist();
      return true;
    } catch (e) {
      return false;
    }
  };

  // Open the browser's file picker (must be called from a key handler frame,
  // which counts as user activation) and import the chosen file.
  HE.importSaveFile = function (done) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return done(false);
      file.text().then((t) => done(HE.importSaveText(t)), () => done(false));
    });
    document.body.appendChild(input);
    input.click();
  };

  // The active pet (or `id`): its save record, level and given name.
  // ?level=N is a preview override for art checks.
  HE.petId = () => HE.save.activePet;
  HE.pet = (id) => HE.save.pets[id || HE.save.activePet];
  HE.petLevel = function (id) {
    return Number(HE.params && HE.params.get("level")) || HE.pet(id).level;
  };
  HE.petName = (id) => HE.strings.petNames[id || HE.save.activePet];
  // Owned pets in catalogue order.
  HE.ownedPets = () => HE.data.PET_ORDER.filter((id) => HE.save.pets[id]);
})();
