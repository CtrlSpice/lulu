// GLSL for the live watercolour. Four kinds of pass:
//   1. GEOMETRY  draws the 3D axolotl and records, per pixel, where on the animal that pixel is (not a colour).
//   2. PAINT     turns "where on the animal" into how much of each ink lies there: pink body wash, wine markings.
//   3. BLUR      spreads the paint a little (a tight blur and a wide blur), as wet paint spreads into paper.
//   4. PAPER     lets the paint bleed and feather at its edges, dry darker at the rim, settle into the paper's
//                grain, and finally turns ink amounts into colour with the measured ink tables.

const HEAD = `#version 300 es
precision highp float;
`;

const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p, int oct) { float v = 0.0, a = 0.5, n = 0.0; for (int i = 0; i < 5; i++) { if (i >= oct) break; v += a * vnoise(p); n += a; p *= 2.0; a *= 0.5; } return v / n; }
float bump(float c, float w, float x) { float t = (x - c) / w; return exp(-t * t); }
`;

export const GEOMETRY_VS = HEAD + `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aData; // s, u, v, part
layout(location = 2) in float aLat;
uniform vec2 uCentre, uSize;
uniform float uSpin, uTilt, uZoom;
out vec4 vData; out float vLat; out float vDepth;
void main() {
  // spin about the vertical axis through the picture's centre, then tilt the view from straight above (0) to the side
  vec3 p = aPos - vec3(uCentre, 0.0);
  vec2 r = vec2(cos(uSpin) * p.x - sin(uSpin) * p.y, sin(uSpin) * p.x + cos(uSpin) * p.y);
  vec2 screen = uCentre + vec2(r.x, r.y * cos(uTilt) - p.z * sin(uTilt)) * uZoom;
  float depth = r.y * sin(uTilt) + p.z * cos(uTilt); // larger = nearer to us
  gl_Position = vec4(screen.x / uSize.x * 2.0 - 1.0, 1.0 - screen.y / uSize.y * 2.0, -depth / 1500.0, 1.0);
  vData = aData; vLat = aLat; vDepth = depth;
}`;

export const GEOMETRY_FS = HEAD + `
in vec4 vData; in float vLat; in float vDepth;
layout(location = 0) out vec4 where0; // s, u, v, part
layout(location = 1) out vec4 where1; // lat, depth, rate
void main() {
  int part = int(vData.w + 0.5);
  // fin: how fast "height up the fin" changes from one pixel to the next (its inverse is the fin's height on screen)
  float rate = part == 2 ? fwidth(vData.z) : 0.0;
  where0 = vData; where1 = vec4(vLat, vDepth, rate, 1.0);
}`;

/** One big triangle covering the screen. */
export const SCREEN_VS = HEAD + `
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

