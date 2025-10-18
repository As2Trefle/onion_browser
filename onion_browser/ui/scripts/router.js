(function attachOmniboxMeasure() {
  function pickCandidate() {
    const order = [
      '#omnibox input', '.onion-omnibox input', '.omnibox input',
      '.search-bar input', '.lb-omnibox input',
      '.addressbar input', '.address-bar input',
      '#omnibox', '.onion-omnibox', '.omnibox',
      '.search-bar', '.lb-omnibox', '.addressbar', '.address-bar',
      '#searchbar'
    ];
    for (const sel of order) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  let baseH = null;

  function measureOmniboxHeight() {
    const root = document.documentElement;

    root.style.setProperty('--omnibox-h', '0px');

    const el = pickCandidate();
    let h = el ? Math.ceil(el.getBoundingClientRect().height) : 84;

    h = Math.max(36, Math.min(h, 72));

    if (baseH == null) baseH = h;
    root.style.setProperty('--omnibox-h', `${baseH}px`);
  }

  window.OnionRouter = window.OnionRouter || {};
  window.OnionRouter.measureOmnibox = measureOmniboxHeight;

  setTimeout(measureOmniboxHeight, 0);
  window.addEventListener('resize', measureOmniboxHeight, { passive: true });
})();

(function () {
  'use strict';

  const RES =
    (typeof GetParentResourceName === 'function' && GetParentResourceName()) ||
    window.resourceName ||
    'onion_browser';

  const BASE = `https://cfx-nui-${RES}/ui/`;
  const toURL = (rel) => new URL(String(rel).replace(/^\//, ''), BASE).toString();

  const getRoot = () =>
    document.getElementById('page') ||
    document.getElementById('app')  ||
    document.querySelector('[data-router-root]') ||
    document.body;

  const form  =
    document.getElementById('omnibox') ||
    document.querySelector('.omnibox form, #searchForm');
  const input =
    document.getElementById('omnibox-input') ||
    document.querySelector('#omnibox input, #searchInput');

  const SECRET_LINKS = ['black-bay.onion', 'bb://blackbay', 'blackbay', 'black bay', 'b'];
  const isBlackBay = (q) => {
    const s = String(q || '').trim().toLowerCase();
    return SECRET_LINKS.some(k => s === k || s.includes(k));
  };

  const normalize = (name='') => String(name).trim().toLowerCase().replace(/\s+/g, '');
  const ALIASES = {
    home: 'home',
    search: 'search',
    blackbay: 'blackbay',
    blackbay_drogues: 'blackbay_drogues',
    blackbaymeth: 'blackbay_drogues',
    cart: 'blackbay_cart',
    blackbay_cart: 'blackbay_cart',
    armes: 'blackbay_armes',
    blackbay_armes: 'blackbay_armes',
    marche: 'blackbay_marche',
    blackbay_marche: 'blackbay_marche',
  };
  const resolveRoute = (name) => ALIASES[normalize(name)] || normalize(name);

  async function exists(path) {
    const url = toURL(path);
    try {
      const h = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (h.ok) return true;
    } catch {/* ignore */}
    try {
      const g = await fetch(url, { method: 'GET', cache: 'no-store' });
      return g.ok;
    } catch {
      return false;
    }
  }

  function cleanupAssets() {
    document.getElementById('page-script')?.remove();
    document.getElementById('page-style')?.remove();
  }

  function showLoading(route) {
    const root = getRoot();
    root.innerHTML = `
      <div style="padding:1rem;font-family:system-ui,Arial;opacity:.7">
        <small>Chargement de <b>${route}</b>…</small>
      </div>
    `;
  }

  function showNotFound(route, htmlPath) {
    const root = getRoot();
    root.innerHTML = `
      <div style="padding:1rem;font-family:system-ui,Arial">
        <b>Page "${route}" introuvable.</b><br>
        <small>Fichier manquant: <code>ui/${htmlPath}</code><br>
        Vérifie aussi le <code>fxmanifest.lua</code> (la section <code>files</code> doit inclure <code>ui/pages/**/index.html</code>, <code>style.css</code>, <code>script.js</code>).</small>
      </div>`;
    console.error('[OnionRouter] Introuvable :', htmlPath);
  }

  function showLoadError(route, detail) {
    const root = getRoot();
    root.innerHTML = `
      <div style="padding:1rem;font-family:system-ui,Arial">
        <b>Erreur de chargement de "${route}".</b><br>
        <small>${String(detail)}</small>
      </div>`;
  }

  const Router = {
    current: null,
    routes: null,

    async go(pageName = 'home') {
      const route = resolveRoute(pageName);

      if (this.current === route) return;

      const base     = `pages/${route}`;
      const htmlPath = `${base}/index.html`;
      const cssPath  = `${base}/style.css`;
      const jsPath   = `${base}/script.js`;

      showLoading(route);

      if (!(await exists(htmlPath))) {
        showNotFound(route, htmlPath);
        return;
      }

      try {
        cleanupAssets();

        const htmlRes = await fetch(toURL(htmlPath), { cache: 'no-store' });
        if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status} sur ${htmlPath}`);
        const html = await htmlRes.text();

        const root = getRoot();
        root.innerHTML = html;

        const cssLink = document.createElement('link');
        cssLink.id = 'page-style';
        cssLink.rel = 'stylesheet';
        cssLink.href = toURL(cssPath) + `?v=${Date.now()}`;
        document.head.appendChild(cssLink);

        const pageScript = document.createElement('script');
        pageScript.id = 'page-script';
        pageScript.src = toURL(jsPath) + `?v=${Date.now()}`;
        pageScript.defer = true;

        pageScript.addEventListener('load', () => {
          setTimeout(() => window.OnionRouter?.measureOmnibox?.(), 0);
        });
        pageScript.addEventListener('error', () => {
          console.error('[OnionRouter] script load failed:', jsPath);
          showLoadError(route, `Script introuvable: ui/${jsPath}`);
          setTimeout(() => window.OnionRouter?.measureOmnibox?.(), 0);
        });

        document.body.appendChild(pageScript);

        this.current = route;
        window.OnionRouter.current = route;

        if (typeof root.scrollTo === 'function') {
          root.scrollTo({ top: 0, behavior: 'instant' });
        } else {
          try { window.scrollTo(0, 0); } catch {}
        }

      } catch (e) {
        console.error('[OnionRouter] load error:', e);
        cleanupAssets();
        showLoadError(route, e);
      }
    },

    async reload() {
      if (this.current) return this.go(this.current);
      return this.go('home');
    }
  };

  Router.routes = { ...ALIASES };

  const prevOnion = window.OnionRouter || {};
  window.OnionRouter = Object.assign(prevOnion, Router);

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value;
      if (!q) return;
      sessionStorage.setItem('onion:q', q);
      Router.go(isBlackBay(q) ? 'blackbay' : 'search');
    });
  }

  Router.go('home');
})();
