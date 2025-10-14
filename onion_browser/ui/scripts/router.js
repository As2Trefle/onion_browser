// ui/scripts/router.js
// ===== Omnibox: mesure SAFE + gel sur la 1ʳᵉ valeur (évite tout "saut") =====
(function attachOmniboxMeasure() {
  // On cible d'abord l'INPUT de la barre (hauteur stable), sinon fallback
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

  let baseH = null; // on "gèle" la 1ʳᵉ hauteur (celle de Home)

  function measureOmniboxHeight() {
    const root = document.documentElement;

    // neutralise la variable pour ne pas s'auto-inclure dans la mesure
    root.style.setProperty('--omnibox-h', '0px');

    const el = pickCandidate();
    let h = el ? Math.ceil(el.getBoundingClientRect().height) : 84;

    // clamp anti-dérive (bornes raisonnables pour lb-phone)
    h = Math.max(36, Math.min(h, 72));

    if (baseH == null) baseH = h; // 1ʳᵉ mesure = référence
    root.style.setProperty('--omnibox-h', `${baseH}px`);
  }

  // expose globalement
  window.OnionRouter = window.OnionRouter || {};
  window.OnionRouter.measureOmnibox = measureOmniboxHeight;

  // mesure initiale + au resize (orientation, etc.)
  setTimeout(measureOmniboxHeight, 0);
  window.addEventListener('resize', measureOmniboxHeight, { passive: true });
})();

(function () {
  'use strict';

  // --- Détection du nom de ressource & URLs NUI absolues --------------------
  const RES =
    (typeof GetParentResourceName === 'function' && GetParentResourceName()) ||
    window.resourceName ||
    'onion_browser';

  const BASE = `https://cfx-nui-${RES}/ui/`;
  const toURL = (rel) => new URL(String(rel).replace(/^\//, ''), BASE).toString();

  // --- Racine d'injection (supporte #page, #app, ou [data-router-root]) -----
  const getRoot = () =>
    document.getElementById('page') ||
    document.getElementById('app')  ||
    document.querySelector('[data-router-root]') ||
    document.body;

  // --- Omnibox / barre d'adresse (si présente) ------------------------------
  const form  =
    document.getElementById('omnibox') ||
    document.querySelector('.omnibox form, #searchForm');
  const input =
    document.getElementById('omnibox-input') ||
    document.querySelector('#omnibox input, #searchInput');

  // Liens/keywords secrets pour BlackBay
  const SECRET_LINKS = ['black-bay.onion', 'bb://blackbay', 'blackbay', 'black bay', 'b'];
  const isBlackBay = (q) => {
    const s = String(q || '').trim().toLowerCase();
    return SECRET_LINKS.some(k => s === k || s.includes(k));
  };

  // --- Normalisation & alias de routes --------------------------------------
  const normalize = (name='') => String(name).trim().toLowerCase().replace(/\s+/g, '');
  const ALIASES = {
    home: 'home',
    search: 'search',
    blackbay: 'blackbay',
    blackbay_drogues: 'blackbay_drogues',
    blackbaymeth: 'blackbay_drogues',   // alias amical
    cart: 'blackbay_cart',
    blackbay_cart: 'blackbay_cart',
    armes: 'blackbay_armes',                // ← NEW
    blackbay_armes: 'blackbay_armes',
  };
  const resolveRoute = (name) => ALIASES[normalize(name)] || normalize(name);

  // --- Fallback HEAD→GET pour éviter les faux négatifs en NUI ----------------
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

  // --- Nettoyage des assets de page précédents ------------------------------
  function cleanupAssets() {
    document.getElementById('page-script')?.remove();
    document.getElementById('page-style')?.remove();
  }

  // --- Helpers UI -----------------------------------------------------------
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

  // --- Router ---------------------------------------------------------------
  const Router = {
    current: null,
    routes: null,

    async go(pageName = 'home') {
      const route = resolveRoute(pageName);

      // Idempotence : recliquer "Panier" depuis "Panier" ne fait rien → pas de glitch
      if (this.current === route) return;

      const base    = `pages/${route}`;
      const htmlPath= `${base}/index.html`;
      const cssPath = `${base}/style.css`;
      const jsPath  = `${base}/script.js`;

      // Loader visible (évite écran noir)
      showLoading(route);

      // Vérifie l'existence de la page avant d'injecter
      if (!(await exists(htmlPath))) {
        showNotFound(route, htmlPath);
        return;
      }

      try {
        // Retire proprement les assets précédents AVANT de charger les nouveaux
        cleanupAssets();

        // 1) HTML
        const htmlRes = await fetch(toURL(htmlPath), { cache: 'no-store' });
        if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status} sur ${htmlPath}`);
        const html = await htmlRes.text();

        const root = getRoot();
        root.innerHTML = html;

        // 2) CSS (swap) avec cache-busting
        const cssLink = document.createElement('link');
        cssLink.id = 'page-style';
        cssLink.rel = 'stylesheet';
        cssLink.href = toURL(cssPath) + `?v=${Date.now()}`;
        document.head.appendChild(cssLink);

        // 3) JS (append) avec cache-busting
        const script = document.createElement('script');
        script.id = 'page-script';
        script.src = toURL(jsPath) + `?v=${Date.now()}`;
        script.defer = true;
        script.onerror = () => {
          console.error('[OnionRouter] script load failed:', jsPath);
          showLoadError(route, `Script introuvable: ui/${jsPath}`);
        };
        document.body.appendChild(script);

        // 4) Marque la route courante & remonte en haut
        this.current = route;
        window.OnionRouter.current = route;

        if (typeof root.scrollTo === 'function') {
          root.scrollTo({ top: 0, behavior: 'instant' });
        } else {
          try { window.scrollTo(0, 0); } catch {}
        }

        console.debug('[OnionRouter] Loaded:', { route, htmlPath, cssPath, jsPath });
      } catch (e) {
        console.error('[OnionRouter] load error:', e);
        cleanupAssets();
        showLoadError(route, e);
      }
    },

    // pratique si tu veux recharger la page courante sans changer de route
    async reload() {
      if (this.current) return this.go(this.current);
      return this.go('home');
    }
  };

  Router.routes = { ...ALIASES }; // debug/inspection

  // Expose global
  const prevOnion = window.OnionRouter || {};
  window.OnionRouter = Object.assign(prevOnion, Router);

  // Omnibox → Search ou BlackBay (si lien secret)
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value;
      if (!q) return;
      sessionStorage.setItem('onion:q', q);
      Router.go(isBlackBay(q) ? 'blackbay' : 'search');
    });
  }

  // Démarrage par défaut
  Router.go('home');
  script.addEventListener('load', () => {
  // recalibre la hauteur quand la page est prête
  setTimeout(() => window.OnionRouter?.measureOmnibox?.(), 0);});
})();
