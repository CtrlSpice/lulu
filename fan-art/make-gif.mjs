// Records scene.html as an animated GIF by running its own script with a virtual clock and a pixel canvas.
// node fan-art/make-gif.mjs [out.gif] [scale] [hold ms after Clawd's last step]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const [out = 'fan-art/lulu-and-clawd.gif', scaleArg = '4', holdArg = '2500'] = process.argv.slice(2);
const OUT_SCALE = +scaleArg, HOLD = +holdArg;
const dir = path.resolve('fan-art');
const html = fs.readFileSync(path.join(dir, 'scene.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

// virtual timers
let now = 0, queue = [], nextId = 1;
const setTimeout = (fn, ms) => { const id = nextId++; queue.push({ id, at: now + ms, fn }); return id; };
const clearTimeout = id => { queue = queue.filter(t => t.id !== id); };

// a canvas whose fillRect paints scene pixels (the page draws at SCALE canvas pixels per scene pixel)
let W = 0, H = 0, pageScale = 1, pixels = null, fill = '#000000';
const ctx = {
  set fillStyle(c) { fill = c; }, get fillStyle() { return fill; },
  fillRect(x, y, w, h) {
    for (let py = Math.round(y / pageScale); py < Math.round((y + h) / pageScale); py++)
      for (let px = Math.round(x / pageScale); px < Math.round((x + w) / pageScale); px++)
        if (px >= 0 && py >= 0 && px < W && py < H) pixels[py * W + px] = fill;
  },
};
const canvas = { getContext: () => ctx, set width(v) { canvas._w = v; }, get width() { return canvas._w; }, set height(v) { canvas._h = v; }, get height() { return canvas._h; } };
const elements = { scene: canvas, light: { checked: false }, play: { textContent: 'Play' } };
const sandbox = {
  setTimeout, clearTimeout, Math, Number, Object, Array, Set, Promise, JSON, Infinity, console,
  document: { getElementById: id => elements[id] },
  fetch: f => Promise.resolve({ text: () => Promise.resolve(fs.readFileSync(path.join(dir, f), 'utf8')) }),
};
vm.runInNewContext(script + '\nthis.__dims = { W, H, SCALE, clawdTrack };', sandbox);
await new Promise(r => globalThis.setTimeout(r, 50));   // let the page's file loading finish
({ W, H } = sandbox.__dims); pageScale = sandbox.__dims.SCALE; pixels = Array(W * H).fill('#232136');

// press Play, then run the clock, keeping a frame whenever the picture changes
elements.play.onclick({ target: elements.play });
const frames = [];
const snap = () => { const key = pixels.join(','); if (!frames.length || frames.at(-1).key !== key) frames.push({ at: now, key, px: [...pixels] }); };
snap();
// the scene is over when Clawd reaches his last step (the one that lasts forever). For a smooth loop, keep going
// until Lulu looks exactly as she did at the start (her 32 columns), at least HOLD ms later, and cut there.
const clawdEnd = sandbox.__dims.clawdTrack.reduce((t, step) => t + (step.ms === Infinity ? 0 : step.ms), 0);
const luluPart = px => Array.from({ length: H }, (_, y) => px.slice(y * W, y * W + 32).join(',')).join('|');
const startLulu = luluPart(frames[0].px);
let endAt = null;
while (queue.length && endAt === null) {
  queue.sort((x, y) => x.at - y.at);
  const t = queue[0].at;
  if (t > clawdEnd + 60000) break;
  now = t;
  while (queue.length && queue[0].at === t) { const job = queue.shift(); job.fn(); }
  if (now >= clawdEnd + HOLD && luluPart(pixels) === startLulu) endAt = now;   // loop point: this frame is not kept
  else snap();
}
endAt ??= now;

// GIF encoding (global palette, variable frame delays)
const colours = [...new Set(frames.flatMap(f => f.px))];
const bits = Math.max(2, Math.ceil(Math.log2(colours.length)));
const table = Buffer.alloc((1 << bits) * 3);
colours.forEach((c, i) => table.set([1, 3, 5].map(o => parseInt(c.slice(o, o + 2), 16)), i * 3));
const GW = W * OUT_SCALE, GH = H * OUT_SCALE;
const lzw = (px, minSize) => {
  const clear = 1 << minSize, end = clear + 1, bytes = [];
  let acc = 0, accBits = 0, size = minSize + 1, next = end + 1, dict = new Map();
  const emit = code => { acc |= code << accBits; accBits += size; while (accBits >= 8) { bytes.push(acc & 255); acc >>>= 8; accBits -= 8; } };
  emit(clear);
  let prefix = px[0];
  for (let i = 1; i < px.length; i++) {
    const k = px[i], key = prefix * 4096 + k;
    if (dict.has(key)) { prefix = dict.get(key); continue; }
    emit(prefix);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
    else { emit(clear); dict = new Map(); size = minSize + 1; next = end + 1; }
    prefix = k;
  }
  emit(prefix); emit(end);
  if (accBits > 0) bytes.push(acc & 255);
  const blocks = [];
  for (let i = 0; i < bytes.length; i += 255) { const chunk = bytes.slice(i, i + 255); blocks.push(chunk.length, ...chunk); }
  return Buffer.from([minSize, ...blocks, 0]);
};
const u16 = n => [n & 255, n >> 8];
const parts = [Buffer.from('GIF89a'), Buffer.from([...u16(GW), ...u16(GH), 0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0]), table,
  Buffer.from([0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0])];
let kept = 0;
frames.forEach((f, i) => {
  const until = i + 1 < frames.length ? frames[i + 1].at : endAt;
  const cs = Math.max(2, Math.round((until - f.at) / 10));
  const idx = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) idx[y * GW + x] = colours.indexOf(f.px[Math.floor(y / OUT_SCALE) * W + Math.floor(x / OUT_SCALE)]);
  parts.push(Buffer.from([0x21, 0xf9, 4, 0, ...u16(cs), 0, 0]), Buffer.from([0x2c, 0, 0, 0, 0, ...u16(GW), ...u16(GH), 0]), lzw(idx, bits));
  kept++;
});
parts.push(Buffer.from([0x3b]));
fs.writeFileSync(out, Buffer.concat(parts));
console.log(out, `${GW}x${GH}`, kept, 'frames', colours.length, 'colours', `${(endAt / 1000).toFixed(1)} s`);
