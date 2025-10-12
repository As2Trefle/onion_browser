(function () {
  const RES  = (window.resourceName && String(window.resourceName)) || 'onion_browser';
  const BASE = `https://cfx-nui-${RES}/ui/`;
  const url  = (rel) => new URL(rel.replace(/^\//,''), BASE).toString();

  const pageRoot = document.getElementById('page');
  const form     = document.getElementById('omnibox');
  const input    = document.getElementById('omnibox-input');

  // Détection lien secret Black Bay
  const SECRET_LINKS = [
    'https://black-bay.onion', 'bb://blackbay', 'blackbay', 'black bay', 'b'
  ];
  const isBlackBay = (q) => {
    const s = (q || '').trim().toLowerCase();
    return SECRET_LINKS.some(key => s === key || s.includes(key));
  };

  // Router simple : charge uniquement le "main" dans #page
  const Router = {
    current: null,
    async go(pageName = 'home') {
      if (this.current === pageName) return;
      pageRoot.innerHTML = '';

      try {
        // HTML
        const htmlRes = await fetch(url(`pages/${pageName}/index.html`));
        if (!htmlRes.ok) throw new Error(`Failed to load ${pageName}/index.html (${htmlRes.status})`);
        pageRoot.innerHTML = await htmlRes.text();

        // CSS (swap)
        let pageStyle = document.getElementById('page-style');
        if (pageStyle) pageStyle.remove();
        pageStyle = document.createElement('link');
        pageStyle.id = 'page-style';
        pageStyle.rel = 'stylesheet';
        pageStyle.href = url(`pages/${pageName}/style.css`);
        document.head.appendChild(pageStyle);

        // JS
        const script = document.createElement('script');
        script.src = url(`pages/${pageName}/script.js`);
        script.defer = true;
        script.dataset.page = pageName;
        document.body.appendChild(script);

        this.current = pageName;
      } catch (e) {
        console.error('[OnionRouter] load error:', e);
        pageRoot.innerHTML = `
          <div style="padding:1rem;font-family:sans-serif">
            <b>Erreur de chargement de "${pageName}".</b><br>
            <small>${String(e)}</small>
          </div>`;
      }
    }
  };
  window.OnionRouter = Router;

  // Omnibox globale → route vers /search ou /blackbay
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = (input.value || '').trim();
    if (!query) return;
    sessionStorage.setItem('onion:q', query);
    Router.go(isBlackBay(query) ? 'blackbay' : 'search');
  });

  // Démarrage
  Router.go('home');
})();
