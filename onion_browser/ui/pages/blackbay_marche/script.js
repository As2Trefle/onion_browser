(function () {
  // Mesure omnibox (via router) au mount
  setTimeout(() => window.OnionRouter?.measureOmnibox?.(), 0);

  document.body.classList.add('route-blackbay');
  const root = document.querySelector('.bb');
  const cleanup = () => document.body.classList.remove('route-blackbay');
  const obs = new MutationObserver(() => {
    if (root && !document.body.contains(root)) { cleanup(); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // Utils
  const $  = (s, p=document) => p.querySelector(s);
  const INV = 'nui://qb-inventory/html/images/';
  const CART_KEY = 'bb:cart';
  const getCart = () => { try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); } catch { return []; } };
  const setCart = (arr) => sessionStorage.setItem(CART_KEY, JSON.stringify(arr));
  const sumQty  = (cart) => cart.reduce((n, it) => n + (Number(it.qty)||0), 0);
  const fmtUSD  = (n) => `USD $${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  function updateCartBadge() {
    const n = sumQty(getCart());
    const badge = document.querySelector('[data-cart-count]');
    if (badge) badge.textContent = String(n);
  }

  // --- Données ---
  const MARKET = [
    { id:'cutter',         img:'cutter.png',         title:'Tournette coupe verre',           desc:'Permet de couper du verre, même les plus épais — un vrai outil de pro.',   price:2000 },
    { id:'drill',          img:'drill.png',          title:'Perceuse professionnelle',        desc:'Perce même les coffres les plus résistants.',                              price:3000 },
    { id:'saw ',           img:'saw.png',            title:'Découpeuse Thermique',            desc:"Permet de couper des petits coffres.",                                     price:2000 },
    { id:'thermite_bomb',  img:'thermal_charge.png', title:'Charge thermique',                desc:'Fait fondre les serrures métalliques.',                                    price:350 },
    { id:'c4_bomb',        img:'c4_bomb.png',        title:'C4',                              desc:'Quand la charge thermique ne suffit plus… attention les oreilles.',        price:450 },
    { id:'laptop',         img:'laptop.png',         title:'Ordinateur portable crypté',      desc:'Ordinateur crypté, conçu pour une grande discrétion.',                     price:600 },
    { id:'trojan_usb',     img:'usb_device.png',     title:'Clé USB Trojan',                  desc:"Contient un logiciel capable de cracker n'importe quelle sécurité.",       price:150 },
  ];

  const ANNONCES = [];   // vide pour le moment
  const MES_VENTES = []; // placeholder

  // --- Rendu items ---
  const content = $('#bb-content');

  const card = (it) => `
    <article class="bbItem" data-id="${it.id}">
      <div class="bbItem__imgWrap"><img class="bbItem__img" src="${INV}${it.img}" alt=""></div>
      <h3 class="bbItem__title">${it.title}</h3>
      <p class="bbItem__desc">${it.desc || ''}</p>
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

  function render(list, emptyText='Aucun item.') {
    if (!content) return;
    if (!list || !list.length) {
      content.innerHTML = `<div class="bbEmpty">${emptyText}</div><div class="bbBottomSpacer" aria-hidden="true"></div>`;
      return requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
    }
    content.innerHTML = `<div class="bbList">${list.map(card).join('')}</div><div class="bbBottomSpacer" aria-hidden="true"></div>`;
    requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
  }

  // --- Filtre texte (barre sous la sous-nav) ---
  const filterBar  = $('#bb-filterbar');
  const filterInput = $('#bb-filter-input');

  const norm = (s='') => s
    .toString().toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu,''); // enlève les accents

  function applyFilter() {
    const q = norm(filterInput?.value || '');
    if (!q) return render(MARKET);
    const list = MARKET.filter(it =>
      norm(it.title).includes(q) ||
      norm(it.id).includes(q) ||
      norm(it.desc || '').includes(q)
    );
    render(list, 'Aucun résultat pour votre recherche.');
  }

  filterInput?.addEventListener('input', applyFilter);

  // --- Interactions cartes / panier ---
  function addToCart(id, qty, catalogue) {
    const it = catalogue.find(x => String(x.id) === String(id));
    if (!it) return;
    const cart = getCart();
    const i = cart.findIndex(x => String(x.id) === String(id));
    if (i === -1) cart.push({ id:it.id, title:it.title, img:it.img, price:it.price, qty });
    else cart[i].qty = (Number(cart[i].qty)||0) + qty;
    setCart(cart); updateCartBadge();
  }

  content?.addEventListener('click', (e) => {
    const cardEl = e.target.closest('.bbItem'); if (!cardEl) return;
    const val = cardEl.querySelector('[data-val]');
    if (e.target.closest('[data-act="plus"]')) { val.textContent = String(Math.min(99,(+val.textContent||1)+1)); return; }
    if (e.target.closest('[data-act="minus"]')) { val.textContent = String(Math.max(1,(+val.textContent||1)-1)); return; }
    if (e.target.closest('.bbItem__add')) {
      const active = document.querySelector('.bbSub__tab--active a')?.dataset.sub || 'market';
      const cat = active === 'market' ? MARKET : (active === 'ventes' ? MES_VENTES : ANNONCES);
      addToCart(cardEl.dataset.id, Math.max(1, Number(val.textContent)||1), cat);
    }
  });

  // --- Routing nav principale ---
  const tabs = $('#bb-tabs');
  if (tabs) {
    tabs.querySelectorAll('.bb__tab').forEach(li => li.classList.remove('bb__tab--active'));
    tabs.querySelector('[data-tab="marche"]')?.parentElement?.classList.add('bb__tab--active');
    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]'); if (!a) return; e.preventDefault();
      const t = a.dataset.tab;
      if (t === 'drogues') return window.OnionRouter?.go('blackbay_drogues');
      if (t === 'armes')   return window.OnionRouter?.go('blackbay_armes');
      if (t === 'marche')  return; // déjà dessus
    });
  }

  // --- Sous-nav + bascule des vues ---
  const sub = $('#bb-subtabs');
  function showFilterBar(visible) {
    if (!filterBar) return;
    filterBar.classList.toggle('is-hidden', !visible);
  }

  if (sub) {
    sub.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-sub], .bbSub__cart'); if (!a) return; e.preventDefault();

      if (a.classList.contains('bbSub__cart') || a.dataset.sub === 'cart')
        return window.OnionRouter?.go('blackbay_cart');

      sub.querySelectorAll('.bbSub__tab').forEach(li => li.classList.remove('bbSub__tab--active'));
      a.parentElement?.classList.add('bbSub__tab--active');

      if (a.dataset.sub === 'market') {
        showFilterBar(true);
        applyFilter(); // applique la recherche en cours
      } else if (a.dataset.sub === 'annonces') {
        showFilterBar(false);
        render(ANNONCES, 'Aucune annonce pour le moment.');
      } else { // ventes
        showFilterBar(false);
        render(MES_VENTES, 'Vous n’avez pas encore de ventes actives.');
      }
    });
  }

  // Panier direct
  document.querySelector('.bbSub__cart')?.addEventListener('click', (e) => {
    e.preventDefault(); window.OnionRouter?.go('blackbay_cart');
  });

  // --- Start : Marché actif par défaut ---
  updateCartBadge();
  showFilterBar(true);
  render(MARKET);
})();
