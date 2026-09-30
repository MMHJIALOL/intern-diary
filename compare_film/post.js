// After render.js: per-scene MP4s, last-frame PNG per scene, single-frame pop scan.
const { spawnSync } = require('child_process');
const fs = require('fs');
const ffmpeg = require('ffmpeg-static');
const { open } = require('./still.js');

const SCENES = [['1_problem', 0, 3], ['2_keyvalue', 3, 6], ['3_shards', 6, 10], ['4_parse_sort', 10, 13],
                ['5_merge_join', 13, 20], ['6_outputs', 20, 23], ['7_plot', 23, 27], ['8_result', 27, 30]];
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
  const d = [...log.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map(m => +m[1]);
  fs.writeFileSync('out/popscan.txt', d.map((v, i) => `${i + 1} ${((i + 1) / FPS).toFixed(3)} ${v.toFixed(3)}`).join('\n'));
  const pops = [];
  for (let i = 1; i < d.length - 1; i++)
    if (d[i] > 0.2 && d[i] > 3 * Math.max(d[i - 1], d[i + 1])) pops.push(`frame ${i + 1} (t=${((i + 1) / FPS).toFixed(3)}s) diff ${d[i].toFixed(2)} vs ${d[i - 1].toFixed(2)}/${d[i + 1].toFixed(2)}`);
  console.log(`scenes + PNGs written. ${d.length} frame diffs, ${pops.length} single-frame pops`);
  pops.forEach(p => console.log('  ' + p));
})();
