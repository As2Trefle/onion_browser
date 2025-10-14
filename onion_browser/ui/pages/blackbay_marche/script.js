(function () {
  // Mesure omnibox (si présente)
  setTimeout(function(){
    if (window.OnionRouter && typeof window.OnionRouter.measureOmnibox === 'function') {
      window.OnionRouter.measureOmnibox();
    }
  }, 0);

  // Contexte / helpers DOM
  document.body.classList.add('route-blackbay');
  var $ = function (s, p) { return (p || document).querySelector(s); };
  var content = $('#bb-content');

  // NUI helper (robuste, compatible anciens CEF)
  var NUI_RES = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'onion_browser';
  function postNUI(name, data) {
    if (data == null) data = {};
    return fetch('https://' + NUI_RES + '/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data)
    }).then(function(res){
      var ct = '';
      try { ct = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : ''; } catch(e) {}
      if (ct && ct.indexOf('application/json') !== -1) return res.json();
      // Tolère 204/texte
      return { ok: true };
    }).catch(function(){
      return { ok: false };
    });
  }

  // Panier (badge)
  var CART_KEY = 'bb:cart';
  function getCart(){ try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); } catch(e) { return []; } }
  function sumQty(cart){ return cart.reduce(function(n, it){ return n + (Number(it.qty)||0); }, 0); }
  function updateCartBadge() {
    var n = sumQty(getCart());
    var badge = document.querySelector('[data-cart-count]');
    if (badge) badge.textContent = String(n);
  }

  // ===== Helpers UI =====
  function escapeHtml(s){ s = String(s || ''); return s.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;'}[m]); }); }
  function trunc(s, max){ s = String(s || ''); max = max || 16; return s.length > max ? s.slice(0, max - 1) + '…' : s; }
  function frDate(tsOrStr){
    if (typeof tsOrStr === 'number') {
      try {
        return new Date(tsOrStr * 1000).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' });
      } catch(e) {}
    }
    return String(tsOrStr || '');
  }

  function annCardHTML(a){
    var rawTitle   = a && a.title   || '';
    var rawMessage = a && a.message || '';
    var rawContact = a && a.contact || '';
    var rawAuthor  = a && a.author  || '';
    var when       = frDate((a && a.created_ts) || (a && a.created_at));

    var titleEsc   = escapeHtml(rawTitle);
    var messageEsc = escapeHtml(rawMessage);
    var contactEsc = escapeHtml(rawContact);
    var authorEsc  = escapeHtml(rawAuthor);
    var authorShortEsc = escapeHtml(trunc(rawAuthor, 16));

    return '' +
      '<article class="annCard">' +
        '<div class="annCard__logoWrap">' +
          '<img class="annCard__logo" src="./assets/icon-blackbay.png" alt="">' +
        '</div>' +

        '<div class="annCard__head">' +
          '<h3 class="annCard__title">' + titleEsc + '</h3>' +
        '</div>' +

        '<div class="annCard__body">' + messageEsc + '</div>' +

        '<div class="annCard__foot">' +
          '<div class="annPhone">' +
            '<span>' + contactEsc + '</span>' +
            '<button class="annPhone__copy" type="button" aria-label="Copier le numéro" data-copy="' + contactEsc + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>' +
                '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>' +
              '</svg>' +
            '</button>' +
          '</div>' +

          '<div class="annMeta">' +
            '<div class="annMeta__left" title="' + authorEsc + '">Auteur&nbsp;: ' + authorShortEsc + '</div>' +
            '<div class="annMeta__right">' + escapeHtml(when) + '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderAnnoncesList(rows, emptyText){
    if (!content) return;
    if (!rows || !rows.length){
      content.innerHTML = '<div class="bbEmpty">' + (emptyText || 'Aucune annonce publiée pour le moment.') + '</div><div class="bbBottomSpacer" aria-hidden="true"></div>';
      requestAnimationFrame(function(){
        if (window.OnionRouter && typeof window.OnionRouter.measureOmnibox === 'function') window.OnionRouter.measureOmnibox();
      });
      return;
    }
    content.innerHTML = '<div class="annList">' + rows.map(annCardHTML).join('') + '</div><div class="bbBottomSpacer" aria-hidden="true"></div>';

    // Copy-to-clipboard : NUI (ox_lib) puis fallback execCommand (pas de navigator.clipboard)
    var copyBtns = content.querySelectorAll('.annPhone__copy');
    for (var i=0; i<copyBtns.length; i++){
      (function(btn){
        btn.addEventListener('click', function(){
          var text = btn.getAttribute('data-copy') || '';
          var original = btn.innerHTML;

          // 1) Tentative OS via client
          postNUI('bb_copy_os', { text: text }).then(function(res){
            var ok = !!(res && res.ok);

            // 2) Fallback JS si nécessaire
            if (!ok) {
              var area = document.createElement('textarea');
              area.value = text;
              area.setAttribute('readonly', '');
              area.style.position = 'absolute';
              area.style.left = '-9999px';
              document.body.appendChild(area);
              area.select();
              try { ok = document.execCommand('copy'); } catch(e) { ok = false; }
              area.remove();
            }

            btn.innerHTML = '<span class="annPhone__copied">' + (ok ? 'Copié dans le presse-papier' : 'Échec de la copie') + '</span>';
            setTimeout(function(){ btn.innerHTML = original; }, 1000);
          });
        });
      })(copyBtns[i]);
    }

    requestAnimationFrame(function(){
      if (window.OnionRouter && typeof window.OnionRouter.measureOmnibox === 'function') window.OnionRouter.measureOmnibox();
    });
  }

  // ===== Vues =====
  var annBar    = $('#bb-annonces-bar');
  var filterBar = $('#bb-filterbar');
  function showAnnouncesBar(v){ if (annBar) annBar.classList.toggle('is-hidden', !v); }
  function showFilterBar(v){ if (filterBar) filterBar.classList.toggle('is-hidden', !v); }

  function showAllAnnonces(){
    showAnnouncesBar(true); showFilterBar(false);
    if (content) content.innerHTML = '<div class="bbEmpty">Chargement…</div>';
    postNUI('bb_list_all_annonces', {}).then(function(res){
      var rows = (res && res.ok && Array.isArray(res.rows)) ? res.rows : [];
      renderAnnoncesList(rows);
    });
  }

  function showMarket(){
    // Marché : on affiche les annonces (source BDD)
    showAnnouncesBar(false); showFilterBar(false);
    if (content) content.innerHTML = '<div class="bbEmpty">Chargement…</div>';
    postNUI('bb_list_all_annonces', {}).then(function(res){
      var rows = (res && res.ok && Array.isArray(res.rows)) ? res.rows : [];
      renderAnnoncesList(rows);
    });
  }

  function showMesAnnonces(){
    showAnnouncesBar(true); showFilterBar(false);
    if (content) content.innerHTML = '<div class="bbEmpty">Chargement…</div>';
    postNUI('bb_list_my_annonces', {}).then(function(res){
      var rows = (res && res.ok && Array.isArray(res.rows)) ? res.rows : [];
      renderAnnoncesList(rows, 'Vous n\u2019avez publié aucune annonce.');
    });
  }

  function renderNewAnnonceForm() {
    if (!content) return;
    content.innerHTML =
      '<form id="annonce-form" class="bbForm" novalidate>' +
        '<div class="bbNotice" id="annonce-success">Annonce enregistrée.</div>' +
        '<div class="bbError" id="annonce-error"></div>' +

        '<div class="bbForm__row">' +
          '<label for="ann_titre">Titre de l\u2019annonce (max 20)</label>' +
          '<input id="ann_titre" name="title" type="text" maxlength="20" placeholder="Ex: Vente rare" required />' +
          '<div class="bbForm__help"><span class="bbForm__counter" data-count-for="ann_titre">0</span>/20</div>' +
        '</div>' +

        '<div class="bbForm__row">' +
          '<label for="ann_msg">Message (max 140)</label>' +
          '<textarea id="ann_msg" name="message" maxlength="140" placeholder="D\u00e9crivez bri\u00e8vement votre annonce\u2026" required></textarea>' +
          '<div class="bbForm__help"><span class="bbForm__counter" data-count-for="ann_msg">0</span>/140</div>' +
        '</div>' +

        '<div class="bbForm__row">' +
          '<label for="ann_contact">Contact (num\u00e9ro, 13 max)</label>' +
          '<input id="ann_contact" name="contact" type="text" maxlength="13" placeholder="+33 6 12 34 56" required />' +
          '<div class="bbForm__help">Chiffres/espaces/+ uniquement.</div>' +
        '</div>' +

        '<div class="bbForm__row">' +
          '<label for="ann_author">Auteur (pseudonyme)</label>' +
          '<input id="ann_author" name="author" type="text" maxlength="50" placeholder="Votre pseudo" required />' +
        '</div>' +

        '<div class="bbForm__actions">' +
          '<button type="submit" class="bbBtn bbBtn--primary" id="ann_save">Enregistrer</button>' +
        '</div>' +
      '</form>' +
      '<div class="bbBottomSpacer" aria-hidden="true"></div>';

    // Compteurs live
    var counters = content.querySelectorAll('[data-count-for]');
    for (var i=0; i<counters.length; i++){
      (function(span){
        var id = span.getAttribute('data-count-for');
        var el = content.querySelector('#'+id);
        var update = function(){ span.textContent = String((el.value || '').length); };
        el.addEventListener('input', update); update();
      })(counters[i]);
    }

    var form = $('#annonce-form');
    var err  = $('#annonce-error');
    var ok   = $('#annonce-success');
    var btn  = $('#ann_save');

    if (form) form.addEventListener('submit', function(e){
      e.preventDefault();
      if (err) { err.classList.remove('is-visible'); err.textContent = ''; }
      if (ok)  { ok.classList.remove('is-visible'); }

      var title   = String(($('#ann_titre')||{}).value || '').trim();
      var message = String(($('#ann_msg')||{}).value || '').trim();
      var contact = String(($('#ann_contact')||{}).value || '').trim();
      var author  = String(($('#ann_author')||{}).value || '').trim();

      var invalid =
        !title || title.length > 20 ||
        !message || message.length > 140 ||
        !contact || contact.length > 13 || !/^[0-9 +]+$/.test(contact) ||
        !author;
      if (invalid) {
        if (err) { err.textContent = 'V\u00e9rifiez les champs (longueurs / format du contact).'; err.classList.add('is-visible'); }
        return;
      }

      if (btn) btn.disabled = true;
      postNUI('bb_create_annonce', { title: title, message: message, contact: contact, author: author })
        .then(function(res){
          if (btn) btn.disabled = false;
          if (!res || !res.ok) {
            if (err) {
              err.textContent = 'Échec de l\u2019enregistrement.' + (res && res.reason ? ' ('+res.reason+')' : '');
              err.classList.add('is-visible');
            }
            return;
          }
          if (ok) ok.classList.add('is-visible');
          if (form) form.reset();
        });
    });
  }

  // ===== Navs =====
  var tabs = $('#bb-tabs');
  var sub  = $('#bb-subtabs');

  function setActiveSubTab(key) {
    if (!sub) return;
    var items = sub.querySelectorAll('.bbSub__tab');
    for (var i=0; i<items.length; i++) items[i].classList.remove('bbSub__tab--active');
    var target = sub.querySelector('[data-sub="' + key + '"]');
    if (target && target.parentElement) target.parentElement.classList.add('bbSub__tab--active');
  }

  if (tabs) {
    var tabItems = tabs.querySelectorAll('.bb__tab');
    for (var i=0; i<tabItems.length; i++) tabItems[i].classList.remove('bb__tab--active');
    var marche = tabs.querySelector('[data-tab="marche"]');
    if (marche && marche.parentElement) marche.parentElement.classList.add('bb__tab--active');

    tabs.addEventListener('click', function(e){
      var a = e.target && e.target.closest ? e.target.closest('a[data-tab]') : null;
      if (!a) return;
      e.preventDefault();
      var t = a.getAttribute('data-tab');
      if (t === 'drogues') { if (window.OnionRouter && typeof window.OnionRouter.go === 'function') window.OnionRouter.go('blackbay_drogues'); return; }
      if (t === 'armes')   { if (window.OnionRouter && typeof window.OnionRouter.go === 'function') window.OnionRouter.go('blackbay_armes');   return; }
      if (t === 'marche')  { setActiveSubTab('market'); showMarket(); return; }
    });
  }

  var cartBtn = document.querySelector('.bbSub__cart');
  if (cartBtn) cartBtn.addEventListener('click', function(e){
    e.preventDefault();
    if (window.OnionRouter && typeof window.OnionRouter.go === 'function') window.OnionRouter.go('blackbay_cart');
  });

  var btnNew = $('#btn-new-annonce');
  if (btnNew) btnNew.addEventListener('click', function(e){ e.preventDefault(); renderNewAnnonceForm(); });
  var btnMine = $('#btn-my-annonces');
  if (btnMine) btnMine.addEventListener('click', function(e){ e.preventDefault(); showMesAnnonces(); });

  if (sub) {
    sub.addEventListener('click', function(e){
      var a = e.target && e.target.closest ? e.target.closest('a[data-sub], .bbSub__cart') : null;
      if (!a) return;
      e.preventDefault();

      if (a.classList.contains('bbSub__cart') || a.getAttribute('data-sub') === 'cart') {
        if (window.OnionRouter && typeof window.OnionRouter.go === 'function') window.OnionRouter.go('blackbay_cart');
        return;
      }

      var key = a.getAttribute('data-sub');
      setActiveSubTab(key);

      if (key === 'market') {
        showMarket();
      } else if (key === 'annonces') {
        showAllAnnonces();
      } else {
        showAnnouncesBar(false); showFilterBar(false);
        if (content) content.innerHTML = '<div class="bbEmpty">Vous n\u2019avez pas encore de ventes actives.</div><div class="bbBottomSpacer" aria-hidden="true"></div>';
      }
    });
  }

  // Démarrage : Marché (annonces BDD)
  updateCartBadge();
  setActiveSubTab('market');
  showMarket();
})();
