(function () {
  setTimeout(() => window.OnionRouter?.measureOmnibox?.(), 0);

  document.body.classList.add('route-blackbay');
  const root = document.querySelector('.bb.bbHome');
  const onUnmount = () => document.body.classList.remove('route-blackbay');

  const mo = new MutationObserver(() => {
    if (root && !document.body.contains(root)) {
      stopAnim();
      window.removeEventListener('resize', onResize);
      onUnmount();
      mo.disconnect();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  const $ = (s, p=document) => p.querySelector(s);
  const tabs = $('#bb-tabs');
  if (tabs) {
    tabs.querySelectorAll('.bb__tab').forEach(li => li.classList.remove('bb__tab--active'));
    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]'); if (!a) return;
      e.preventDefault();
      const t = a.dataset.tab;
      if (t === 'drogues') return window.OnionRouter?.go('blackbay_drogues');
      if (t === 'armes')   return window.OnionRouter?.go('blackbay_armes');
      if (t === 'marche')  return window.OnionRouter?.go('blackbay_marche');
    });
  }

  const canvas = document.getElementById('bb-bg');
  const cx     = canvas?.getContext('2d');
  const INCREMENT  = 12345;
  const MULTIPLIER = 1103515245;
  const MODULUS    = Math.pow(2, 31);
  const stepX = 16, stepY = 16;
  const sizeX = 1,  sizeY = 1;
  const marginTop = 0, marginBottom = 0, marginLeft = 0, marginRight = 0;

  let frameID = null;

  function lcg(x, c = INCREMENT, a = MULTIPLIER, m = MODULUS) {
    return (a * x + c) % m;
  }
  function createRandom(initialSeed = 0) {
    let seed = initialSeed;
    return {
      get currentSeed() { return seed; },
      reset(newSeed)    { seed = newSeed; },
      get() { seed = lcg(seed); return seed / MODULUS; }
    };
  }
  const random = createRandom();

  function frame(frameTime) {
    if (!cx) return;
    cx.clearRect(0,0,cx.canvas.width,cx.canvas.height);
    for (let y = marginTop; y < cx.canvas.height - marginBottom; y += stepY) {
      random.reset(y);
      for (let x = marginLeft; x < cx.canvas.width - marginRight; x += stepX) {
        const r = random.get();
        const distX = r * 16;
        const distY = r * 16;
        const phase = r * Math.PI * 2;
        cx.fillStyle = '#ff8a00';
        cx.fillRect(
          x,
          y,
          sizeX + Math.sin(phase + frameTime / 1000) * distX,
          sizeY + Math.cos(phase + frameTime / 1000) * distY
        );
      }
    }
    frameID = window.requestAnimationFrame(frame);
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  function startAnim() {
    window.addEventListener('resize', onResize, { passive:true });
    onResize();
    frameID = window.requestAnimationFrame(frame);
  }
  function stopAnim() {
    if (frameID) { window.cancelAnimationFrame(frameID); frameID = null; }
  }
  function onResize() {
    resizeCanvas();
    window.OnionRouter?.measureOmnibox?.();
  }

  startAnim();
})();
