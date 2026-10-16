// Scene registry. Scenes are { enter(payload), update(), draw(ctx), exit()? }.
(function () {
  const HE = (window.HE = window.HE || {});
  const scenes = {};
  let current = null;

  HE.registerScene = (name, scene) => {
    scenes[name] = scene;
  };
  HE.go = (name, payload) => {
    if (!scenes[name]) throw new Error("unknown scene: " + name);
    if (current && current.exit) current.exit();
    current = scenes[name];
    current.enter(payload || {});
  };
  HE.current = () => current;
})();