export const PAINT_FS = HEAD + NOISE + `
uniform sampler2D uWhere0, uWhere1;
uniform float uTime, uFlow, uLength;
uniform vec4 uGillRoot[6]; // where on the body each gill frond grows from: along, across, up, px across
out vec4 paint; // r = pink body ink, g = wine ink, b = 1 on an eye, a = 1 where there is animal
float backStrength(float s) { return 0.2 + 0.8 * smoothstep(0.03, 0.12, s) * (1.0 - 0.5 * smoothstep(0.55, 0.85, s)) - 0.3 * smoothstep(0.88, 1.0, s); }
// the paint drifts and swirls slowly in the animal's own coordinates (px along, px across)
vec2 flowed(vec2 P) {
  vec2 swirl = vec2(fbm(P / 90.0 + vec2(0.0, uTime * 0.05), 3), fbm(P / 90.0 + vec2(31.0, -uTime * 0.04), 3)) - 0.5;
  return P + uFlow * (40.0 * swirl + vec2(uTime * 3.0, 0.0));
}
// Costal grooves: 13 a side (counted on living axolotls: 13.3 +/- 1.0, Scientific Reports 2024, doi 10.1038/s41598-024-62264-z),
// from just behind the front legs to just ahead of the back legs.
const float GROOVES = 13.0, GROOVE_FIRST = 0.258, GROOVE_STEP = (0.502 - 0.258) / 12.0;
// her skin at a place on the body: x = pink wash, y = wine (the soft wash down the back plus the blotches).
// s: along the body; across: -1 to 1; c: how far round from the centre line of the back (0 on it, 1 at the flank, up
// to 2 under the belly); Pf: that place in px, after the paint's drift
vec2 skin(float s, float across, float c, vec2 Pf) {
  float base = 0.22 + 0.07 * across * across + 0.06 * bump(0.25, 0.2, s);
  float mid = backStrength(s) * (1.0 - smoothstep(0.45, 1.15, c)) * 0.5 * (0.75 + 0.5 * fbm(Pf / 45.0, 3)); // the band of mid-tone markings: wide across the back, then an ombre fade down each side, gone by the widest point so the lower half stays pink
  float blot = smoothstep(0.42, 0.62, fbm(Pf / 26.0 + vec2(5.0, 0.0), 4));
  float dark = smoothstep(0.06, 0.13, s) * (1.0 - smoothstep(0.80, 0.95, s)) * bump(0.0, 0.36, c) * (0.4 + 1.1 * blot) * 1.25;
  // costal grooves: the fine creases down each flank between the front and back legs, one per rib. They belong to the
  // body, so they do not drift with the paint. Each leans back a little as it goes down the side, and they fade out
  // towards the centre of the back and under the belly. The grooves nearest the legs are the faintest.
  float groove = (s - 0.004 * (c - 0.9) - GROOVE_FIRST) / GROOVE_STEP;
  float crease = 1.0 - smoothstep(0.5, 1.9, abs(fract(groove + 0.5) - 0.5) * GROOVE_STEP * uLength); // 1 on a crease, fading over about 2 px
  float fromMiddle = abs(floor(groove + 0.5) - 0.5 * (GROOVES - 1.0)) / (0.5 * (GROOVES - 1.0)); // 0 for the middle groove, 1 for the first and last
  float grooves = crease * step(-0.5, groove) * step(groove, GROOVES - 0.5) * smoothstep(0.3, 0.6, c) * (1.0 - smoothstep(1.35, 1.75, c)) * (1.0 - 0.7 * fromMiddle * fromMiddle);
  return vec2(base, mid + dark + 0.17 * grooves);
}
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 w0 = texelFetch(uWhere0, px, 0), w1 = texelFetch(uWhere1, px, 0);
  float s = w0.x, u = w0.y, v = w0.z, lat = w1.x; int part = int(w0.w + 0.5);
  paint = vec4(0.0);
  if (part == 0) return;
  if (part == 1 || part == 4) {
    // body, and the eyes (the skin's paint continues under an eye; the bead itself is added on the paper)
    paint = vec4(skin(s, u, v >= 0.0 ? abs(u) : 2.0 - abs(u), flowed(vec2(s * uLength, lat))), part == 4 ? 1.0 : 0.0, 1.0);
  } else if (part == 2) {
    // fin: body-coloured and fleshy where it joins the body, thinning to a pale see-through membrane with a fine dark
    // line along its free edge
    vec2 Pf = flowed(vec2(s * uLength, lat)), here = skin(s, u, abs(u), Pf);
    float h = abs(v) - 1.0, tall = 1.0 / max(w1.z, 1e-3); // h: 0 at the base, 1 at the free edge; tall: the fin's height on screen in px
    float thin = smoothstep(0.02, 0.3, h);
    float margin = (1.0 - smoothstep(1.0, 2.6, (1.0 - h) * tall)) * mix(0.45, 1.0, smoothstep(5.0, 14.0, tall));
    float vein = fbm(vec2(Pf.x / 16.0, h * 2.5 + 9.0), 3);
    paint = vec4(mix(here.x, 0.13 - 0.05 * h, thin), mix(0.8 * here.y, 0.02 + 0.12 * vein * (1.0 - h), thin) + 0.75 * margin, 0.0, 1.0);
  } else if (part == 3) {
    paint = vec4(0.0, 0.95 + 0.35 * (0.5 - 0.5 * v), 0.0, 1.0); // leg: a dark stick, a little darker underneath
  } else if (part == 5) {
    // gill frond: the head's skin carried outward. It is painted as the skin at the place it grows from, moving
    // steadily away from the back, so there is no break in colour where it leaves the body. Only its form is added:
    // a little darker underneath, and a fine wine outline wherever the frond's edge is seen against something else
    // (the paper, the body, a leg, another frond). The outline fades out at the base, where frond and head are one skin.
    vec4 root = uGillRoot[int(lat + 0.5)];
    float away = smoothstep(0.1, 0.35, s), outline = 0.0;
    for (int i = 0; i < 12; i++) {
      ivec2 o = i < 4 ? ivec2(i < 2 ? 1 : 0, i < 2 ? 0 : 1) * (i % 2 == 0 ? 1 : -1) : i < 8 ? ivec2(i < 6 ? 1 : -1, i % 2 == 0 ? 1 : -1) : ivec2(i < 10 ? 2 : 0, i < 10 ? 0 : 2) * (i % 2 == 0 ? 1 : -1);
      ivec2 q = clamp(px + o, ivec2(0), textureSize(uWhere0, 0) - 1);
      bool other = int(texelFetch(uWhere0, q, 0).w + 0.5) != 5 || abs(texelFetch(uWhere1, q, 0).x - lat) > 0.5;
      if (other) outline = max(outline, i < 4 ? 1.0 : i < 8 ? 0.8 : 0.55);
    }
    outline *= smoothstep(0.05, 0.2, s);
    vec2 here = skin(root.x, root.y, abs(root.y) + 0.5 * s, flowed(vec2(root.x * uLength + 90.0 * s, root.w + sign(root.w) * 70.0 * s)));
    paint = vec4(here.x, here.y + away * (0.14 * (0.5 - 0.5 * v) + 0.05 * s) + 0.8 * outline, 0.0, 1.0);
  } else {
    // the gill under the frond: a wine ground, the filaments drawn on it as fine light lines, and a light band around
    // its outer edge; the wine drifts along it
    float drift = fbm(vec2(u * 0.3 + lat * 7.0, v * 2.0 - uTime * 0.1 * uFlow), 3);
    float line = 0.85 * (1.0 - smoothstep(0.08, 0.3, abs(fract(u) - 0.5) * 2.0)), band = smoothstep(0.9, 0.95, v);
    float light = max(line, band);
    paint = vec4(mix(0.06, 0.14, light), mix(1.15 * (0.8 + 0.4 * drift), 0.02, light), 0.0, 1.0);
  }
}`;

