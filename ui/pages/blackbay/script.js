// ui/pages/blackbay/script.js
(function () {
  // Active le thème/largeur BlackBay
  document.body.classList.add('route-blackbay');

  // Nettoyage à la sortie
  const root = document.querySelector('.bb');
  const cleanup = () => document.body.classList.remove('route-blackbay');
  const obs = new MutationObserver(() => {
    if (root && !document.body.contains(root)) { cleanup(); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // Tabs (visuel pour l’instant)
  const tabs = document.getElementById('bb-tabs');
  if (tabs) {
    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]');
      if (!a) return;
      e.preventDefault();

      const tab = a.dataset.tab;
      if (tab === 'drogues' && window.OnionRouter) {
        return window.OnionRouter.go('blackbay_drogues');
      }
      // TODO: armes -> blackbay_armes ; marche -> blackbay_marche

      // Visuel local (si tu veux tout de même marquer actif ici)
      tabs.querySelectorAll('.bb__tab').forEach(li => li.classList.remove('bb__tab--active'));
      a.parentElement.classList.add('bb__tab--active');
    });
  }

  // On ne rend plus la grille par défaut ; elle est masquée dans le HTML.
})();
