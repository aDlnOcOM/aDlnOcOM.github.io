(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});

  const ORES = {
    feNi: { name: "Железо-никель", value: 6, color: "#b9c2c7", sprite: "assets/ores/ore_iron.png" },
    cobalt: { name: "Кобальт", value: 12, color: "#6fa5ff", sprite: "assets/ores/ore_cobalt.png" },
    silicates: { name: "Силикаты", value: 4, color: "#b7a17f", sprite: "assets/ores/ore_silicate.png" },
    olivine: { name: "Оливин", value: 9, color: "#a9d65f", sprite: "assets/ores/ore_olivine.png" },
    sulfur: { name: "Сера", value: 8, color: "#f2cb55", sprite: "assets/ores/ore_sulfur.png" },
    carbon: { name: "Углерод", value: 7, color: "#7e8b93", sprite: "assets/ores/ore_carbon.png" },
    ice: { name: "Водяной лёд", value: 11, color: "#8fe8ff", sprite: "assets/ores/ore_ice.png" },
    organics: { name: "Органика", value: 18, color: "#ce6dca", sprite: "assets/ores/ore_organics.png" },
    platinum: { name: "Платиновая группа", value: 32, color: "#f6f0e0", sprite: "assets/ores/ore_platinum.png" },
    rareEarths: { name: "Редкоземы", value: 26, color: "#ff8e6e", sprite: "assets/ores/ore_rare.png" },
  };

  class Inventory {
    constructor(contents = {}) {
      this.contents = {};
      for (const key of Object.keys(ORES)) this.contents[key] = Number(contents[key]) || 0;
    }

    get used() {
      return Object.values(this.contents).reduce((sum, amount) => sum + amount, 0);
    }

    add(ore, amount, capacity) {
      const accepted = Math.max(0, Math.min(amount, capacity - this.used));
      this.contents[ore] = (this.contents[ore] || 0) + accepted;
      return accepted;
    }

    clear() {
      for (const key of Object.keys(this.contents)) this.contents[key] = 0;
    }

    saleValue() {
      return Object.entries(this.contents).reduce((sum, [ore, amount]) => sum + amount * ORES[ore].value, 0);
    }

    rows() {
      return Object.entries(this.contents)
        .filter(([, amount]) => amount > 0)
        .sort((a, b) => ORES[b[0]].value - ORES[a[0]].value);
    }

    serialize() {
      return { ...this.contents };
    }
  }

  VS.Inventory = Inventory;
  VS.ORES = ORES;
})();
