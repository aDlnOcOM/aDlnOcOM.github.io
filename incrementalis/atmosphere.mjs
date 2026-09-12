export const SKY_PRESETS = {
  structure: { name: '', top: [.11, .16, .21], horizon: [.52, .56, .57], fog: [.40, .46, .49], sun: [1.13, 1.00, .80], ambient: [.47, .51, .55], direction: [-.57, .67, .36], night: 0 },
  dawn: { name: 'Рассвет', top: [.17, .28, .43], horizon: [.88, .53, .40], fog: [.40, .39, .34], sun: [1.3, .77, .43], ambient: [.40, .40, .43], direction: [-.85, .22, -.38], night: 0 },
  day: { name: 'День', top: [.075, .29, .52], horizon: [.65, .79, .78], fog: [.43, .59, .58], sun: [1.12, 1.06, .86], ambient: [.40, .47, .45], direction: [-.48, .82, -.3], night: 0 },
  sunset: { name: 'Закат', top: [.14, .12, .31], horizon: [.98, .40, .20], fog: [.38, .29, .34], sun: [1.25, .57, .27], ambient: [.39, .30, .42], direction: [.77, .16, -.62], night: .12 },
  night: { name: 'Ночь', top: [.012, .023, .072], horizon: [.09, .16, .23], fog: [.045, .095, .13], sun: [.35, .48, .69], ambient: [.20, .28, .39], direction: [.32, .61, -.72], night: 1 },
};

export function blendSky(current, preset, dt, instant = false) {
  const target = SKY_PRESETS[preset] || SKY_PRESETS.day, t = instant || !current ? 1 : 1 - Math.exp(-Math.max(0, dt) * 1.4);
  const result = {};
  for (const key of ['top', 'horizon', 'fog', 'sun', 'ambient', 'direction']) result[key] = target[key].map((v, i) => (current?.[key][i] ?? v) + (v - (current?.[key][i] ?? v)) * t);
  result.night = (current?.night ?? target.night) + (target.night - (current?.night ?? target.night)) * t;
  return result;
}

export function fadeStep(opacity, target, dt, reduced = false) {
  return reduced ? target : opacity + Math.sign(target - opacity) * Math.min(Math.abs(target - opacity), Math.max(0, dt) / .85);
}
