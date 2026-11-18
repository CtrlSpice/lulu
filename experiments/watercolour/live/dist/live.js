// The live watercolour page: builds the axolotl model, draws it with WebGL in four kinds of pass (see shaders.ts),
// and reads the controls. State (the view, the pose, the clock) lives here at the edge; model.ts and mesh.ts are pure.
import { buildAxolotl } from './model.js';
import { buildMesh, VERTEX_FLOATS } from './mesh.js';
import { GEOMETRY_VS, GEOMETRY_FS, SCREEN_VS, PAINT_FS, BLUR_FS, PAPER_FS } from './shaders.js';
const WIDTH = 1000, HEIGHT = 700, CENTRE = [500, 350];
function fail(message) {
    const el = document.getElementById('message');
    if (el)
        el.textContent = message;
    throw new Error(message);
}
function program(gl, vs, fs) {
    const make = (type, src) => {
        const sh = gl.createShader(type) ?? fail('Could not create a shader');
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
            fail('Shader did not compile: ' + gl.getShaderInfoLog(sh));
        return sh;
    };
    const p = gl.createProgram() ?? fail('Could not create a program');
    gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        fail('Program did not link: ' + gl.getProgramInfoLog(p));
    return p;
}
function target(gl, count, depth) {
    const fbo = gl.createFramebuffer() ?? fail('Could not create a framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const textures = [];
    for (let i = 0; i < count; i++) {
        const t = gl.createTexture() ?? fail('Could not create a texture');
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, WIDTH, HEIGHT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
        textures.push(t);
    }
    if (depth) {
        const rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, WIDTH, HEIGHT);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    }
    gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        fail('This browser cannot draw to the textures the watercolour needs');
    return { fbo, textures };
}
/** Where a model point lands on the picture, with the same maths as the geometry shader. */
function project(p, view) {
    const spin = view.spin * Math.PI / 180, tilt = view.tilt * Math.PI / 180, x = p[0] - CENTRE[0], y = p[1] - CENTRE[1];
    const rx = Math.cos(spin) * x - Math.sin(spin) * y, ry = Math.sin(spin) * x + Math.cos(spin) * y;
    return [CENTRE[0] + rx * view.zoom, CENTRE[1] + (ry * Math.cos(tilt) - p[2] * Math.sin(tilt)) * view.zoom];
}
async function start() {
    const canvas = document.getElementById('picture') ?? fail('No canvas on the page');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true }) ?? fail('This browser has no WebGL 2');
    if (!gl.getExtension('EXT_color_buffer_float'))
        fail('This browser cannot draw to float textures (EXT_color_buffer_float)');
    const tables = await (await fetch('ink-luts.json')).json();
    const geometry = program(gl, GEOMETRY_VS, GEOMETRY_FS), paint = program(gl, SCREEN_VS, PAINT_FS), blur = program(gl, SCREEN_VS, BLUR_FS), paper = program(gl, SCREEN_VS, PAPER_FS);
    const where = target(gl, 2, true), painted = target(gl, 1, false), temp = target(gl, 1, false), core = target(gl, 1, false), wide = target(gl, 1, false);
    // the two ink tables as one small texture: row 0 body, row 1 wine
    const inkTex = gl.createTexture();
    const rows = new Float32Array(1025 * 2 * 4);
    [tables.body, tables.wine].forEach((t, row) => { for (let q = 0; q < 1025; q++) {
        const o = (row * 1025 + q) * 4;
        rows[o] = t[q * 3];
        rows[o + 1] = t[q * 3 + 1];
        rows[o + 2] = t[q * 3 + 2];
        rows[o + 3] = 1;
    } });
    gl.bindTexture(gl.TEXTURE_2D, inkTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1025, 2, 0, gl.RGBA, gl.FLOAT, rows);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // mesh buffers
    const vao = gl.createVertexArray(), vbo = gl.createBuffer(), ibo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    const stride = VERTEX_FLOATS * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 28);
    const screenVao = gl.createVertexArray();
    let axolotl = buildAxolotl(), indexCount = 0, meshPhase = NaN;
    const upload = (a) => {
        const mesh = buildMesh(a);
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.DYNAMIC_DRAW);
        indexCount = mesh.indices.length;
    };
    const settings = { view: { tilt: 0, spin: 0, zoom: 1 }, wiggle: 0, flow: 1, playing: true };
    let clock = 0, last = performance.now(), frames = 0, fpsSince = last;
    const uni = (p, name) => gl.getUniformLocation(p, name);
    const bind = (unit, tex, p, name) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(uni(p, name), unit); };
    const screenPass = (to) => { gl.bindFramebuffer(gl.FRAMEBUFFER, to); gl.viewport(0, 0, WIDTH, HEIGHT); gl.bindVertexArray(screenVao); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const blurInto = (from, to, radius) => {
        gl.useProgram(blur);
        gl.uniform1i(uni(blur, 'uRadius'), radius);
        bind(0, from, blur, 'uTex');
        gl.uniform2i(uni(blur, 'uStep'), 1, 0);
        screenPass(temp.fbo);
        bind(0, temp.textures[0], blur, 'uTex');
        gl.uniform2i(uni(blur, 'uStep'), 0, 1);
        screenPass(to.fbo);
    };
    const draw = () => {
        // pose: rebuild the animal only when it moves
        const phase = settings.wiggle > 0 ? clock * 2.2 : 0;
        if (phase !== meshPhase || indexCount === 0) {
            axolotl = buildAxolotl({ wave: settings.wiggle, phase });
            upload(axolotl);
            meshPhase = phase;
        }
        const v = settings.view;
        // 1. geometry: where on the animal each pixel is
        gl.bindFramebuffer(gl.FRAMEBUFFER, where.fbo);
        gl.viewport(0, 0, WIDTH, HEIGHT);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        gl.useProgram(geometry);
        gl.uniform2f(uni(geometry, 'uCentre'), CENTRE[0], CENTRE[1]);
        gl.uniform2f(uni(geometry, 'uSize'), WIDTH, HEIGHT);
        gl.uniform1f(uni(geometry, 'uSpin'), v.spin * Math.PI / 180);
        gl.uniform1f(uni(geometry, 'uTilt'), v.tilt * Math.PI / 180);
        gl.uniform1f(uni(geometry, 'uZoom'), v.zoom);
        gl.bindVertexArray(vao);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
        gl.disable(gl.DEPTH_TEST);
        // 2. paint: how much of each ink
        gl.useProgram(paint);
        bind(0, where.textures[0], paint, 'uWhere0');
        bind(1, where.textures[1], paint, 'uWhere1');
        gl.uniform1f(uni(paint, 'uTime'), clock);
        gl.uniform1f(uni(paint, 'uFlow'), settings.flow);
        gl.uniform1f(uni(paint, 'uLength'), axolotl.L);
        screenPass(painted.fbo);
        // 3. the paint spreads: a tight blur and a wide one
        blurInto(painted.textures[0], core, 2);
        blurInto(painted.textures[0], wide, 9);
        // 4. paper: bleed, rim, grain, colour
        gl.useProgram(paper);
        bind(0, painted.textures[0], paper, 'uPaint');
        bind(1, core.textures[0], paper, 'uCore');
        bind(2, wide.textures[0], paper, 'uWide');
        bind(3, inkTex, paper, 'uInk');
        gl.uniform3f(uni(paper, 'uPaper'), tables.paperLin[0], tables.paperLin[1], tables.paperLin[2]);
        gl.uniform2f(uni(paper, 'uSize'), WIDTH, HEIGHT);
        gl.uniform1f(uni(paper, 'uTime'), clock);
        gl.uniform1f(uni(paper, 'uFlow'), settings.flow);
        gl.uniform1f(uni(paper, 'uZoom'), v.zoom);
        const eyes = axolotl.eyes.map(e => project(e, v));
        gl.uniform2fv(uni(paper, 'uEye'), new Float32Array([eyes[0][0], eyes[0][1], eyes[1][0], eyes[1][1]]));
        screenPass(null);
    };
    const fpsEl = document.getElementById('fps');
    const tick = (now) => {
        if (settings.playing)
            clock += Math.min(0.1, (now - last) / 1000);
        last = now;
        draw();
        frames++;
        if (now - fpsSince > 1000) {
            if (fpsEl)
                fpsEl.textContent = `${Math.round(frames * 1000 / (now - fpsSince))} frames per second`;
            frames = 0;
            fpsSince = now;
        }
        requestAnimationFrame(tick);
    };
    // controls
    const slider = (id, apply) => {
        const el = document.getElementById(id);
        if (!el)
            return;
        const out = document.getElementById(id + '-value');
        const read = () => { apply(Number(el.value)); if (out)
            out.textContent = el.value; };
        el.addEventListener('input', read);
        read();
    };
    slider('tilt', x => { settings.view.tilt = x; });
    slider('spin', x => { settings.view.spin = x; });
    slider('wiggle', x => { settings.wiggle = x; });
    slider('flow', x => { settings.flow = x; });
    const setView = (tilt, spin) => {
        for (const [id, value] of [['tilt', tilt], ['spin', spin]]) {
            const el = document.getElementById(id);
            if (el) {
                el.value = String(value);
                el.dispatchEvent(new Event('input'));
            }
        }
    };
    document.getElementById('view-top')?.addEventListener('click', () => setView(0, 0));
    document.getElementById('view-angle')?.addEventListener('click', () => setView(55, 0));
    document.getElementById('view-side')?.addEventListener('click', () => setView(90, 0));
    const play = document.getElementById('play');
    play?.addEventListener('click', () => { settings.playing = !settings.playing; play.textContent = settings.playing ? 'Pause' : 'Play'; });
    // for checks from outside the page: set the view and clock, draw once, read the settings
    window.luluLive = { settings, setView, drawAt: (time) => { clock = time; draw(); }, axolotl: () => axolotl };
    const message = document.getElementById('message');
    if (message)
        message.textContent = '';
    requestAnimationFrame(tick);
}
start().catch(err => { const el = document.getElementById('message'); if (el && !el.textContent)
    el.textContent = String(err); console.error(err); });
