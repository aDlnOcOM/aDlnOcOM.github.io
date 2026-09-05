(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});

  const manifest = {
    module_frame: "assets/modules/frame.png",
    module_core: "assets/modules/core.png",
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
    meteor_iron: "assets/ores/meteor_iron.png",
    meteor_chondrite: "assets/ores/meteor_chondrite.png",
    meteor_troilite: "assets/ores/meteor_troilite.png",
    meteor_carbon: "assets/ores/meteor_carbon.png",
    meteor_pallasite: "assets/ores/meteor_pallasite.png",
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
    particle_exhaust: "assets/particles/exhaust.png",
    exhaust_thruster: "assets/particles/exhaust_thruster.png",
    exhaust_booster: "assets/particles/exhaust_booster.png",
    star_small: "assets/ui/star_small.png",
    star_bright: "assets/ui/star_bright.png",
    ui_arrow: "assets/ui/arrow.png",
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
