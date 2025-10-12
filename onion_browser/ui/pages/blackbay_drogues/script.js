// ui/pages/blackbay_drogues/script.js
(function () {
  // Active le thème BlackBay
  document.body.classList.add('route-blackbay');

  // Nettoyage quand on quitte la page
  const root = document.querySelector('.bb');
  const cleanup = () => document.body.classList.remove('route-blackbay');
  const obs = new MutationObserver(() => {
    if (root && !document.body.contains(root)) { cleanup(); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // Routing des tabs principaux (reutilise le même comportement)
  const tabs = document.getElementById('bb-tabs');
  if (tabs) {
    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]');
      if (!a) return;
      e.preventDefault();
      const tab = a.dataset.tab;
      if (tab === 'drogues') return; // on y est déjà
      if (tab === 'armes'   && window.OnionRouter) return window.OnionRouter.go('blackbay'); // placeholder
      if (tab === 'marche'  && window.OnionRouter) return window.OnionRouter.go('blackbay'); // placeholder
    });
  }

  // Subtabs (visuel seulement)
  const sub = document.getElementById('bb-subtabs');
  const content = document.getElementById('bb-content');
  if (sub) {
    sub.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-sub]');
      if (!a) return;
      e.preventDefault();
      sub.querySelectorAll('.bbSub__tab').forEach(li => li.classList.remove('bbSub__tab--active'));
      a.parentElement.classList.add('bbSub__tab--active');

      // placeholder de contenu
      const map = {
        cocaine: 'Catalogue Cocaïne — à venir.',
        meth: 'Catalogue Méthamphétamine — à venir.',
        lab: 'Équipement de laboratoire — à venir.'
      };
      content.innerHTML = `<div class="bbDrug__placeholder">${map[a.dataset.sub] || 'Catégorie — à venir.'}</div>`;
    });
  }
})();