export const BLUR_FS = HEAD + `
uniform sampler2D uTex; uniform ivec2 uStep; uniform int uRadius;
out vec4 o;
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy), size = textureSize(uTex, 0); vec4 sum = vec4(0.0); float wsum = 0.0; float sigma = max(0.5, float(uRadius) * 0.5);
  for (int i = -24; i <= 24; i++) { if (i < -uRadius || i > uRadius) continue; float w = exp(-float(i * i) / (2.0 * sigma * sigma)); sum += w * texelFetch(uTex, clamp(px + uStep * i, ivec2(0), size - 1), 0); wsum += w; }
  o = sum / wsum;
}`;

export const PAPER_FS = HEAD + NOISE + `
uniform sampler2D uPaint, uCore, uWide, uInk;
uniform vec3 uPaper; uniform vec2 uSize; uniform float uTime, uFlow, uZoom;
uniform vec2 uEye[2];
out vec4 colour;
// one ink layer drying into the paper: it feathers outward along the fibres, dries darker at its rim, clouds, and
// settles into the paper's tooth
float dry(float core, float wide, vec2 p, float feather, float cloud, float ring, float grain, float fibre, float tooth, float shimmer) {
  float outside = max(0.0, 1.0 - core / (wide + 1e-4));
  float streak = fbm(p * vec2(0.35, 0.04) + 50.0, 3);
  float fringe = wide * (1.0 - feather + feather * (0.35 + 1.1 * streak + 0.5 * fibre)) * 1.05;
  float v = core + max(0.0, min(wide * 1.4, fringe) - core) * outside;
  v *= 1.0 - cloud + cloud * 2.0 * (0.6 * fbm(p / 60.0 + vec2(13.0 + shimmer, 0.0), 4) + 0.4 * fbm(p / 14.0 - vec2(0.0, shimmer), 3));
  v += ring * max(0.0, core - wide) * 2.5;
  return v * (1.0 + grain * (tooth - 0.5) * 2.0);
}
vec3 ink(float amount, int row) { float a = 1.0 - exp(-1.6 * max(0.0, amount)); return texelFetch(uInk, ivec2(int(a * 1024.0 + 0.5), row), 0).rgb; }
vec3 toSrgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy); vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y); // p: picture px, y down
  vec4 raw = texelFetch(uPaint, px, 0), core = texelFetch(uCore, px, 0), wide = texelFetch(uWide, px, 0);
  float fibre = fbm(p / 3.0 + 3.0, 2), tooth = 0.35 * fbm(p / 4.0 + vec2(7.0, 0.0), 2) + 0.65 * fbm(p / 14.0 + vec2(0.0, 3.0), 3), toothFine = 0.55 * fbm(p / 3.2 + vec2(7.0, 0.0), 2) + 0.45 * fbm(p / 9.0 + vec2(0.0, 3.0), 2);
  float shimmer = uTime * 0.03 * uFlow;
  float body = dry(core.r, wide.r, p, 0.6, 0.45, 0.6, 0.15, fibre, tooth, shimmer);
  float wine = dry(core.g, wide.g, p, 0.7, 0.45, 0.5, 0.45, fibre, toothFine, shimmer * 1.3);
  // eyes: crisp dark beads laid on top of the dried paint (so no ink bleeds out around them), each with a small
  // shine up and to the left and reflected light low in the bead
  float bead = smoothstep(0.3, 0.62, core.b);
  if (bead > 0.0) {
    float eye = 3.6;
    for (int i = 0; i < 2; i++) {
      vec2 rel = (p - uEye[i]) / (4.8 * uZoom);
      if (length(rel) < 1.3) { eye *= 1.0 - 0.62 * smoothstep(0.1, 0.55, rel.y) * smoothstep(0.9, 0.55, length(rel)); eye *= mix(0.05, 1.0, smoothstep(0.2, 0.33, length(rel - vec2(-0.33, -0.4)))); }
    }
    wine = mix(wine, eye, bead);
  }
  vec3 light = uPaper * ink(body, 0) * ink(wine, 1);
  colour = vec4(toSrgb(light) * (0.992 + 0.016 * hash(p * vec2(3.0, 7.0))), 1.0);
}`;
