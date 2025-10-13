// ui/router.js
(function () {
  // --- Détection du nom de ressource pour construire des URLs NUI absolues ---
  // (évite les soucis de chemins relatifs)
  const RES =
    (typeof GetParentResourceName === 'function' && GetParentResourceName()) ||
    window.resourceName ||
    'onion_browser';

  const BASE = `https://cfx-nui-${RES}/ui/`;
  const toURL = (rel) => new URL(String(rel).replace(/^\//, ''), BASE).toString();

  // --- Racine d'injection (supporte #page ou #app) ---
  const pageRoot =
    document.getElementById('page') ||
    document.getElementById('app')  ||
    document.querySelector('[data-router-root]');

  if (!pageRoot) {
    console.error('[OnionRouter] Impossible de trouver #page ou #app pour injecter les pages.');
    return;
  }

  // --- Omnibox / barre d'adresse (facultatif, si présente) ---
  const form  = document.getElementById('omnibox') || document.querySelector('.omnibox form, #searchForm');
  const input = document.getElementById('omnibox-input') || document.querySelector('#omnibox input, #searchInput');

  // Lien/keywords secrets pour BlackBay (adapter/ajouter si besoin)
  const SECRET_LINKS = ['black-bay.onion', 'bb://blackbay', 'blackbay', 'black bay', 'b'];
  const isBlackBay = (q) => {
    const s = String(q || '').trim().toLowerCase();
    return SECRET_LINKS.some(k => s === k || s.includes(k));
  };

  // --- Normalisation & alias de routes (évite les typos) ---
  const normalize = (name='') => String(name).trim().toLowerCase().replace(/\s+/g, '');
  const ALIASES = {
    home: 'home',
    search: 'search',
    blackbay: 'blackbay',
    blackbay_drogues: 'blackbay_drogues',
    blackbaymeth: 'blackbay_drogues',   // alias amical
    cart: 'blackbay_cart',
    blackbay_cart: 'blackbay_cart',
  };
  const resolveRoute = (name) => ALIASES[normalize(name)] || normalize(name);

  // HEAD check pour message d'erreur propre (au lieu de page vide)
  async function exists(path) {
    try {
      const res = await fetch(toURL(path), { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Nettoyage scripts/page-style précédents
  function cleanupAssets() {
    const oldScript = document.getElementById('page-script');
    if (oldScript) oldScript.remove();
    const oldStyle = document.getElementById('page-style');
    if (oldStyle) oldStyle.remove();
  }

  const Router = {
    current: null,

    async go(pageName = 'home') {
      const route = resolveRoute(pageName);
      if (this.current === route) return;

      const htmlPath = `pages/${route}/index.html`;
      const cssPath  = `pages/${route}/style.css`;
      const jsPath   = `pages/${route}/script.js`;

      // Petit squelette visible pendant la charge (évite "noir")
      pageRoot.innerHTML = `
        <div style="padding:1rem;font-family:system-ui,Arial;opacity:.7">
          <small>Chargement de <b>${route}</b>…</small>
        </div>
      `;

      // Vérifie que le HTML existe avant de nettoyer/injecter
      if (!(await exists(htmlPath))) {
        pageRoot.innerHTML = `
          <div style="padding:1rem;font-family:system-ui,Arial">
            <b>Page "${route}" introuvable.</b><br>
            <small>Fichier manquant: <code>ui/${htmlPath}</code><br>
            Vérifie aussi le <code>fxmanifest.lua</code> (section <code>files</code> doit inclure <code>ui/**</code>).</small>
          </div>`;
        console.error('[OnionRouter] Introuvable :', htmlPath);
        return;
      }

      try {
        // HTML
        const htmlRes = await fetch(toURL(htmlPath), { cache: 'no-cache' });
        if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status} sur ${htmlPath}`);
        const html = await htmlRes.text();

        // Injecte HTML
        pageRoot.innerHTML = html;

        // Remplace CSS de page
        const cssLink = document.createElement('link');
        cssLink.id = 'page-style';
        cssLink.rel = 'stylesheet';
        cssLink.href = toURL(cssPath);
        // Supprime l'ancien s'il existe
        const prev = document.getElementById('page-style');
        if (prev) prev.remove();
        document.head.appendChild(cssLink);

        // Charge et exécute le script de page
        const script = document.createElement('script');
        script.id = 'page-script';
        script.src = toURL(jsPath);
        script.defer = true;
        document.body.appendChild(script);

        this.current = route;
        console.debug('[OnionRouter] Loaded:', { route, htmlPath, cssPath, jsPath });
      } catch (e) {
        console.error('[OnionRouter] load error:', e);
        cleanupAssets();
        pageRoot.innerHTML = `
          <div style="padding:1rem;font-family:system-ui,Arial">
            <b>Erreur de chargement de "${route}".</b><br>
            <small>${String(e)}</small>
          </div>`;
      }
    }
  };

  // Expose global
  window.OnionRouter = Router;

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
})();
