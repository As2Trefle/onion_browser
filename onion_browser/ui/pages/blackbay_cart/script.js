// script.js — BlackBay (Panier / Commandes) — 100% complet

(function () {
  // Mesure la barre en haut après rendu initial (LB-Phone)
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
  const CART_KEY   = 'bb:cart';
  const ORDERS_KEY = 'bb:orders';

  const getCart = () => { try { return JSON.parse(sessionStorage.getItem(CART_KEY)   || '[]'); } catch { return []; } };
  const setCart = (arr) => sessionStorage.setItem(CART_KEY,   JSON.stringify(arr||[]));

  const getOrders = () => { try { return JSON.parse(sessionStorage.getItem(ORDERS_KEY) || '[]'); } catch { return []; } };
  const setOrders = (arr) => sessionStorage.setItem(ORDERS_KEY, JSON.stringify(arr||[]));

  const priceNum = (p) => typeof p === 'number' ? p : Number(String(p).replace(/[^\d.]/g,'')) || 0;
  const fmtUSD   = (n) => `USD $${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  const nowISO   = () => new Date().toISOString();
  const fmtFR    = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('fr-FR', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });
  };
  // --- Statuts normalisés
  const STATUS_LABELS = {
    attente_paiement: 'Attente paiement',
    attente_livraison: 'Attente livraison',
    livree: 'Livrée',
    annulee: 'Annulée'
  };

  // Transforme n'importe quelle variante en code canonique
  const statusCode = (s) => {
    if (!s) return 'attente_paiement';
    let k = String(s).toLowerCase().trim()
      .replace(/\s+/g, '_');          // "Attente paiement" -> "attente_paiement"
    if (k === 'pending') k = 'attente_paiement';   // compat anciens
    if (k === 'en_attente_paiement') k = 'attente_paiement';
    return k;
  };

  // Donne le libellé FR à partir du code
  const statusLabel = (code) => STATUS_LABELS[code] || code;

  // Desc pour quelques items connus (optionnel)
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

  // ---- DOM
  const container = $('#bb-cart');
  const subtabs   = $('#bb-subtabs');
  const tabs      = $('#bb-tabs');

  // ---- Flash message (succès/erreur simple)
  function flash(msg, kind='ok') {
    const node = document.createElement('div');
    node.className = `bbFlash bbFlash--${kind}`;
    node.textContent = msg;
    container.prepend(node);
    setTimeout(() => node.classList.add('is-shown'), 10);
    setTimeout(() => node.classList.remove('is-shown'), 2200);
    setTimeout(() => node.remove(), 2600);
  }

  // ---- RENDUS
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
      <div class="bbTotals bbTotals--glass" id="bb-totals">
        <div class="bbTotals__meta">
          <div class="bbTotals__line">
            <span>Articles</span>
            <b data-sum-items>${n}</b>
          </div>
          <div class="bbTotals__line">
            <span>Total</span>
            <b data-sum-amount>${fmtUSD(total)}</b>
          </div>
        </div>
        <div class="bbTotals__actions">
          <button type="button" class="bbChip" data-act="clear">Vider</button>
          <button type="button" class="bbBtn bbBtn--ghost" data-act="continue">Continuer</button>
          <button type="button" class="bbBtn bbBtn--accent" data-act="order">Commander</button>
        </div>
      </div>
      <div class="bbBottomSpacer" aria-hidden="true"></div>
    `;

    container.innerHTML = itemsHTML + totalsHTML;
    requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
  }

  function renderOrdersView() {
    const orders = getOrders();
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
      const itemsCount = o.items.reduce((n, it) => n + (Number(it.qty)||0), 0);
      const detailsHTML = (o.items || []).map(it => `
        <div class="bbDetailItem">
          <div class="bbDetailItem__imgWrap">
            <img class="bbDetailItem__img" src="nui://qb-inventory/html/images/${it.img}" alt="">
          </div>
          <div class="bbDetailItem__meta">
            <div class="bbDetailItem__title">${it.title}</div>
            <div class="bbDetailItem__sub">Qté : ${Number(it.qty)||0} &nbsp;·&nbsp; Prix : USD $${Number(it.price).toLocaleString('en-US')}</div>
          </div>
          <div class="bbDetailItem__price">USD $${(Number(it.price) * (Number(it.qty)||0)).toLocaleString('en-US')}</div>
        </div>
      `).join('');

      const code  = statusCode(o.status);      // <-- normalisé
      const label = statusLabel(code);         // <-- joli texte
      const showPay  = code === 'attente_paiement';
      const showDrop = code === 'attente_livraison';

      return `
        <article class="bbOrdersItem" data-oid="${o.id}">
          <div class="bbOrdersItem__head">
            <div class="bbOrdersItem__id">Commande <b>#${o.id}</b></div>
            <div class="bbOrdersItem__date">${fmtFR(o.date)}</div>
          </div>

          <div class="bbOrdersItem__body">
            <div class="bbOrdersItem__line"><b>Articles:</b> ${itemsCount}</div>
            <div class="bbOrdersItem__line"><b>Total:</b> ${fmtUSD(o.total)}</div>
            <div class="bbOrdersItem__line bbOrdersItem__actions">
              <div class="bbOrdersItem__status">
                <b>Statut:</b> <span class="bbBadge">${label}</span>
              </div>
              <div class="bbOrdersItem__buttons">
                <button class="bbBtn bbBtn--secondary" data-act="toggle-details" type="button">Détails</button>
                ${showPay  ? `<button class="bbBtn bbBtn--pay"     data-act="payment" type="button">Paiement</button>` : ``}
                ${showDrop ? `<button class="bbBtn bbBtn--airdrop" data-act="airdrop"  type="button">Airdrop</button>`  : ``}
              </div>
            </div>
            <div class="bbOrdersItem__details" hidden>
              ${detailsHTML}
            </div>
          </div>
        </article>
      `;
    }).join('');

    container.innerHTML = `<div class="bbOrders">${listHTML}</div><div class="bbBottomSpacer" aria-hidden="true"></div>`;
    requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
  }

  // ---- Charger les commandes BDD (citizenid) depuis le serveur
  async function loadOrdersFromServer() {
    try {
      let out = null;
      if (typeof fetchNui === 'function') {
        out = await fetchNui('bb_getOrders', {}, (globalThis.resourceName || undefined));
      } else {
        const res = await fetch(`https://${GetParentResourceName()}/bb_getOrders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({})
        });
        out = await res.json().catch(() => null);
      }
      if (out && out.ok && Array.isArray(out.orders)) {
        setOrders(out.orders.map(o => ({
          id: o.id,
          date: o.date,
          items: o.items,
          total: o.total,
          status: statusCode(o.status)    // <-- normalise ici
        })));
      } else {
        setOrders([]);
      }
    } catch (e) {
      console.error('bb_getOrders error', e);
    }
  }

  // ---- NUI messages (client Lua -> UI) pour MAJ de statut
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (d && d.action === 'bb:orderStatus') {
      const orders = getOrders();
      const i = orders.findIndex(o => o.id === d.id);
      if (i !== -1) {
        orders[i].status = statusCode(d.status);  // <-- normalise
        setOrders(orders);
        renderOrdersView();
      }
    }
  });

  // ---- Actions sur la vue courante (délégué)
  container.addEventListener('click', (e) => {
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
        renderCartView();
        return;
      }

      if (e.target.closest('[data-act="plus"], [data-act="minus"]')) {
        const cart = getCart();
        const i = cart.findIndex(x => String(x.id) === String(id));
        if (i !== -1) {
          cart[i].qty = Math.max(1, Number(val.textContent)||1);
          setCart(cart);
          renderCartView();
        }
        return;
      }
    }

    // Boutons de la zone totaux
    if (e.target.closest('[data-act="clear"]')) {
      setCart([]);
      renderCartView();
      e.preventDefault();
      return;
    }
    if (e.target.closest('[data-act="continue"]')) {
      window.OnionRouter?.go('blackbay_drogues');
      e.preventDefault();
      return;
    }
    if (e.target.closest('[data-act="order"]')) {
      (async () => {
        const cart = getCart();
        if (!cart.length) { flash('Votre panier est vide.', 'warn'); return; }
        const total = cart.reduce((a, it) => a + (priceNum(it.price) * (Number(it.qty)||0)), 0);

        try {
          let out = null;

          // LB-Phone injecte fetchNui() et resourceName dans l’app
          if (typeof fetchNui === 'function') {
            out = await fetchNui('bb_placeOrder', { items: cart, total }, (globalThis.resourceName || undefined));
          } else {
            // Fallback si jamais l’app était ouverte hors LB-Phone
            const res = await fetch(`https://${GetParentResourceName()}/bb_placeOrder`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({ items: cart, total })
            });
            out = await res.json().catch(() => null);
          }

          if (out && out.ok) {
            const orders = getOrders();
            orders.unshift({
              id: out.order_no || 'N/A',
              date: nowISO(),
              items: cart,
              total,
              status: 'attente_paiement'        // <-- code canonique
            });
            setOrders(orders);
            setCart([]);
            selectSub('orders');
            // Recharge BDD pour refléter la date/statut serveur
            await loadOrdersFromServer();
            renderOrdersView();
          } else {
            if (globalThis?.components?.setPopUp) {
              globalThis.components.setPopUp({
                title: 'Commande refusée',
                description: (out && out.error === 'no_grade')
                  ? "Seuls les grades Boss et Second peuvent commander ces articles."
                  : "Une erreur est survenue lors de l’envoi de la commande.",
                buttons: [{ title: 'OK' }]
              });
            } else {
              flash('Commande refusée.', 'warn');
            }
          }
        } catch (err) {
          console.error('bb_placeOrder error', err);
          flash("Erreur : impossible d’envoyer la commande.", 'warn');
        }
      })();

      e.preventDefault();
      return;
    }

    // Toggle "Détails" d'une commande
    if (e.target.closest('[data-act="toggle-details"]')) {
      const card = e.target.closest('.bbOrdersItem');
      if (!card) return;
      const box = card.querySelector('.bbOrdersItem__details');
      const btn = e.target.closest('[data-act="toggle-details"]');
      const isOpen = box && !box.hasAttribute('hidden');
      if (box) {
        if (isOpen) {
          box.setAttribute('hidden', '');
          btn.classList.remove('is-active');
          btn.textContent = 'Détails';
        } else {
          box.removeAttribute('hidden');
          btn.classList.add('is-active');
          btn.textContent = 'Masquer';
        }
        requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
      }
      e.preventDefault();
      return;
    }

    // Bouton Paiement -> démarre la mission (choix d’une mailbox) via NUI -> Lua
    if (e.target.closest('[data-act="payment"]')) {
      const card = e.target.closest('.bbOrdersItem');
      const oid = card?.dataset?.oid;
      if (!oid) return;

      (async () => {
        const out = await (typeof fetchNui === 'function'
          ? fetchNui('bb_startPayment', { id: oid }, (globalThis.resourceName || undefined))
          : Promise.resolve({ ok:false, error:'nui_unavailable' }));

    if (out && out.ok) {
      if (globalThis?.components?.setPopUp) {
        globalThis.components.setPopUp({
          title: 'Paiement lancé',
          description: "Rendez-vous à la boîte aux lettres indiquée pour déposer la somme en cash.",
          buttons: [{
            title: 'OK',
            bold: true,
            cb: async () => {
              // 1) ferme l’app côté UI (animation locale)
              try { globalThis.closeApp?.(); } catch {}

              // 2) ferme l’app côté client LB-Phone (celle actuellement ouverte)
              if (typeof fetchNui === 'function') {
                try { await fetchNui('bb_closeApp', {}, (globalThis.resourceName || undefined)); } catch {}
                // 3) petit délai pour laisser l’anim de fermeture se jouer proprement
                await new Promise(r => setTimeout(r, 180));
                // 4) ferme le téléphone
                try { await fetchNui('bb_closePhone', {}, (globalThis.resourceName || undefined)); } catch {}
              }
            }
          }]
        });
      } else {
        // Fallback sans popup : on ferme dans le bon ordre
        try { globalThis.closeApp?.(); } catch {}
        if (typeof fetchNui === 'function') {
          try { await fetchNui('bb_closeApp', {}, (globalThis.resourceName || undefined)); } catch {}
          await new Promise(r => setTimeout(r, 200));
          try { await fetchNui('bb_closePhone', {}, (globalThis.resourceName || undefined)); } catch {}
        }
      }
    } else {
      flash("Impossible de démarrer le paiement.", 'warn');
    }
      })();
      e.preventDefault();
      return;
    }

    // Bouton Airdrop (placeholder design, action à venir)
    if (e.target.closest('[data-act="airdrop"]')) {
      if (globalThis?.components?.setPopUp) {
        globalThis.components.setPopUp({
          title: 'Airdrop',
          description: "La fonctionnalité Airdrop arrive bientôt.",
          buttons: [{ title: 'OK' }]
        });
      } else {
        flash('La fonctionnalité Airdrop arrive bientôt.', 'ok');
      }
      e.preventDefault();
      return;
    }
  });

  // ---- Top tabs (Drogues / Armes / Marché)
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

  // ---- Sous-tabs (Mon panier / Mes commandes)
  function selectSub(which) {
    subtabs.querySelectorAll('.bbSub__tab').forEach(li => li.classList.remove('bbSub__tab--active'));
    const link = subtabs.querySelector(`a[data-sub="${which}"]`);
    link?.parentElement?.classList.add('bbSub__tab--active');
  }

  subtabs?.addEventListener('click', async (e) => {
    const a = e.target.closest('a[data-sub]'); if (!a) return;
    e.preventDefault();
    const which = a.dataset.sub; // "cart" | "orders"
    selectSub(which);
    if (which === 'orders') {
      await loadOrdersFromServer();
      renderOrdersView();
    } else {
      renderCartView();
    }
  });

  // ---- Boot: "Mon panier" actif par défaut
  selectSub('cart');
  renderCartView();
})();
