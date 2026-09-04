(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});

  const manifest = {
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
    window.voidspaceGame = new VS.Game(canvas, images, loadSave());
    const loading = document.getElementById("loading");
    loading.classList.add("done");
    window.setTimeout(() => loading.remove(), 300);
  });
})();
