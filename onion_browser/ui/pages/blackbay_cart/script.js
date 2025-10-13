// ui/pages/blackbay_cart/script.js
(function () {
  // ===== Contexte BlackBay =====
  document.body.classList.add('route-blackbay');
  const root = document.querySelector('.bb');
  const cleanup = () => document.body.classList.remove('route-blackbay');
  const obs = new MutationObserver(() => {
    if (root && !document.body.contains(root)) { cleanup(); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // ===== Utils =====
  const $  = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));
  const CART_KEY = 'bb:cart';
  const getCart = () => { try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); } catch { return []; } };
  const setCart = (arr) => sessionStorage.setItem(CART_KEY, JSON.stringify(arr));
  const sumQty  = (cart) => cart.reduce((n, it) => n + (Number(it.qty)||0), 0);
  const priceNum = (p) => typeof p === 'number' ? p : Number(String(p).replace(/[^\d.]/g,'')) || 0;
  const fmtUSD = (n) => `USD $${Number(n).toLocaleString('en-US',{minimumFractionDigits:0})}`;
  const INV = 'nui://qb-inventory/html/images/';
  const imgSrc = (f) => `${INV}${f}`;

  // met à jour "Panier (N)" dans la sous-nav
  function updateCartBadge() {
    const c = sumQty(getCart());
    const badge = $('#cart-count');
    if (badge) badge.textContent = String(c);
  }

  // ===== DOM =====
  const listEl   = $('#bb-list');
  const emptyEl  = $('#bb-empty');
  const totalQty = $('#bb-total-qty');
  const totalAmt = $('#bb-total-amt');
  const btnClear = $('#bb-cart-clear');
  const btnBack  = $('#bb-cart-back');

  // ===== Rendu =====
  function render() {
    const cart = getCart();
    updateCartBadge();

    const qty = sumQty(cart);
    const amt = cart.reduce((s, it) => s + priceNum(it.price) * (Number(it.qty)||0), 0);

    if (totalQty) totalQty.textContent = String(qty);
    if (totalAmt) totalAmt.textContent = fmtUSD(amt);

    if (!listEl) return;
    if (!cart.length) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = cart.map(it => {
      const p = priceNum(it.price);
      const sub = p * (Number(it.qty)||0);
      const title = it.title || it.name || it.id;
      const desc  = it.desc  || '';
      const img   = it.img || it.image || `${it.id}.png`;
      return `
        <div class="bbCart__item" data-id="${it.id}">
          <div class="bbCart__imgWrap"><img class="bbCart__img" src="${imgSrc(img)}" alt=""></div>
          <div class="bbCart__text">
            <h4>${title}</h4>
            ${desc ? `<div class="desc">${desc}</div>` : ''}
            <div class="price">${fmtUSD(p)}</div>
          </div>
          <div class="bbCart__actions">
            <div class="qty">
              <button class="qty__btn" data-act="minus" type="button">−</button>
              <div class="qty__val" data-val>${Number(it.qty)||0}</div>
              <button class="qty__btn" data-act="plus" type="button">+</button>
            </div>
            <div class="bbCart__sum">${fmtUSD(sub)}</div>
            <button class="bbCart__rm" data-act="rm" type="button">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ===== Actions =====
  function changeQty(id, delta) {
    const cart = getCart();
    const i = cart.findIndex(x => String(x.id) === String(id));
    if (i === -1) return;
    cart[i].qty = Math.max(0, (Number(cart[i].qty)||0) + delta);
    if (cart[i].qty === 0) cart.splice(i, 1);
    setCart(cart);
    render();
  }
  function removeItem(id) {
    const cart = getCart().filter(x => String(x.id) !== String(id));
    setCart(cart); render();
  }

  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const row = e.target.closest('.bbCart__item');
      if (!row) return;
      const id = row.dataset.id;

      const btnPlus  = e.target.closest('[data-act="plus"]');
      const btnMinus = e.target.closest('[data-act="minus"]');
      const btnRm    = e.target.closest('[data-act="rm"]');

      if (btnPlus)  return changeQty(id, +1);
      if (btnMinus) return changeQty(id, -1);
      if (btnRm)    return removeItem(id);
    });
  }

  if (btnClear) btnClear.addEventListener('click', () => { setCart([]); render(); });
  if (btnBack)  btnBack.addEventListener('click', () => { if (window.OnionRouter) window.OnionRouter.go('blackbay_drogues'); });

  // ===== Routing navs =====
  const tabs = $('#bb-tabs');
  if (tabs) {
    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]');
      if (!a) return;
      e.preventDefault();
      const t = a.dataset.tab;
      if (t === 'drogues' && window.OnionRouter) return window.OnionRouter.go('blackbay_drogues');
      if (t === 'armes'   && window.OnionRouter) return window.OnionRouter.go('blackbay'); // placeholder
      if (t === 'marche'  && window.OnionRouter) return window.OnionRouter.go('blackbay'); // placeholder
    });
  }

  const sub = $('#bb-subtabs');
  if (sub) {
    sub.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-sub]');
      if (!a) return;
      e.preventDefault();
      if (a.dataset.sub === 'cocaine' && window.OnionRouter) return window.OnionRouter.go('blackbay_drogues');
      if (a.dataset.sub === 'meth'    && window.OnionRouter) return window.OnionRouter.go('blackbay_drogues'); // la page gère l’onglet
    });
  }

  // ===== Ajuste le padding bas selon l’omnibox/footer =====
  (function syncOmniboxPadding(){
    function update(){
      const omni = document.getElementById('omnibox') ||
        document.querySelector('.omnibox, .onion-omnibox, .search-bar, .lb-omnibox, .addressbar, .address-bar, #addressbar, #searchbar, #addressBar');
      const h = omni ? Math.ceil(omni.getBoundingClientRect().height) : 84;
      document.documentElement.style.setProperty('--omnibox-h', `${h}px`);
    }
    window.addEventListener('resize', update);
    window.addEventListener('load', update);
    setTimeout(update,0);
  })();

  // Première peinture
  render();
})();
