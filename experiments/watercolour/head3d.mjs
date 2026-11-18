// A 3D axolotl head in units of the eye spacing, from a top-down photo of a real axolotl (outline from above) and the Dumeril side view
// (top and throat profiles). x: forward from the eye line, a: sideways (+ towards the far eye), z: up from eye level.
const lerpTable = tbl => x => { if (x >= tbl[0][0]) return tbl[0][1]; for (let i = 1; i < tbl.length; i++) if (x >= tbl[i][0]) { const [x0, y0] = tbl[i - 1], [x1, y1] = tbl[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return tbl[tbl.length - 1][1]; };
export const TIP = 0.55, BACK = -1.85;
// half width seen from above (top-down photo), forward x descending
export const halfW = lerpTable([[0.55, 0], [0.535, 0.22], [0.5, 0.4], [0.44, 0.53], [0.36, 0.64], [0.25, 0.75], [0.12, 0.86], [0, 0.95], [-0.4, 1.03], [-0.9, 1.1], [-1.4, 1.13], [-1.85, 1.15]]);
// top and throat heights from the side view, relative to the eye centre
export const zTop = lerpTable([[0.55, -0.15], [0.49, -0.04], [0.40, 0.06], [0.16, 0.19], [-0.07, 0.27], [-0.30, 0.34], [-0.65, 0.43], [-1.0, 0.48], [-1.85, 0.50]]);
export const zBot = lerpTable([[0.55, -0.15], [0.52, -0.25], [0.40, -0.32], [0.16, -0.34], [-0.02, -0.53], [-0.30, -0.57], [-0.65, -0.60], [-1.85, -0.60]]);
const EXP = 2.2; // cross-section: a slightly squared ellipse, flat-topped like an axolotl head
// surface point at forward x and angle t around the cross-section (t = 0 points sideways towards +a, PI/2 up)
export const surf = (x, t) => {
  const w = halfW(x), zc = (zTop(x) + zBot(x)) / 2, h = (zTop(x) - zBot(x)) / 2, c = Math.cos(t), s = Math.sin(t);
  const sgn = v => (v < 0 ? -1 : 1), p = v => sgn(v) * Math.abs(v) ** (2 / EXP);
  return [x, w * p(c), zc + h * p(s)];
};
// the eyes sit on the upper sides at x = 0, a = +-0.5; their height is where the surface reaches a = 0.5 on top
export const eyeZ = (() => { const w = halfW(0), zc = (zTop(0) + zBot(0)) / 2, h = (zTop(0) - zBot(0)) / 2; return zc + h * (1 - (0.5 / w) ** EXP) ** (1 / EXP); })();
// the mouth gape: along each side at 0.27 below the eye centre, from the corner just behind the eye to the tip
export const mouthZ = -0.28, mouthBack = -0.09;
