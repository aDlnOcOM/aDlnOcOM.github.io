(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});

  const manifest = {
    module_frame: "assets/modules/frame.png",
    module_core: "assets/modules/core.png",
    module_computer: "assets/modules/shield.png",
    module_laser: "assets/modules/laser.png",
    module_thruster: "assets/modules/thruster.png",
    module_booster: "assets/modules/booster.png",
    module_hull: "assets/modules/hull.png",
    module_beam: "assets/modules/beam.png",
    module_cargo: "assets/modules/cargo.png",
    module_drill: "assets/modules/drill.png",
    module_rtg: "assets/modules/rtg.png",
    module_shield: "assets/modules/shield.png",
    station_dock: "assets/station/dock.png",
    station_command: "assets/station/command.png",
    station_service: "assets/station/service.png",
    station_rtg: "assets/station/rtg.png",
    station_beam: "assets/station/beam.png",
    meteor_iron: "assets/ores/meteor_iron.png?v=20260907-02",
    meteor_chondrite: "assets/ores/meteor_chondrite.png?v=20260907-02",
    meteor_troilite: "assets/ores/meteor_troilite.png?v=20260907-02",
    meteor_carbon: "assets/ores/meteor_carbon.png?v=20260907-02",
    meteor_pallasite: "assets/ores/meteor_pallasite.png?v=20260907-02",
    ore_feNi: "assets/ores/ore_iron.png",
    ore_cobalt: "assets/ores/ore_cobalt.png",
    ore_silicates: "assets/ores/ore_silicate.png",
    ore_olivine: "assets/ores/ore_olivine.png",
    ore_sulfur: "assets/ores/ore_sulfur.png",
    ore_carbon: "assets/ores/ore_carbon.png",
    ore_ice: "assets/ores/ore_ice.png",
    ore_organics: "assets/ores/ore_organics.png",
    ore_platinum: "assets/ores/ore_platinum.png",
    ore_rareEarths: "assets/ores/ore_rare.png",
    particle_spark: "assets/particles/spark.png",
    particle_debris: "assets/particles/debris.png",
    exhaust_thruster: "assets/particles/exhaust_thruster.png",
    exhaust_booster: "assets/particles/exhaust_booster.png",
    star_small: "assets/ui/star_small.png",
    star_bright: "assets/ui/star_bright.png",
    ui_arrow: "assets/ui/arrow.png",
  };

  function loadSave() {
    try {
      const save = JSON.parse(localStorage.getItem("voidspace-save-v1"));
      return save && typeof save === "object" && !Array.isArray(save) ? save : {};
    } catch (_error) {
      return {};
    }
  }

  window.addEventListener("DOMContentLoaded", async () => {
    for (const [type, definition] of Object.entries(VS.ModuleSystem.MODULES)) manifest[`module_${type}`] = definition.sprite;
    try {
      const response = await fetch("data/enemies.json", { cache: "no-cache" });
      if (response.ok) {
        const blueprints = await response.json();
        if (Array.isArray(blueprints)) VS.Content.PACKAGED_ENEMIES = blueprints.slice(0, 24).flatMap((blueprint) => {
          try { return [VS.Content.validateBlueprint(blueprint)]; } catch { return []; }
        });
      }
    } catch { /* Local file mode can still use the built-in and browser-saved enemies. */ }
    const canvas = document.getElementById("game");
    try {
      Object.assign(manifest, VS.Visuals.MANIFEST);
      const images = VS.Visuals.prepare(await VS.Utils.loadImages(manifest));
      window.voidspaceGame = new VS.Game(canvas, images, loadSave());
      const preview = document.getElementById("fleet-preview");
      if (preview) {
        const ctx = preview.getContext("2d");
        ctx.translate(260, 170); ctx.rotate(-Math.PI / 5); ctx.scale(3.2, 3.2);
        for (const m of VS.Content.CLASSES.miner.modules) VS.Visuals.drawCell(ctx, images, m);
      }
    } catch (error) {
      document.getElementById("loading").textContent = "Не удалось запустить игру. Перезагрузите страницу; сохранение не удалено.";
      console.error("VOIDSPACE startup failed", error);
      return;
    }
    const loading = document.getElementById("loading");
    loading.classList.add("done");
    window.setTimeout(() => loading.remove(), 300);
  });
})();
