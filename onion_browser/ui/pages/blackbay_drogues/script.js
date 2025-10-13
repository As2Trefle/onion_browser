// ui/pages/blackbay_drogues/script.js
(function syncOmniboxPadding() {
  function update() {
    const omni =
      document.getElementById('omnibox') ||
      document.querySelector('.omnibox, .onion-omnibox, .search-bar, .lb-omnibox, .addressbar, .address-bar, #addressbar, #searchbar, #addressBar');

    // hauteur réelle observée (fallback 84px plus généreux)
    const h = omni ? Math.ceil(omni.getBoundingClientRect().height) : 84;
    document.documentElement.style.setProperty('--omnibox-h', `${h}px`);
  }
  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  setTimeout(update, 0);
})();

(function () {
  // ===== Contexte BlackBay (thème/largeur) ==================================
  document.body.classList.add('route-blackbay');
  const root = document.querySelector('.bb');
  const cleanup = () => document.body.classList.remove('route-blackbay');
  const obs = new MutationObserver(() => {
    if (root && !document.body.contains(root)) { cleanup(); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // ===== Constantes & Utils ==================================================
  const $  = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));
  const INV = 'nui://qb-inventory/html/images/';

  const CART_KEY = 'bb:cart';
  const getCart = () => {
    try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); }
    catch { return []; }
  };
  const setCart = (arr) => sessionStorage.setItem(CART_KEY, JSON.stringify(arr));
  const sumQty  = (cart) => cart.reduce((n, it) => n + (Number(it.qty)||0), 0);
  const priceNum = (p) => typeof p === 'number' ? p : Number(String(p).replace(/[^\d.]/g,'')) || 0;
  const fmtUSD = (n) => `USD $${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  // Always show "Panier (N)" even when 0; use [data-cart-count] if present, else fallback.
  function updateCartBadge() {
    const n = sumQty(getCart());
    const badge = document.querySelector('[data-cart-count]');
    if (badge) {
      badge.textContent = String(n);
    }
    const cartLink = document.querySelector('.bbSub__cart');
    if (cartLink) {
      if (!badge) {
        cartLink.innerHTML = `Panier (<span data-cart-count>${n}</span>)`;
      }
      cartLink.style.color = 'var(--bb-accent)';
    }
  }

  // ===== Données =============================================================
  // Cocaïne (avec l’item ajouté "Chaudron")
  const COCAINE = [
    {
      id: 'cocaseed', img: 'cocaseed.png',
      title: 'Graine de coca',
      desc: 'Graine pour faire pousser la feuille de coca.',
      price: 10
    },
    {
      id: 'emptybag', img: 'emptybag.png',
      title: 'Pochon',
      desc: 'Pochon pour ranger de la drogue ou autre.',
      price: 10
    },
    {
      id: 'jerrycan', img: 'jerrycan.png',
      title: "Jerrican d’essence",
      desc: "Jerrican d’essence préparé chimiquement pour la cocaïne.",
      price: 50
    },
    {
      id: 'rtxpress', img: 'small_crate.png',
      title: 'Presse à drogues',
      desc: 'Presse pour compresser la drogue, pratique pour le transport.',
      price: 150
    },
    {
      id: 'rtxcauldron', img: 'small_crate.png',
      title: 'Chaudron',
      desc: "Avec un mélange de feuilles de coca et de notre essence chimique, réussite garantie… ou un bon cassoulet.",
      price: 150
    }
  ];

  // Méthamphétamine
  const METH = [
    {
      id: 'rtxmixingtable', img: 'small_crate.png',
      title: 'Table de mélange',
      desc: 'Table professionnelle de mélange chimique.',
      price: 500
    },
    {
      id: 'rtxmethchiller', img: 'small_crate.png',
      title: 'Refroidisseur',
      desc: 'Refroidisseur professionnel, très basse température.',
      price: 500
    },
    {
      id: 'iodine', img: 'iodine.png',
      title: 'Iode',
      desc: "Élément chimique (Z=53) utilisé dans la préparation de méthamphétamine.",
      price: 15
    },
    {
      id: 'redphosphor', img: 'redphosphor.png',
      title: 'Phosphore rouge',
      desc: "Allotrope amorphe du phosphore utilisé pour les allumettes… et la méthamphétamine.",
      price: 15
    },
    {
      id: 'acetone', img: 'acetone.png',
      title: 'Acétone',
      desc: "Cétone simple, solvant courant pour la fabrication de méthamphétamine.",
      price: 15
    },
    {
      id: 'pills', img: 'pills.png',
      title: 'Pilules',
      desc: 'Composition secrète — qualité garantie.',
      price: 5
    }
  ];

  // ===== Rendu produits (structure alignée au CSS fourni) ===================
  const content = $('#bb-content');

  function itemCardHTML(it) {
    return `
      <article class="bbItem" data-id="${it.id}">
        <div class="bbItem__imgWrap">
          <img class="bbItem__img" src="${INV}${it.img}" alt="">
        </div>

        <h3 class="bbItem__title">${it.title}</h3>
        <p class="bbItem__desc">${it.desc}</p>

        <div class="bbItem__foot">
          <div class="bbItem__price">${fmtUSD(it.price)}</div>
          <div class="bbItem__actions">
            <div class="qty" aria-label="Quantité">
              <button class="qty__btn" data-act="minus" type="button">−</button>
              <div class="qty__val" data-val>1</div>
              <button class="qty__btn" data-act="plus" type="button">+</button>
            </div>
            <button class="bbItem__add" type="button">Add</button>
          </div>
        </div>
      </article>
    `;
  }

  function render(list) {
    if (!content) return;
    if (!list?.length) {
      content.innerHTML = `<div class="bbDrug__placeholder">Aucun produit pour le moment.</div>`;
      return;
    }
    content.innerHTML = `<div class="bbList">${list.map(itemCardHTML).join('')}</div>`;
  }

  // ===== Interactions carte (qty / add) =====================================
  function addToCart(id, qty, catalogue) {
    const item = catalogue.find(x => String(x.id) === String(id));
    if (!item) return;
    const cart = getCart();
    const i = cart.findIndex(x => String(x.id) === String(id));
    if (i === -1) {
      cart.push({ id: item.id, title: item.title, img: item.img, price: item.price, qty: qty });
    } else {
      cart[i].qty = (Number(cart[i].qty) || 0) + qty;
    }
    setCart(cart);
    updateCartBadge(); // <= badge en live, y compris 0 → N
  }

  if (content) {
    content.addEventListener('click', (e) => {
      const card = e.target.closest('.bbItem');
      if (!card) return;

      // quantité
      const valEl = $('[data-val]', card);
      if (e.target.closest('[data-act="plus"]')) {
        valEl.textContent = String(Math.min(99, (Number(valEl.textContent)||1) + 1));
        return;
      }
      if (e.target.closest('[data-act="minus"]')) {
        valEl.textContent = String(Math.max(1, (Number(valEl.textContent)||1) - 1));
        return;
      }

      // add
      if (e.target.closest('.bbItem__add')) {
        const id  = card.dataset.id;
        const qty = Math.max(1, Number(valEl.textContent) || 1);
        // Choisit le bon catalogue selon l’onglet
        const activeSub = $('.bbSub__tab--active a')?.dataset.sub || 'cocaine';
        const catalogue = activeSub === 'meth' ? METH : COCAINE;
        addToCart(id, qty, catalogue);
      }
    });
  }

  // ===== Routing navs ========================================================
  // Principale (garde Drogues actif)
  const tabs = $('#bb-tabs');
  if (tabs) {
    tabs.querySelectorAll('.bb__tab').forEach(li => li.classList.remove('bb__tab--active'));
    const drog = $('[data-tab="drogues"]', tabs);
    if (drog) drog.parentElement.classList.add('bb__tab--active');

    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]');
      if (!a) return;
      e.preventDefault();
      const t = a.dataset.tab;
      if (t === 'drogues') return;
      if (t === 'armes')  return window.OnionRouter.go('blackbay_armes');
      if (t === 'marche') return window.OnionRouter.go('blackbay'); // placeholder
      if (t === 'marche'  && window.OnionRouter) return window.OnionRouter.go('blackbay'); // placeholder
    });
  }

  // Sous-nav : Cocaïne / Méthamphétamine / Panier
  const sub = $('#bb-subtabs');
  if (sub) {
    sub.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-sub], .bbSub__cart');
      if (!a) return;
      e.preventDefault();

      // Panier (à droite)
      if (a.classList.contains('bbSub__cart') || a.dataset.sub === 'cart') {
        if (window.OnionRouter) window.OnionRouter.go('blackbay_cart');
        return;
      }

      // Active l’onglet demandé
      sub.querySelectorAll('.bbSub__tab').forEach(li => li.classList.remove('bbSub__tab--active'));
      if (a.parentElement && a.parentElement.classList.contains('bbSub__tab')) {
        a.parentElement.classList.add('bbSub__tab--active');
      }

      // Rendu
      if (a.dataset.sub === 'meth') {
        render(METH);
      } else {
        render(COCAINE);
      }
    });
  }

  // Clic direct sur "Panier (N)" si hors de #bb-subtabs (sécurité)
  document.querySelector('.bbSub__cart')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.OnionRouter?.go('blackbay_cart');
  });

  // ===== Démarrage : Cocaïne active par défaut ==============================
  updateCartBadge(); // <= affiche Panier (0) à vide
  // Marque l’onglet "Cocaïne" actif si pas déjà marqué dans ton HTML
  const cokeLi = $('.bbSub__tab a[data-sub="cocaine"]')?.parentElement;
  if (cokeLi && !cokeLi.classList.contains('bbSub__tab--active')) {
    cokeLi.classList.add('bbSub__tab--active');
  }
  render(COCAINE);
})();
