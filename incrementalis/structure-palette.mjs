/** A continuous material age avoids palette seams at the integer era boundaries. */
export function structurePalette(plan) {
  const stages = [
    [[.49,.44,.35],[.69,.63,.51],[.25,.22,.17],[.78,.53,.26]],
    [[.43,.41,.36],[.60,.57,.48],[.20,.21,.20],[.76,.48,.22]],
    [[.35,.36,.35],[.51,.53,.50],[.12,.14,.15],[.76,.37,.15]],
    [[.34,.36,.36],[.61,.63,.61],[.10,.12,.13],[.85,.51,.20]],
    [[.42,.45,.46],[.67,.71,.73],[.13,.17,.20],[.41,.68,.77]],
    [[.32,.38,.41],[.54,.65,.69],[.10,.14,.18],[.46,.74,.78]],
  ];
  const value = Math.max(0, Math.min(5, plan.epoch)), index = Math.floor(value), t = value - index, blend = t*t*(3-2*t);
  const colors = stages[index].map((c,i) => c.map((v,k) => v + (stages[Math.min(5,index+1)][i][k]-v)*blend));
  const variation = .94 + plan.hash * .12;
  return { stone: colors[0].map(v=>v*variation), pale: colors[1], metal: colors[2], dark: [.065,.075,.085], light: colors[3] };
}
