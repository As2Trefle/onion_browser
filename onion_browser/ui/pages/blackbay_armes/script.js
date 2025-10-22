// ui/pages/blackbay_armes/script.js
(function () {
  // Mesure l’omnibox après le rendu initial
  setTimeout(() => window.OnionRouter?.measureOmnibox?.(), 0);

  // ---- Scoping / cleanup quand on quitte la page
  document.body.classList.add('route-blackbay');
  const root = document.querySelector('.bb');
  const cleanup = () => document.body.classList.remove('route-blackbay');
  const obs = new MutationObserver(() => {
    if (root && !document.body.contains(root)) { cleanup(); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // ---- Helpers
  const $  = (s, p=document) => p.querySelector(s);
  const INV = 'nui://qb-inventory/html/images/';
  const CART_KEY = 'bb:cart';
  const getCart = () => { try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); } catch { return []; } };
  const setCart = (arr) => sessionStorage.setItem(CART_KEY, JSON.stringify(arr));
  const sumQty  = (cart) => cart.reduce((n, it) => n + (Number(it.qty)||0), 0);
  const fmtUSD  = (n) => `USD $${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  let DENY = false; // si true => accès refusé (mafia requis)

  async function nui(event, data) {
    try {
      const res = await fetch(`https://onion_browser/${event}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data || {})
      });
      return await res.json();
    } catch {
      return null;
    }
  }

  function updateCartBadge() {
    const n = sumQty(getCart());
    const badge = document.querySelector('[data-cart-count]');
    if (badge) badge.textContent = String(n);
    const cartLink = document.querySelector('.bbSub__cart');
    if (cartLink && !badge) cartLink.innerHTML = `Panier (<span data-cart-count>${n}</span>)`;
  }

  // ---- Catalogue
  const MATERIAUX = [
    { id:'metal_scrap', img:'metalscrap.png', title:'Morceau de métal',     desc:'Un morceau de métal — on peut faire plein de choses avec.', price:2 },
    { id:'plastic',     img:'plastic.png',     title:'Morceau de plastique', desc:'Un morceau de plastique — « RECYCLEZ ! »',                   price:2 },
  ];

  const PIECES = [
    // AK47
    { id:'ak47part1', img:'top.png',       title:'Couvercle supérieur AK47',         desc:"Pièce supérieure de l’AK47.", price:1500, gun:'AK47' },
    { id:'ak47part2', img:'receiver.png',  title:"Culasse d'AK47",                   desc:"Culasse de l’AK47.",          price:1500, gun:'AK47' },
    { id:'ak47part3', img:'buttstuck.png', title:"Crosse d'AK47",                    desc:"Crosse de l’AK47.",           price:1500, gun:'AK47' },
    { id:'akpart4',   img:'barrel.png',    title:"Canon d'AK47",                     desc:"Canon de l’AK47.",            price:1500, gun:'AK47' },

    // AKU
    { id:'akupart1',  img:'akutop.png',        title:'Couvercle supérieur compact AKU',   desc:"Couvercle supérieur compact de l’AKU.", price:1500, gun:'AKU' },
    { id:'akupart2',  img:'akureceiver.png',   title:'Culasse compact AKU',               desc:"Culasse compacte de l’AKU.",           price:1500, gun:'AKU' },
    { id:'akupart3',  img:'akubarrel.png',     title:'Canon compact AKU',                 desc:"Canon compact de l’AKU.",              price:1500, gun:'AKU' },

    // Micro SMG
    { id:'microsmgpart1',  img:'microsmgbarrel.png',     title:'Culasse Micro SMG',       desc:"Culasse du Micro SMG",               price:500, gun:'MicroSMG' },
    { id:'microsmgpart2',  img:'microsmgslide.png',      title:'Garde mains Micro SMG',   desc:"Garde du Micro SMG",                 price:500, gun:'MicroSMG' },
    { id:'microsmgpart3',  img:'microsmgpgrip.png',      title:'Gâchette Micro SMG',      desc:"Gâchette + grip Micro SMG",          price:500, gun:'MicroSMG' },
    { id:'microsmgpart4',  img:'microsmgbuttstock.png',  title:'Crosse Micro SMG',        desc:"Crosse de la Micro SMG",              price:500, gun:'MicroSMG' },
    { id:'microsmgpart5',  img:'microsmgreceiver.png',   title:'Chargeur Micro SMG',      desc:"Chargeur de la Micro SMG",            price:500, gun:'MicroSMG' },
  ];

  // ---- Sélecteurs de la page
  const content     = $('#bb-content');
  const tabs        = $('#bb-tabs');
  const sub         = $('#bb-subtabs');
  const filterWrap  = $('#bb-filter-wrap');
  const filterSel   = $('#bb-filter');

  const setFilterVisible = (v) => {
    if (!filterWrap) return;
    filterWrap.classList.toggle('is-hidden', !v);
    filterWrap.setAttribute('aria-hidden', v ? 'false' : 'true');
  };
  const getFilteredPieces = () => {
    const val = (filterSel?.value || 'all');
    return val === 'all' ? PIECES : PIECES.filter(p => p.gun === val);
  };

  // ---- Rendus
  const itemCardHTML = (it) => `
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

  function render(list) {
    if (!content) return;
    const html = (!list || !list.length)
      ? `<div class="bbEmpty">Aucun produit pour le moment.</div>`
      : `<div class="bbList">${list.map(itemCardHTML).join('')}</div><div class="bbBottomSpacer" aria-hidden="true"></div>`;
    content.innerHTML = html;
    requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
  }

  function renderDeny() {
    if (!content) return;
    content.innerHTML = `
      <div class="bbDeny">
        <div id="loading">INTERDIT</div>
      </div>
    `;
    startDenyAnimation();
    requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
  }

  function startDenyAnimation() {
    const el = document.getElementById('loading'); if (!el) return;
    const word = (el.textContent || '').trim();
    el.textContent = '';
    const spans = [];
    for (const ch of word) {
      const s = document.createElement('span');
      s.textContent = ch;
      el.appendChild(s);
      spans.push(s);
    }
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    let letter_count = 0;
    let finished = false;

    function write() {
      for (let i = letter_count; i < spans.length; i++) {
        spans[i].textContent = alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      if (!finished) setTimeout(write, 75);
    }
    function inc() {
      spans[letter_count].textContent = word[letter_count];
      spans[letter_count].classList.add('glow');
      letter_count++;
      if (letter_count >= spans.length) {
        finished = true;
        setTimeout(reset, 1500);
      } else {
        setTimeout(inc, 1000);
      }
    }
    function reset() {
      letter_count = 0; finished = false;
      spans.forEach(s => s.classList.remove('glow'));
      setTimeout(inc, 1000); setTimeout(write, 75);
    }
    setTimeout(write, 75);
    setTimeout(inc, 1000);
  }

  // ---- Cart
  function addToCart(id, qty, cat) {
    const item = cat.find(x => String(x.id) === String(id)); if (!item) return;
    const cart = getCart();
    const i = cart.findIndex(x => String(x.id) === String(id));
    (i === -1) ? cart.push({ id:item.id, title:item.title, img:item.img, price:item.price, qty })
               : cart[i].qty = (Number(cart[i].qty)||0) + qty;
    setCart(cart); updateCartBadge();
  }

  content?.addEventListener('click', (e) => {
    const card = e.target.closest('.bbItem'); if (!card) return;
    const val = card.querySelector('[data-val]');
    if (e.target.closest('[data-act="plus"]'))  { val.textContent = String(Math.min(99, (Number(val.textContent)||1) + 1)); return; }
    if (e.target.closest('[data-act="minus"]')) { val.textContent = String(Math.max(1, (Number(val.textContent)||1) - 1)); return; }
    if (e.target.closest('.bbItem__add')) {
      const active = document.querySelector('.bbSub__tab--active a')?.dataset.sub || 'materiaux';
      const cat = active === 'pieces' ? getFilteredPieces() : MATERIAUX;
      addToCart(card.dataset.id, Math.max(1, Number(val.textContent)||1), cat);
    }
  });

  // ---- Tabs principaux
  if (tabs) {
    tabs.querySelectorAll('.bb__tab').forEach(li => li.classList.remove('bb__tab--active'));
    tabs.querySelector('[data-tab="armes"]')?.parentElement?.classList.add('bb__tab--active');
    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]'); if (!a) return; e.preventDefault();
      const t = a.dataset.tab;
      if (t === 'drogues') return window.OnionRouter?.go('blackbay_drogues');
      if (t === 'marche')  return window.OnionRouter?.go('blackbay_marche');
    });
  }

  // ---- Sous-tabs (on laisse la sous-navbar même en DENY)
  if (sub) {
    sub.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-sub], .bbSub__cart'); if (!a) return; e.preventDefault();
      if (a.classList.contains('bbSub__cart') || a.dataset.sub === 'cart') {
        return window.OnionRouter?.go('blackbay_cart');
      }

      // Visuel actif
      sub.querySelectorAll('.bbSub__tab').forEach(li => li.classList.remove('bbSub__tab--active'));
      a.parentElement?.classList.add('bbSub__tab--active');

      // Si refusé, on affiche l’écran INTERDIT, filtre caché
      if (DENY) {
        setFilterVisible(false);
        return renderDeny();
      }

      const want = a.dataset.sub; // "materiaux" | "pieces"
      if (want === 'pieces') {
        setFilterVisible(true);
        render(getFilteredPieces());
      } else {
        setFilterVisible(false);
        render(MATERIAUX);
      }
    });
  }

  // ---- Filtre des pièces
  filterSel?.addEventListener('change', () => {
    if (DENY) return; // en refus on ne montre pas la liste
    const active = document.querySelector('.bbSub__tab--active a')?.dataset.sub || 'materiaux';
    if (active === 'pieces') render(getFilteredPieces());
  });

  // ---- Lien panier
  document.querySelector('.bbSub__cart')?.addEventListener('click', (e) => {
    e.preventDefault(); window.OnionRouter?.go('blackbay_cart');
  });

  // ---- Boot
  updateCartBadge();
  (async () => {
    // Vérifie l’accès (mafia requise pour Armes)
    const resp = await nui('blackbay:checkAccess', { tab: 'armes' });
    const allowed = resp && resp.allowed === true;
    DENY = !allowed;

    // Matériaux actif visuellement au chargement
    const matLi = document.querySelector('.bbSub__tab a[data-sub="materiaux"]')?.parentElement;
    if (matLi && !matLi.classList.contains('bbSub__tab--active')) matLi.classList.add('bbSub__tab--active');

    if (DENY) {
      setFilterVisible(false);     // pas de filtre en mode refus
      renderDeny();                // affiche INTERDIT mais conserve la sous-navbar
    } else {
      setFilterVisible(false);     // Matériaux par défaut => pas de filtre
      render(MATERIAUX);
    }
  })();
})();
