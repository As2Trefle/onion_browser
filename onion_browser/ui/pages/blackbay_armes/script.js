// -- mesure omnibox (comme Drogues)
(function syncOmniboxPadding() {
  function update() {
    const omni =
      document.getElementById('omnibox') ||
      document.querySelector('.omnibox, .onion-omnibox, .search-bar, .lb-omnibox, .addressbar, .address-bar, #addressbar, #searchbar, #addressBar');
    const h = omni ? Math.ceil(omni.getBoundingClientRect().height) : 84;
    document.documentElement.style.setProperty('--omnibox-h', `${h}px`);
  }
  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  setTimeout(update, 0);
})();

(function () {
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
  const MATERIAUX = [
    { id:'metal_scrap', img:'metalscrap.png', title:'Morceau de métal',    desc:'Un morceau de métal — on peut faire plein de choses avec.', price:2 },
    { id:'plastic',     img:'plastic.png',     title:'Morceau de plastique', desc:'Un morceau de plastique — « RECYCLEZ ! » (Greta Thunberg, 2019).', price:2 },
  ];

  // Pièces détaché — avec "gun" pour filtrer
  const PIECES = [
    // AK47
    { id:'ak47part1', img:'top.png',      title:'Couvercle supérieur AK47', desc:"Pièce supérieure de l’AK47.", price:1500, gun:'AK47' },
    { id:'ak47part2', img:'receiver.png', title:"Culasse d'AK47",           desc:"Culasse de l’AK47.",          price:1500, gun:'AK47' },
    { id:'ak47part3', img:'buttstuck.png',title:"Crosse d'AK47",            desc:"Crosse de l’AK47.",           price:1500, gun:'AK47' },
    { id:'akpart4',   img:'barrel.png',   title:"Canon d'AK47",             desc:"Canon de l’AK47.",            price:1500, gun:'AK47' },

    // AKU
    { id:'akupart1', img:'top.png',      title:'Couvercle supérieur compact AKU', desc:"Couvercle supérieur compact de l’AKU.", price:1500, gun:'AKU' },
    { id:'akupart2', img:'receiver.png', title:'Culasse compact AKU',              desc:"Culasse compacte de l’AKU.",           price:1500, gun:'AKU' },
    { id:'akupart3', img:'barrel.png',   title:'Canon compact AKU',                desc:"Canon compact de l’AKU.",              price:1500, gun:'AKU' },
  ];

  // --- Rendu (identique Drogues) ---
  const content = $('#bb-content');

  const itemCardHTML = (it) => `
    <article class="bbItem" data-id="${it.id}">
      <div class="bbItem__imgWrap">
        <img class="bbItem__img" src="${INV}${it.img}" alt="">
      </div>

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

  function render(list) {
    if (!content) return;
    if (!list || !list.length) {
      content.innerHTML = `<div class="bbEmpty">Aucun produit pour le moment.</div><div class="bbBottomSpacer" aria-hidden="true"></div>`;
      // petit recalcul après insertion
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      return;
    }
    content.innerHTML = `<div class="bbList">${list.map(itemCardHTML).join('')}</div><div class="bbBottomSpacer" aria-hidden="true"></div>`;
    // recalcul après insertion des images
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  // --- Filtrage pièces ---
  const filterWrap = $('#bb-filter-wrap');
  const filterSel  = $('#bb-filter');

  function setFilterVisible(visible) {
    if (!filterWrap) return;
    filterWrap.classList.toggle('is-hidden', !visible);
    filterWrap.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function getFilteredPieces() {
    const val = (filterSel?.value || 'all');
    if (val === 'all') return PIECES;
    return PIECES.filter(p => p.gun === val);
  }

  // --- Interactions (qty / add) ---
  function addToCart(id, qty, catalogue) {
    const item = catalogue.find(x => String(x.id) === String(id));
    if (!item) return;
    const cart = getCart();
    const i = cart.findIndex(x => String(x.id) === String(id));
    if (i === -1) cart.push({ id:item.id, title:item.title, img:item.img, price:item.price, qty });
    else cart[i].qty = (Number(cart[i].qty)||0) + qty;
    setCart(cart);
    updateCartBadge();
  }

  content?.addEventListener('click', (e) => {
    const card = e.target.closest('.bbItem');
    if (!card) return;
    const val = card.querySelector('[data-val]');

    if (e.target.closest('[data-act="plus"]')) {
      val.textContent = String(Math.min(99, (Number(val.textContent)||1) + 1));
      return;
    }
    if (e.target.closest('[data-act="minus"]')) {
      val.textContent = String(Math.max(1, (Number(val.textContent)||1) - 1));
      return;
    }
    if (e.target.closest('.bbItem__add')) {
      const active = document.querySelector('.bbSub__tab--active a')?.dataset.sub || 'materiaux';
      const catalogue = active === 'pieces' ? getFilteredPieces() : MATERIAUX;
      const id  = card.dataset.id;
      const qty = Math.max(1, Number(val.textContent)||1);
      addToCart(id, qty, catalogue);
    }
  });

  // --- Routing navs ---
  // Nav principale
  const tabs = $('#bb-tabs');
  if (tabs) {
    tabs.querySelectorAll('.bb__tab').forEach(li => li.classList.remove('bb__tab--active'));
    tabs.querySelector('[data-tab="armes"]')?.parentElement?.classList.add('bb__tab--active');

    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]');
      if (!a) return;
      e.preventDefault();
      const t = a.dataset.tab;
      if (t === 'drogues') return window.OnionRouter?.go('blackbay_drogues');
      if (t === 'marche')  return window.OnionRouter?.go('blackbay'); // placeholder
    });
  }

  // Sous-nav (Matériaux / Pièces / Panier + Filtre)
  const sub = $('#bb-subtabs');
  if (sub) {
    sub.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-sub], .bbSub__cart');
      if (!a) return;
      e.preventDefault();

      if (a.classList.contains('bbSub__cart') || a.dataset.sub === 'cart') {
        return window.OnionRouter?.go('blackbay_cart');
      }

      sub.querySelectorAll('.bbSub__tab').forEach(li => li.classList.remove('bbSub__tab--active'));
      a.parentElement?.classList.add('bbSub__tab--active');

      if (a.dataset.sub === 'pieces') {
        setFilterVisible(true);
        render(getFilteredPieces());
      } else {
        setFilterVisible(false);
        render(MATERIAUX);
      }
    });
  }

  // Changement du filtre => re-render des pièces
  filterSel?.addEventListener('change', () => {
    const active = document.querySelector('.bbSub__tab--active a')?.dataset.sub || 'materiaux';
    if (active === 'pieces') render(getFilteredPieces());
  });

  // Panier (sécurité clic direct)
  document.querySelector('.bbSub__cart')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.OnionRouter?.go('blackbay_cart');
  });

  // Start : Matériaux par défaut, filtre caché
  setFilterVisible(false);
  updateCartBadge();
  render(MATERIAUX);
})();
