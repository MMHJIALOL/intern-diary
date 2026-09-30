// After render.js: per-scene MP4s, last-frame PNG per scene, single-frame pop scan.
const { spawnSync } = require('child_process');
const fs = require('fs');
const ffmpeg = require('ffmpeg-static');
const { open } = require('./still.js');

const SCENES = [['1_problem', 0, 2.5], ['2_lookup', 2.5, 5], ['3_match', 5, 9.5], ['4_tally', 9.5, 12], ['5_report', 12, 15]];
const FPS = 60, ENC = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

function ff(args) {
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stderr;
}

(async () => {
  fs.mkdirSync('out/scenes', { recursive: true });
  for (const [n, a, b] of SCENES)
    ff(['-y', '-loglevel', 'error', '-i', 'out/film.mp4', '-ss', String(a), '-to', String(b), ...ENC, `out/scenes/${n}.mp4`]);

  const { srv, browser, page } = await open();
  for (const [n, , b] of SCENES) {
    await page.evaluate(t => seek(t), b - 1 / FPS);
    await page.locator('#stage').screenshot({ path: `out/scenes/${n}_last.png` });
  }
  await browser.close(); srv.close();

  // mean abs luma difference between consecutive frames
  const log = ff(['-hide_banner', '-i', 'out/film.mp4', '-vf',
    'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-']);
  const d = [...log.matchAll(/lavfi\.signalstats\.YAVG=([\d.eE+-]+)/g)].map(m => +m[1]);
  fs.writeFileSync('out/popscan.txt', d.map((v, i) => `${i + 1} ${((i + 1) / FPS).toFixed(3)} ${v.toFixed(3)}`).join('\n'));
  const pops = [];
  for (let i = 1; i < d.length - 1; i++)
    if (d[i] > 0.2 && d[i] > 3 * Math.max(d[i - 1], d[i + 1])) pops.push(`frame ${i + 1} (t=${((i + 1) / FPS).toFixed(3)}s) diff ${d[i].toFixed(2)} vs ${d[i - 1].toFixed(2)}/${d[i + 1].toFixed(2)}`);
  console.log(`scenes + PNGs written. ${d.length} frame diffs, ${pops.length} single-frame pops`);
  pops.forEach(p => console.log('  ' + p));
})();
