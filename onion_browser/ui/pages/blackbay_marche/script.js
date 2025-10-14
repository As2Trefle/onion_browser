(function () {
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
  const NUI_RES = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'onion_browser';
  const postNUI = async (name, data={}) => {
    try {
      const res = await fetch(`https://${NUI_RES}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      console.warn('[NUI dev-fallback]', name, data, e);
      return { ok: true, rows: [], mock: true };
    }
  };

  // Cart badge (si tu gardes le panier)
  const CART_KEY = 'bb:cart';
  const getCart = () => { try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); } catch { return []; } };
  const sumQty  = (cart) => cart.reduce((n, it) => n + (Number(it.qty)||0), 0);
  function updateCartBadge() {
    const n = sumQty(getCart());
    const badge = document.querySelector('[data-cart-count]');
    if (badge) badge.textContent = String(n);
  }

  // ---------- Annonces : rendu UI ----------
  const content = $('#bb-content');

  function frDate(tsOrStr){
    // ts (seconds) -> Date, sinon fallback texte
    if (typeof tsOrStr === 'number') {
      try { return new Date(tsOrStr * 1000).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' }); }
      catch(_) {}
    }
    if (!tsOrStr) return '';
    return String(tsOrStr); // déjà formaté côté serveur
  }

  function annCardHTML(a){
    const title   = escapeHtml(a.title || '');
    const message = escapeHtml(a.message || '');
    const contact = escapeHtml(a.contact || '');
    const author  = escapeHtml(a.author || '');
    const when    = frDate(a.created_ts || a.created_at);

    return `
      <article class="annCard">
        <div class="annCard__logoWrap">
          <img class="annCard__logo" src="./assets/icon-blackbay.png" alt="">
        </div>

        <div class="annCard__head">
          <h3 class="annCard__title">${title}</h3>
        </div>

        <div class="annCard__body">${message}</div>

        <div class="annCard__foot">
          <div class="annPhone">
            <span>${contact}</span>
            <button class="annPhone__copy" type="button" aria-label="Copier le numéro" data-copy="${contact}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>

          <div class="annMeta">
            <div class="annMeta__left" title="${author}">Auteur&nbsp;: ${escapeHtml(trunc(author,16))}</div>
            <div class="annMeta__right">${when}</div>
          </div>
        </div>
      </article>
    `;
  }

  function renderAnnoncesList(rows, emptyText='Aucune annonce publiée pour le moment.'){
    if (!content) return;
    if (!rows || !rows.length){
      content.innerHTML = `<div class="bbEmpty">${emptyText}</div><div class="bbBottomSpacer" aria-hidden="true"></div>`;
      return requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
    }
    content.innerHTML = `
      <div class="annList">
        ${rows.map(annCardHTML).join('')}
      </div>
      <div class="bbBottomSpacer" aria-hidden="true"></div>
    `;

    // Copy-to-clipboard + swap de contenu 1s
    content.querySelectorAll('.annPhone__copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-copy') || '';
        const original = btn.innerHTML;

        let ok = false;

        // 1) Tentative OS via client (ox_lib)
        try {
          const res = await postNUI('bb_copy_os', { text });
          ok = !!(res && res.ok);
        } catch (_) {}

        // 2) Fallback JS silencieux (pas de navigator.clipboard → évite Permissions-Policy)
        if (!ok) {
          const area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'absolute';
          area.style.left = '-9999px';
          document.body.appendChild(area);
          area.select();
          ok = document.execCommand('copy');
          area.remove();
        }

        // Feedback 1s
        btn.innerHTML = `<span class="annPhone__copied">${ok ? 'Copié dans le presse-papier' : 'Échec de la copie'}</span>`;
        setTimeout(() => { btn.innerHTML = original; }, 1000);
      });
    });

    requestAnimationFrame(() => window.OnionRouter?.measureOmnibox?.());
  }

  function pulse(el){
    el.style.transform = 'scale(0.92)';
    setTimeout(() => { el.style.transform = ''; }, 120);
  }

  function escapeHtml(s=''){
    return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;" }[m]));
  }

  // ---------- Vues ----------
  const annBar    = $('#bb-annonces-bar');
  const filterBar = $('#bb-filterbar');

  function showAnnouncesBar(v){ annBar?.classList.toggle('is-hidden', !v); }
  function showFilterBar(v){ filterBar?.classList.toggle('is-hidden', !v); }

  async function showAllAnnonces(){
    showAnnouncesBar(true);
    showFilterBar(false);
    content.innerHTML = `<div class="bbEmpty">Chargement…</div>`;
    const res = await postNUI('bb_list_all_annonces', {});
    const rows = (res && res.ok && Array.isArray(res.rows)) ? res.rows : [];
    renderAnnoncesList(rows);
  }

  async function showMarketAsAnnonces(){
    // Marché affiche aussi les annonces (source BDD)
    showAnnouncesBar(false);
    showFilterBar(false);
    content.innerHTML = `<div class="bbEmpty">Chargement…</div>`;
    const res = await postNUI('bb_list_all_annonces', {});
    const rows = (res && res.ok && Array.isArray(res.rows)) ? res.rows : [];
    renderAnnoncesList(rows);
  }

  function showMesAnnonces(){
    showAnnouncesBar(true);
    showFilterBar(false);
    content.innerHTML = `<div class="bbEmpty">Chargement…</div>`;
    postNUI('bb_list_my_annonces', {}).then(res => {
      const rows = (res && res.ok && Array.isArray(res.rows)) ? res.rows : [];
      renderAnnoncesList(rows, 'Vous n’avez publié aucune annonce.');
    });
  }

  function showNewAnnonceForm(){
    showAnnouncesBar(true);
    showFilterBar(false);
    // (réutilise le formulaire déjà implémenté précédemment)
    renderNewAnnonceForm();
  }

  // --------- Formulaire déjà livré (raccourci minimal ici) ---------
  function renderNewAnnonceForm() {
    if (!content) return;
    content.innerHTML = `
      <form id="annonce-form" class="bbForm" novalidate>
        <div class="bbNotice" id="annonce-success">Annonce enregistrée.</div>
        <div class="bbError" id="annonce-error"></div>

        <div class="bbForm__row">
          <label for="ann_titre">Titre de l'annonce </label>
          <input id="ann_titre" name="title" type="text" maxlength="20" placeholder="Ex: Vente rare" required />
          <div class="bbForm__help"><span class="bbForm__counter" data-count-for="ann_titre">0</span>/20</div>
        </div>

        <div class="bbForm__row">
          <label for="ann_msg">Message</label>
          <textarea id="ann_msg" name="message" maxlength="140" placeholder="Décrivez brièvement votre annonce…" required></textarea>
          <div class="bbForm__help"><span class="bbForm__counter" data-count-for="ann_msg">0</span>/140</div>
        </div>

        <div class="bbForm__row">
          <label for="ann_contact">Contact</label>
          <input id="ann_contact" name="contact" type="text" maxlength="13" placeholder="+33 6 12 34 56" required />
          <div class="bbForm__help">Chiffres/espaces/+ uniquement.</div>
        </div>

        <div class="bbForm__row">
          <label for="ann_author">Auteur (pseudonyme)</label>
          <input id="ann_author" name="author" type="text" maxlength="50" placeholder="Votre pseudo" required />
        </div>

        <div class="bbForm__actions">
          <button type="submit" class="bbBtn bbBtn--primary" id="ann_save">Enregistrer</button>
        </div>
      </form>
      <div class="bbBottomSpacer" aria-hidden="true"></div>
    `;

    const counters = content.querySelectorAll('[data-count-for]');
    counters.forEach(span => {
      const id = span.getAttribute('data-count-for');
      const el = content.querySelector('#'+id);
      const update = () => span.textContent = String(el.value.length);
      el.addEventListener('input', update); update();
    });

    const form = $('#annonce-form');
    const err  = $('#annonce-error');
    const ok   = $('#annonce-success');
    const btn  = $('#ann_save');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.classList.remove('is-visible'); err.textContent = '';
      ok.classList.remove('is-visible');

      const title   = String($('#ann_titre').value || '').trim();
      const message = String($('#ann_msg').value || '').trim();
      const contact = String($('#ann_contact').value || '').trim();
      const author  = String($('#ann_author').value || '').trim();

      const invalid =
        !title || title.length > 20 ||
        !message || message.length > 140 ||
        !contact || contact.length > 13 || !/^[0-9 +]+$/.test(contact) ||
        !author;
      if (invalid) {
        err.textContent = 'Vérifiez les champs (longueurs / format du contact).';
        err.classList.add('is-visible');
        return;
      }

      btn.disabled = true;
      const res = await postNUI('bb_create_annonce', { title, message, contact, author });
      btn.disabled = false;

      if (!res || !res.ok) {
        err.textContent = 'Échec de l’enregistrement.';
        if (res && res.reason) err.textContent += ' ('+res.reason+')';
        err.classList.add('is-visible');
        return;
      }

      ok.classList.add('is-visible');
      form.reset();
    });
  }

  function trunc(s='', max=16){
  s = String(s);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

  // ---------- Navs ----------
  const tabs = $('#bb-tabs');
  const sub  = $('#bb-subtabs');

  function setActiveSubTab(key) {
    if (!sub) return;
    sub.querySelectorAll('.bbSub__tab').forEach(li => li.classList.remove('bbSub__tab--active'));
    sub.querySelector(`[data-sub="${key}"]`)?.parentElement?.classList.add('bbSub__tab--active');
  }

  // Marché => affiche annonces (BDD) comme demandé
  async function goMarket(){
    setActiveSubTab('market');
    await showMarketAsAnnonces();
  }

  // Tabs principaux
  if (tabs) {
    tabs.querySelectorAll('.bb__tab').forEach(li => li.classList.remove('bb__tab--active'));
    tabs.querySelector('[data-tab="marche"]')?.parentElement?.classList.add('bb__tab--active');

    tabs.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-tab]'); if (!a) return; e.preventDefault();
      const t = a.dataset.tab;
      if (t === 'drogues') return window.OnionRouter?.go('blackbay_drogues');
      if (t === 'armes')   return window.OnionRouter?.go('blackbay_armes');
      if (t === 'marche')  return goMarket();
    });
  }

  // Sous-tabs
  $('#btn-new-annonce')?.addEventListener('click', (e) => { e.preventDefault(); showNewAnnonceForm(); });
  $('#btn-my-annonces')?.addEventListener('click', (e) => { e.preventDefault(); showMesAnnonces(); });

  if (sub) {
    sub.addEventListener('click', async (e) => {
      const a = e.target.closest('a[data-sub], .bbSub__cart'); if (!a) return; e.preventDefault();

      if (a.classList.contains('bbSub__cart') || a.dataset.sub === 'cart')
        return window.OnionRouter?.go('blackbay_cart');

      setActiveSubTab(a.dataset.sub);

      if (a.dataset.sub === 'market') {
        await goMarket();
      } else if (a.dataset.sub === 'annonces') {
        await showAllAnnonces(); // flux public
      } else {
        showAnnouncesBar(false);
        showFilterBar(false);
        content.innerHTML = `<div class="bbEmpty">Vous n’avez pas encore de ventes actives.</div><div class="bbBottomSpacer" aria-hidden="true"></div>`;
      }
    });
  }

  // Démarrage
  updateCartBadge();
  goMarket();
})();
