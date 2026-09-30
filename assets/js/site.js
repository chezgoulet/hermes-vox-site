// Hermes Vox — a small canvas cousin of the app's being for the hero.
// It walks one conversational turn: rest -> thinking -> recalling -> speaking,
// morphing between shapes the way the real (OpenGL) being does, with the words
// typed below in the app's monospace "voice". Static under reduced motion; paused
// when off-screen or the tab is hidden.
(() => {
  const canvas = document.getElementById("being-canvas");
  const crawl = document.getElementById("crawl");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TAU = Math.PI * 2;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const N = small ? 1400 : 2600;

  // Per-particle identity: stable random numbers, like the app's stateless particles.
  const seed = new Float32Array(N * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
  const gauss = (a, b) => Math.sqrt(-2 * Math.log(a + 1e-6)) * Math.cos(TAU * b);

  const NODES = [[-.62, -.38], [-.2, -.66], [.3, -.52], [.66, -.12], [.42, .38], [-.05, .6], [-.5, .32], [.05, -.05]];
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [7, 1], [7, 4], [7, 6], [2, 7]];

  // Shapes: (i, t) -> [x, y] in unit space, radius ~1.
  const SHAPES = {
    aura(i, t) {
      const a = seed[i * 4], b = seed[i * 4 + 1];
      const r = Math.abs(gauss(a, b)) * 0.3 * (1 + 0.04 * Math.sin(t * 1.4));
      const th = TAU * seed[i * 4 + 2] + t * (0.08 + 0.1 * seed[i * 4 + 3]);
      return [Math.cos(th) * r, Math.sin(th) * r];
    },
    radar(i, t) {
      const u = seed[i * 4], v = seed[i * 4 + 1];
      const sweep = t * 1.3;
      if (u < 0.42) { // rings
        const ring = 0.3 + 0.3 * Math.floor(v * 3);
        const th = TAU * seed[i * 4 + 2];
        return [Math.cos(th) * ring, Math.sin(th) * ring];
      }
      if (u < 0.78) { // the sweep beam and its trail
        const lag = Math.pow(seed[i * 4 + 2], 2.2) * 0.9;
        const r = 0.04 + v * 0.88;
        return [Math.cos(sweep - lag) * r, Math.sin(sweep - lag) * r];
      }
      const bl = Math.floor(v * 4); // blips
      const bth = bl * 1.9 + 0.6, br = 0.3 + bl * 0.15;
      const j = gauss(seed[i * 4 + 2], seed[i * 4 + 3]) * 0.03;
      return [Math.cos(bth) * br + j, Math.sin(bth) * br + j * 0.7];
    },
    constellation(i, t) {
      const u = seed[i * 4];
      if (u < 0.35) {
        const n = NODES[Math.floor(seed[i * 4 + 1] * NODES.length)];
        const j = 0.035 * gauss(seed[i * 4 + 2], seed[i * 4 + 3]);
        return [n[0] * 0.82 + j, n[1] * 0.82 + j * 0.8];
      }
      const e = EDGES[Math.floor(seed[i * 4 + 1] * EDGES.length)];
      const a = NODES[e[0]], b = NODES[e[1]];
      const s = (seed[i * 4 + 2] + t * 0.22) % 1; // pulses travel the links
      const j = (seed[i * 4 + 3] - 0.5) * 0.012;
      return [(a[0] + (b[0] - a[0]) * s) * 0.82 + j, (a[1] + (b[1] - a[1]) * s) * 0.82 - j];
    },
    soundwave(i, t) {
      const u = seed[i * 4], v = seed[i * 4 + 1];
      const x = u * 2 - 1;
      if (seed[i * 4 + 2] < 0.28) return [x, 0.03 * Math.sin(x * 7 + t * 5)];
      const bar = Math.floor(u * 44);
      const h = (0.12 + 0.3 * Math.abs(Math.sin(bar * 1.7 + t * 6.3)) * Math.abs(Math.sin(bar * 0.37 + t * 2.1)))
        * (1 - Math.abs(x) * 0.55);
      return [(bar + 0.5) / 22 - 1, (v * 2 - 1) * h];
    },
    iris(i, t) {
      const r = 0.22 + 0.42 * seed[i * 4] + 0.015 * Math.sin(t * 1.6);
      const th = TAU * seed[i * 4 + 1] + 0.004 * Math.sin(t + seed[i * 4 + 2] * 6);
      const fibre = Math.round(th / TAU * 120) / 120 * TAU;
      const tt = seed[i * 4 + 2] < 0.6 ? fibre : th;
      return [Math.cos(tt) * r, Math.sin(tt) * r];
    },
  };

  // One turn, as the app lives it. Colours from the app's state palette.
  const SCRIPT = [
    { shape: "aura", rgb: [0, 229, 255], hold: 3.6, text: "" },
    { shape: "radar", rgb: [251, 176, 64], hold: 3.4, text: "// thinking" },
    { shape: "constellation", rgb: [251, 160, 70], hold: 3.4, text: "// tool: memory" },
    { shape: "soundwave", rgb: [167, 139, 250], hold: 6.2, text: "The tide at Bar Harbor turns at 4:12 this afternoon, so you have a little over two hours." },
    { shape: "iris", rgb: [0, 229, 255], hold: 3.4, text: "" },
  ];
  const MORPH = 1.1;

  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, scale = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wide = W > 900;
    cx = wide ? W * 0.72 : W * 0.5;
    const vh = window.innerHeight;
    cy = wide ? H * 0.5 : Math.min(H * 0.3, vh * 0.25);
    scale = wide ? Math.min(W * 0.24, H * 0.36) : Math.min(W * 0.4, vh * 0.17);
  }

  const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  let step = 0, stepStart = 0, last = 0, clock = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; clock += dt;
    const cur = SCRIPT[step], prev = SCRIPT[(step + SCRIPT.length - 1) % SCRIPT.length];
    const age = clock - stepStart;
    const m = ease(Math.min(1, age / MORPH));
    const col = cur.rgb.map((c, k) => Math.round(prev.rgb[k] + (c - prev.rgb[k]) * m));

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const from = SHAPES[prev.shape], to = SHAPES[cur.shape];
    const swirl = Math.sin(m * Math.PI) * 0.35;
    const glow = small ? 0.5 : 0.62;
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${glow})`;
    for (let i = 0; i < N; i++) {
      // Staggered per-particle morph with a swirl through the middle, like the app.
      const stagger = Math.min(1, Math.max(0, (m * 1.35) - seed[i * 4 + 3] * 0.35));
      let [ax, ay] = from(i, clock), [bx, by] = to(i, clock);
      let x = ax + (bx - ax) * stagger, y = ay + (by - ay) * stagger;
      if (swirl > 0.01) { const c = Math.cos(swirl), s = Math.sin(swirl); [x, y] = [x * c - y * s, x * s + y * c]; }
      const size = 0.9 + seed[i * 4 + 2] * 1.5;
      ctx.fillRect(cx + x * scale, cy + y * scale, size, size);
    }
    // the hot core
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.5);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.10)`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(cx - scale, cy - scale, scale * 2, scale * 2);
    ctx.globalCompositeOperation = "source-over";

    // the words: typed at speaking pace, like the crawl locked to the voice
    if (crawl) {
      const n = cur.text.startsWith("//") ? cur.text.length : Math.floor(Math.max(0, age - 0.4) * 22);
      const shown = cur.text.slice(0, n);
      if (crawl.textContent !== shown) crawl.textContent = shown || " ";
    }
    if (age > cur.hold) { step = (step + 1) % SCRIPT.length; stepStart = clock; }
    if (running) raf = requestAnimationFrame(frame);
  }

  let raf = 0, running = false, visible = true;
  function start() { if (running || reduce) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  resize();
  window.addEventListener("resize", () => { resize(); if (reduce) paintStill(); }, { passive: true });

  function paintStill() {
    step = 0; stepStart = -10; clock = 0; running = false;
    frame(performance.now());
    if (crawl) crawl.textContent = SCRIPT[3].text;
  }
  if (reduce) { paintStill(); return; }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible && !document.hidden ? start() : stop(); })
      .observe(canvas);
  }
  document.addEventListener("visibilitychange", () => { document.hidden || !visible ? stop() : start(); });
  start();
})();
