(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});

  const manifest = {
    atlas_modules: "assets/atlases/modules.png",
    atlas_station: "assets/atlases/station.png",
    atlas_mining: "assets/atlases/mining.png",
    atlas_effects: "assets/atlases/effects.png",
    module_core: "assets/modules/core.svg",
    module_laser: "assets/modules/laser.svg",
    module_thruster: "assets/modules/thruster.svg",
    module_booster: "assets/modules/booster.svg",
    module_hull: "assets/modules/hull.svg",
    module_beam: "assets/modules/beam.svg",
    module_cargo: "assets/modules/cargo.svg",
    module_drill: "assets/modules/drill.svg",
    module_rtg: "assets/modules/rtg.svg",
    module_shield: "assets/modules/shield.svg",
    station_dock: "assets/station/dock.svg",
    station_command: "assets/station/command.svg",
    station_service: "assets/station/service.svg",
    station_rtg: "assets/station/rtg.svg",
    station_beam: "assets/station/beam.svg",
    meteor_iron: "assets/ores/meteor_iron.svg",
    meteor_chondrite: "assets/ores/meteor_chondrite.svg",
    meteor_troilite: "assets/ores/meteor_troilite.svg",
    meteor_carbon: "assets/ores/meteor_carbon.svg",
    meteor_pallasite: "assets/ores/meteor_pallasite.svg",
    ore_feNi: "assets/ores/ore_iron.svg",
    ore_cobalt: "assets/ores/ore_cobalt.svg",
    ore_silicates: "assets/ores/ore_silicate.svg",
    ore_olivine: "assets/ores/ore_olivine.svg",
    ore_sulfur: "assets/ores/ore_sulfur.svg",
    ore_carbon: "assets/ores/ore_carbon.svg",
    ore_ice: "assets/ores/ore_ice.svg",
    ore_organics: "assets/ores/ore_organics.svg",
    ore_platinum: "assets/ores/ore_platinum.svg",
    ore_rareEarths: "assets/ores/ore_rare.svg",
    particle_spark: "assets/particles/spark.svg",
    particle_debris: "assets/particles/debris.svg",
    particle_exhaust: "assets/particles/exhaust.svg",
    laser_beam: "assets/projectiles/laser_beam.svg",
    star_small: "assets/ui/star_small.svg",
    star_bright: "assets/ui/star_bright.svg",
    ui_arrow: "assets/ui/arrow.svg",
  };

  function extractSprite(images, atlas, columns, rows, column, row, width, height, padding) {
    return VS.Utils.extractAtlasSprite(atlas, columns, rows, column, row, width, height, padding) || images;
  }

  function applyGeneratedAtlases(images) {
    const moduleAtlas = VS.Utils.prepareAtlas(images.atlas_modules);
    const stationAtlas = VS.Utils.prepareAtlas(images.atlas_station);
    const miningAtlas = VS.Utils.prepareAtlas(images.atlas_mining);
    const effectsAtlas = VS.Utils.prepareAtlas(images.atlas_effects);

    const moduleCells = ["core", "laser", "thruster", "booster", "hull", "beam", "cargo", "drill", "rtg", "shield"];
    moduleCells.forEach((type, index) => {
      const key = `module_${type}`;
      images[key] = extractSprite(images[key], moduleAtlas, 4, 3, index % 4, Math.floor(index / 4), 64, 64, 2);
      if (images[key] instanceof HTMLCanvasElement) VS.ModuleSystem.MODULES[type].sprite = images[key].toDataURL("image/png");
    });

    const stationCells = [
      ["station_dock", 0, 0, 256, 192, 3],
      ["station_command", 1, 0, 96, 96, 2],
      ["station_service", 2, 0, 128, 104, 2],
      ["station_rtg", 0, 1, 72, 72, 2],
      ["station_beam", 1, 1, 96, 32, 1],
    ];
    stationCells.forEach(([key, column, row, width, height, padding]) => {
      images[key] = extractSprite(images[key], stationAtlas, 3, 2, column, row, width, height, padding);
    });

    const meteorCells = ["iron", "chondrite", "troilite", "carbon", "pallasite"];
    meteorCells.forEach((type, column) => {
      const key = `meteor_${type}`;
      images[key] = extractSprite(images[key], miningAtlas, 5, 3, column, 0, 96, 96, 2);
    });

    const oreCells = ["feNi", "cobalt", "silicates", "olivine", "sulfur", "carbon", "ice", "organics", "platinum", "rareEarths"];
    oreCells.forEach((ore, index) => {
      const key = `ore_${ore}`;
      images[key] = extractSprite(images[key], miningAtlas, 5, 3, index % 5, 1 + Math.floor(index / 5), 32, 32, 1);
      if (images[key] instanceof HTMLCanvasElement) VS.ORES[ore].sprite = images[key].toDataURL("image/png");
    });

    const effectCells = [
      ["particle_spark", 0, 0, 32, 32, 1],
      ["particle_debris", 1, 0, 32, 32, 1],
      ["particle_exhaust", 2, 0, 48, 32, 1],
      ["laser_beam", 3, 0, 128, 16, 1],
      ["ui_credit", 0, 1, 32, 32, 1],
      ["ui_arrow", 1, 1, 32, 32, 1],
      ["star_small", 2, 1, 8, 8, 1],
      ["star_bright", 3, 1, 12, 12, 1],
    ];
    effectCells.forEach(([key, column, row, width, height, padding]) => {
      images[key] = extractSprite(images[key], effectsAtlas, 4, 2, column, row, width, height, padding);
    });

    const creditIcon = document.querySelector(".resource-card strong img");
    if (creditIcon && images.ui_credit instanceof HTMLCanvasElement) creditIcon.src = images.ui_credit.toDataURL("image/png");
  }

  function loadSave() {
    try {
      return JSON.parse(localStorage.getItem("voidspace-save-v1")) || {};
    } catch (_error) {
      return {};
    }
  }

  window.addEventListener("DOMContentLoaded", async () => {
    const canvas = document.getElementById("game");
    const images = await VS.Utils.loadImages(manifest);
    applyGeneratedAtlases(images);
    window.voidspaceGame = new VS.Game(canvas, images, loadSave());
    const loading = document.getElementById("loading");
    loading.classList.add("done");
    window.setTimeout(() => loading.remove(), 300);
  });
})();
