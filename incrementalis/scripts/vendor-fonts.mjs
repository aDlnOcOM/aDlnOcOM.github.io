// Copies the fonts already used by the game from their upstream distributions.
// Run only when intentionally refreshing the checked-in font assets.
import { mkdir, writeFile } from 'node:fs/promises';

const directory = new URL('../assets/fonts/', import.meta.url);
const downloads = [
  ['cormorant-garamond-regular-cyrillic.woff2', 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYrXtKgS4.woff2'],
  ['cormorant-garamond-regular-latin.woff2', 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtK.woff2'],
  ['cormorant-garamond-italic-cyrillic.woff2', 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtMmSq17w.woff2'],
  ['cormorant-garamond-italic-latin.woff2', 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtImSo.woff2'],
  ['manrope-cyrillic.woff2', 'https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggOxSuXd.woff2'],
  ['manrope-latin.woff2', 'https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2'],
  ['CormorantGaramond-OFL.txt', 'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt'],
  ['Manrope-OFL.txt', 'https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt'],
];

await mkdir(directory, { recursive: true });
const files = await Promise.all(downloads.map(async ([name, url]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (name.endsWith('.woff2') && data.toString('ascii', 0, 4) !== 'wOF2') throw new Error(`${name}: invalid WOFF2 file`);
  if (name.endsWith('.txt') && !data.toString('utf8').includes('SIL OPEN FONT LICENSE')) throw new Error(`${name}: invalid license`);
  return { name, data };
}));
for (const { name, data } of files) {
  await writeFile(new URL(name, directory), data);
  console.info(`${name}: ${data.length} bytes`);
}
