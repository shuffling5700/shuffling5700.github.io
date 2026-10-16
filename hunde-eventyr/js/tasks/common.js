// Shared by every task set. A task set is HE.tasks[age] = { keys, newGame() }
// where newGame() returns { key, title, rounds: [{ prompt, answer, signs }] }
// and the arena knows nothing else. See wiki/designs/hunde-eventyr-profiles.md.
(function () {
  const HE = window.HE;
  HE.tasks = {};

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Three signs: the correct answer plus two distinct distractors at
  // correct + step * d, d drawn from ±1..±reach, never below `min` (so a
  // small answer pushes both distractors upward). Shuffled.
  HE.tasks.signsAround = function (correct, o) {
    const step = o.step || 1;
    const reach = o.reach || 2;
    const min = o.min === undefined ? 1 : o.min;
    const cands = [];
    for (let d = -reach; d <= reach; d++) {
      if (d !== 0 && correct + step * d >= min) cands.push(correct + step * d);
    }
    for (let d = reach + 1; cands.length < 2; d++) cands.push(correct + step * d);
    shuffle(cands);
    return shuffle([
      { value: correct, correct: true },
      { value: cands[0], correct: false },
      { value: cands[1], correct: false },
    ]);
  };

  // The task set for the active save (or ?age=N to force one).
  HE.activeTasks = function () {
    const forced = Number(HE.params && HE.params.get("age"));
    return HE.tasks[forced] || HE.tasks[HE.save.profile.age] || HE.tasks[10];
  };
})();
