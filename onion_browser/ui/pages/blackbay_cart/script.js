(function () {
  setTimeout(() => window.OnionRouter?.measureOmnibox?.(), 0);

  document.body.classList.add('route-blackbay');
  const root = document.querySelector('.bb');
  const cleanup = () => document.body.classList.remove('route-blackbay');
  const obs = new MutationObserver(() => {
    if (root && !document.body.contains(root)) { cleanup(); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  const $  = (s, p=document) => p.querySelector(s);
  const INV = 'nui://qb-inventory/html/images/';
  const CART_KEY   = 'bb:cart';
  const ORDER_CAP  = 100;

  const getCart = () => { try { return JSON.parse(sessionStorage.getItem(CART_KEY)   || '[]'); } catch { return []; } };
  const setCart = (arr) => sessionStorage.setItem(CART_KEY,   JSON.stringify(arr||[]));
  const priceNum = (p) => typeof p === 'number' ? p : Number(String(p).replace(/[^\d.]/g,'')) || 0;
  const fmtUSD   = (n) => `USD $${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  const nowISO   = () => new Date().toISOString();

  async function nui(event, data) {
    try {
      const res = await fetch(`https://onion_browser/${event}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data || {})
      });
      return await res.json();
    } catch { return null; }
  }

  function flash(msg, kind='ok') {
    const node = document.createElement('div');
    node.className = `bbFlash bbFlash--${kind}`;
    node.textContent = msg;
    container.prepend(node);
    setTimeout(() => node.classList.add('is-shown'), 10);
    setTimeout(() => node.classList.remove('is-shown'), 2200);
    setTimeout(() => node.remove(), 2600);
  }

  const container = $('#bb-cart');
  const subtabs   = $('#bb-subtabs');
  const tabs      = $('#bb-tabs');

  // ---------- PANIER
  function renderCartView() {
    const cart = getCart();
    const n = cart.reduce((a, it) => a + (Number(it.qty) || 0), 0);
    const total = cart.reduce((a, it) => a + (priceNum(it.price) * (Number(it.qty)||0)), 0);

    if (!cart.length) {
      container.innerHTML = `
        <div class="bbEmpty">Votre panier est vide.</div>
        <div class="bbBottomSpacer" aria-hidden="true"></div>
      `;
      requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
      const badge = document.querySelector('[data-cart-count]');
      if (badge) badge.textContent = '0';
      return;
    }

    const itemsHTML = cart.map(it => `
      <article class="bbCartItem" data-id="${it.id}">
        <div class="bbCartItem__imgWrap">
          <img class="bbCartItem__img" src="${INV}${it.img}" alt="">
        </div>
        <div class="bbCartItem__main">
          <h3 class="bbCartItem__title">${it.title}</h3>
          <p class="bbCartItem__desc"></p>
          <div class="bbCartItem__foot">
            <div class="qty" aria-label="Quantité">
              <button class="qty__btn" data-act="minus" type="button">−</button>
              <div class="qty__val" data-val>${Math.max(1, Number(it.qty)||1)}</div>
              <button class="qty__btn" data-act="plus" type="button">+</button>
            </div>
            <button class="bbBtnRemove" data-act="remove" type="button">Remove</button>
            <div class="bbCartItem__total">${fmtUSD(priceNum(it.price) * (Number(it.qty)||0))}</div>
          </div>
        </div>
      </article>
    `).join('');

    const totalsHTML = `
      <div class="bbTotals bbTotals--glass" id="bb-totals">
        <div class="bbTotals__left">
          <div><b>Articles :</b> <span data-sum-items>${n}</span></div>
          <div><b>Total :</b> <span data-sum-amount>${fmtUSD(total)}</span></div>
        </div>
        <div class="bbTotals__actions">
          <button type="button" class="bbBtn bbBtn--ghost" data-act="clear">Vider</button>
          <button type="button" class="bbBtn" data-act="continue">Continuer</button>
          <button type="button" class="bbBtn bbBtn--accent" data-act="order">Commander</button>
        </div>
      </div>
      <div class="bbBottomSpacer" aria-hidden="true"></div>
    `;

    container.innerHTML = itemsHTML + totalsHTML;
    requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
  }

  // ---------- MES COMMANDES (depuis BDD) + bouton Détails
  async function renderOrdersView() {
    const resp = await nui('blackbay:orders:list');
    const orders = (resp && resp.ok && resp.orders) ? resp.orders : [];

    if (!orders.length) {
      container.innerHTML = `
        <div class="bbOrders bbOrders--empty">
          <div class="bbEmpty">Aucune commande pour le moment.</div>
        </div>
        <div class="bbBottomSpacer" aria-hidden="true"></div>
      `;
      requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
      return;
    }

    const listHTML = orders.map(o => {
      const items = (o.items || []).map(it => `
        <li class="bbOrderLine">
          <div class="bbOrderLine__left">
            <img src="${INV}${it.img}" alt="">
            <div class="bbOrderLine__txt">
              <b>${it.title || it.id}</b>
              <span>x${Number(it.qty)||0}</span>
            </div>
          </div>
          <div class="bbOrderLine__price">${fmtUSD((Number(it.price)||0) * (Number(it.qty)||0))}</div>
        </li>
      `).join('');

      return `
        <article class="bbOrdersItem" data-oid="${o.id}" data-chunk="${o.chunk}">
          <div class="bbOrdersItem__head">
            <div class="bbOrdersItem__id">Commande <b>#${o.id}</b><span class="bbChunk">${o.chunk > 1 ? (' • Lot '+o.chunk) : ''}</span></div>
            <div class="bbOrdersItem__date">${new Date(o.date || nowISO()).toLocaleString()}</div>
          </div>
          <div class="bbOrdersItem__body">
            <div class="bbOrdersItem__line"><b>Articles:</b> ${o.count}</div>
            <div class="bbOrdersItem__line"><b>Total:</b> ${fmtUSD(o.total)}</div>
            <div class="bbOrdersItem__line"><b>Statut:</b> <span class="bbBadge">${o.status || 'En attente'}</span></div>
          </div>
          <div class="bbOrdersItem__foot">
            <button class="bbBtn bbBtn--ghost bbBtn--sm" data-act="details">Détails</button>
            ${(o.status && String(o.status).toLowerCase() !== 'pending' && String(o.status).toLowerCase() !== 'en attente')
              ? ''
              : '<button class="bbBtn bbBtn--airdrop bbBtn--sm" data-act="airdrop">Airdrop</button>'}
          </div>
          <div class="bbOrdersItem__details" hidden>
            <ul class="bbOrderLines">${items}</ul>
          </div>
        </article>
      `;
    }).join('');

    container.innerHTML = `<div class="bbOrders">${listHTML}</div><div class="bbBottomSpacer" aria-hidden="true"></div>`;
    requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
  }

// ---------- Actions
container.addEventListener('click', async (e) => {
  const card = e.target.closest('.bbCartItem');
  if (card) {
    const id = card.dataset.id;
    const val = card.querySelector('[data-val]');

    if (e.target.closest('[data-act="plus"]')) {
      val.textContent = String(Math.min(99, (Number(val.textContent)||1) + 1));
    } else if (e.target.closest('[data-act="minus"]')) {
      val.textContent = String(Math.max(1, (Number(val.textContent)||1) - 1));
    } else if (e.target.closest('[data-act="remove"]')) {
      const cart = getCart().filter(x => String(x.id) !== String(id));
      setCart(cart); renderCartView(); return;
    }

    if (e.target.closest('[data-act="plus"], [data-act="minus"]')) {
      const cart = getCart();
      const i = cart.findIndex(x => String(x.id) === String(id));
      if (i !== -1) {
        cart[i].qty = Math.max(1, Number(val.textContent)||1);
        setCart(cart); renderCartView();
      }
      return;
    }
  }

  // Détails commande
  if (e.target.closest('[data-act="details"]')) {
    const wrap = e.target.closest('.bbOrdersItem')?.querySelector('.bbOrdersItem__details');
    if (wrap) wrap.hidden = !wrap.hidden;
    return;
  }

  // Airdrop (planifie la mission + passe la commande à "en cours")
  if (e.target.closest('[data-act="airdrop"]')) {
    const card = e.target.closest('.bbOrdersItem');
    const oid  = card?.dataset?.oid;
    if (!oid) return;

    const btn = e.target.closest('[data-act="airdrop"]');
    btn.disabled = true;

    const resp = await nui('blackbay:orders:airdrop', { order_uid: oid });

    if (resp && resp.ok) {
      // MAJ visuelle
      const badge = card.querySelector('.bbBadge');
      if (badge) badge.textContent = 'en cours';
      btn.remove();
    } else {
      btn.disabled = false;
      flash("Impossible de planifier l'airdrop.", 'warn');
    }
    return;
  }

  // Totals actions
  if (e.target.closest('[data-act="clear"]')) { setCart([]); renderCartView(); e.preventDefault(); return; }
  if (e.target.closest('[data-act="continue"]')) { window.OnionRouter?.go('blackbay_drogues'); e.preventDefault(); return; }

  if (e.target.closest('[data-act="order"]')) {
    const cart = getCart();
    if (!cart.length) { flash('Votre panier est vide.', 'warn'); return; }

    const norm = cart.map(it => ({
      id: it.id, title: it.title, img: it.img,
      price: priceNum(it.price), qty: Math.max(1, Number(it.qty)||1),
      src: it.src || 'unknown'
    }));
    const totalQty = norm.reduce((a, it) => a + (Number(it.qty)||0), 0);

    let confirmLarge = false;
    if (totalQty > ORDER_CAP) {
      const resp = await nui('blackbay:confirmLarge', { total: totalQty, cap: ORDER_CAP });
      if (!resp || !resp.ok) return;
      confirmLarge = true;
    }

    const resp = await nui('blackbay:order:place', { items: norm, confirmLarge });

    if (!resp || resp.ok !== true) {
      if (resp && resp.reason === 'need_confirm_split') {
        const again = await nui('blackbay:confirmLarge', { total: resp.totalQty || totalQty, cap: resp.cap || ORDER_CAP });
        if (!again || !again.ok) return;
        const resp2 = await nui('blackbay:order:place', { items: norm, confirmLarge: true });
        if (!resp2 || resp2.ok !== true) { flash('Commande refusée.', 'warn'); return; }
        setCart([]); selectSub('orders'); renderOrdersView(); return;
      }
      if (resp && resp.reason === 'not_authorized') { return; }
      flash('Erreur lors de la commande.', 'warn'); return;
    }

    setCart([]);
    selectSub('orders'); renderOrdersView();
  }
});

  // ---------- Tabs
  if (tabs) {
    tabs.querySelectorAll('.bb__tab').forEach(li => li.classList.remove('bb__tab--active'));
    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]'); if (!a) return; e.preventDefault();
      const t = a.dataset.tab;
      if (t === 'drogues') return window.OnionRouter?.go('blackbay_drogues');
      if (t === 'armes')   return window.OnionRouter?.go('blackbay_armes');
      if (t === 'marche')  return window.OnionRouter?.go('blackbay_marche');
    });
  }

  function selectSub(which) {
    subtabs.querySelectorAll('.bbSub__tab').forEach(li => li.classList.remove('bbSub__tab--active'));
    const link = subtabs.querySelector(`a[data-sub="${which}"]`);
    link?.parentElement?.classList.add('bbSub__tab--active');
  }
  subtabs?.addEventListener('click', async (e) => {
    const a = e.target.closest('a[data-sub]'); if (!a) return;
    e.preventDefault();
    const which = a.dataset.sub;
    selectSub(which);
    if (which === 'orders') await renderOrdersView();
    else renderCartView();
  });

  // Boot
  selectSub('cart');
  renderCartView();
})();
