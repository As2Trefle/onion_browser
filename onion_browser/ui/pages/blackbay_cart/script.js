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
  const CART_KEY = 'bb:cart';

  const getCart = () => {
    try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); }
    catch { return []; }
  };
  const setCart = (arr) => sessionStorage.setItem(CART_KEY, JSON.stringify(arr));

  const priceNum = (p) => typeof p === 'number' ? p : Number(String(p).replace(/[^\d.]/g,'')) || 0;
  const fmtUSD = (n) => `USD $${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  const DESC = {
    cocaseed: 'Graine pour faire pousser la feuille de coca.',
    emptybag: 'Pochon pour ranger la drogue ou autre.',
    jerrycan: "Jerrican d’essence préparé chimiquement pour la cocaïne.",
    rtxpress: 'Presse pour compresser la drogue, pratique pour le transport.',
    rtxcauldron: "Mélange feuilles + essence chimique… réussite garantie.",
    rtxmixingtable: 'Table professionnelle de mélange chimique.',
    rtxmethchiller: 'Refroidisseur professionnel, très basse température.',
    iodine: 'Élément chimique (Z=53) utilisé pour la méthamphétamine.',
    redphosphor: 'Phosphore rouge — usage restreint.',
    acetone: 'Cétone simple, solvant courant.',
    pills: 'Pilules — composition secrète.',
  };

  const listEl = $('#bb-cart');

  function render() {
    const cart = getCart();
    const n = cart.reduce((a, it) => a + (Number(it.qty) || 0), 0);
    const total = cart.reduce((a, it) => a + (Number(it.price)||0) * (Number(it.qty)||0), 0);

    if (!cart.length) {
      listEl.innerHTML = `<div class="bbEmpty">Votre panier est vide.</div><div class="bbBottomSpacer" aria-hidden="true"></div>`;
      const badge = document.querySelector('[data-cart-count]');
      if (badge) badge.textContent = '0';
      requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
      return;
    }

    const itemsHTML = cart.map(it => `
      <article class="bbCartItem" data-id="${it.id}">
        <div class="bbCartItem__imgWrap">
          <img class="bbCartItem__img" src="${INV}${it.img}" alt="">
        </div>
        <div class="bbCartItem__main">
          <h3 class="bbCartItem__title">${it.title}</h3>
          <p class="bbCartItem__desc">${DESC[it.id] || ''}</p>
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
      <div class="bbTotals" id="bb-totals">
        <div class="bbTotals__left">
          <div><b>Articles :</b> <span data-sum-items>${n}</span></div>
          <div><b>Total :</b> <span data-sum-amount>${fmtUSD(total)}</span></div>
        </div>
        <div class="bbTotals__actions">
          <button type="button" class="bbBtn bbBtn--ghost" data-act="clear">Vider</button>
          <button type="button" class="bbBtn" data-act="continue">Continuer</button>
        </div>
      </div>
      <div class="bbBottomSpacer" aria-hidden="true"></div>
    `;

    listEl.innerHTML = itemsHTML + totalsHTML;
    requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
  }

  listEl.addEventListener('click', (e) => {
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
        setCart(cart);
        render();
        return;
      }

      if (e.target.closest('[data-act="plus"], [data-act="minus"]')) {
        const cart = getCart();
        const i = cart.findIndex(x => String(x.id) === String(id));
        if (i !== -1) {
          cart[i].qty = Math.max(1, Number(val.textContent)||1);
          setCart(cart);
          render();
        }
        return;
      }
    }

    if (e.target.closest('[data-act="clear"]')) {
      setCart([]);
      render();
      e.preventDefault();
      return;
    }
    if (e.target.closest('[data-act="continue"]')) {
      window.OnionRouter?.go('blackbay_drogues');
      e.preventDefault();
    }
  });

  const tabs = $('#bb-tabs');
  if (tabs) {
    tabs.querySelectorAll('.bb__tab').forEach(li => li.classList.remove('bb__tab--active'));
    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]'); if (!a) return; e.preventDefault();
      const t = a.dataset.tab;
      if (t === 'drogues') return window.OnionRouter?.go('blackbay_drogues');
      if (t === 'armes')   return window.OnionRouter?.go('blackbay_armes');
      if (t === 'marche') return window.OnionRouter?.go('blackbay_marche');
    });
  }

  render();
})();
