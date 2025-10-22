(function () {
  // Mesure omnibox
  setTimeout(function(){
    if (window.OnionRouter && typeof window.OnionRouter.measureOmnibox === 'function') {
      window.OnionRouter.measureOmnibox();
    }
  }, 0);

  document.body.classList.add('route-blackbay');

  var $ = function (s, p) { return (p || document).querySelector(s); };
  var content   = $('#bb-content');
  var filterBar = $('#bb-filterbar');
  var filterInp = $('#bb-filter-input');
  var annBar    = $('#bb-annonces-bar');
  var ventesBar = $('#bb-ventes-bar');

  // ==== LB Phone helpers (popups) ====
  var LB = (typeof globalThis !== 'undefined' && globalThis.components) ? globalThis.components : null;
  function lbConfirm(opts){
    return new Promise(function(resolve){
      if (!LB || typeof LB.setPopUp !== 'function'){
        resolve(window.confirm((opts && opts.description) || 'Voulez-vous continuer ?'));
        return;
      }
      LB.setPopUp({
        title: (opts && opts.title) || 'Confirmation',
        description: (opts && opts.description) || 'Voulez-vous continuer ?',
        buttons: [
          { title: (opts && opts.cancelText) || 'Annuler', color: 'red',  cb: function(){ resolve(false); } },
          { title: (opts && opts.okText)     || 'Confirmer', color: 'blue', cb: function(){ resolve(true); } }
        ]
      });
    });
  }
  function lbAlert(title, description, btnText){
    if (!LB || typeof LB.setPopUp !== 'function'){
      window.alert((title? title + '\n' : '') + (description || ''));
      return;
    }
    LB.setPopUp({
      title: title || 'Information',
      description: description || '',
      buttons: [{ title: btnText || 'OK', color: 'blue', cb: function(){} }]
    });
  }

  // NUI helper
  var NUI_RES = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'onion_browser';
  function postNUI(name, data) {
    if (data == null) data = {};
    return fetch('https://' + NUI_RES + '/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data)
    }).then(function(res){
      var ct = '';
      try { ct = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : ''; } catch(e){}
      if (ct && ct.indexOf('application/json') !== -1) return res.json();
      return { ok:true };
    }).catch(function(){ return { ok:false }; });
  }

  // -------- Config (overridable depuis le serveur via NUI) --------
  var CONFIG = {
    maxSalesPerCitizen: 5,
    maxQtyPerSale: 5,
  };
  postNUI('bb_get_config', {}).then(function(res){
    if (res && res.ok && res.config){
      if (typeof res.config.maxSalesPerCitizen === 'number') CONFIG.maxSalesPerCitizen = res.config.maxSalesPerCitizen;
      if (typeof res.config.maxQtyPerSale === 'number') CONFIG.maxQtyPerSale = res.config.maxQtyPerSale;
    }
  });

  // Panier
  var CART_KEY = 'bb:cart';
  function getCart(){ try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); } catch(e){ return []; } }
  function setCart(v){ sessionStorage.setItem(CART_KEY, JSON.stringify(v || [])); }
  function sumQty(cart){ return cart.reduce(function(n,it){ return n + (Number(it.qty)||0); }, 0); }
  function updateCartBadge(){
    var n = sumQty(getCart());
    var badge = document.querySelector('[data-cart-count]');
    if (badge) badge.textContent = String(n);
  }

  // Marché (mock)
  var INV = 'nui://qb-inventory/html/images/';
  var MARKET = [
    { id:'cutter',         img:'cutter.png',         title:'Tournette coupe verre',           desc:'Permet de couper du verre, meme les plus epais — un vrai outil de pro.',   price:2000 },
    { id:'drill',          img:'drill.png',          title:'Perceuse professionnelle',        desc:'Perce meme les coffres les plus resistants.',                              price:3000 },
    { id:'saw ',           img:'saw.png',            title:'Decoupeuse Thermique',            desc:'Permet de couper des petits coffres.',                                     price:2000 },
    { id:'thermite_bomb',  img:'thermal_charge.png', title:'Charge thermique',                desc:'Fait fondre les serrures metalliques.',                                    price:350 },
    { id:'c4_bomb',        img:'c4_bomb.png',        title:'C4',                              desc:'Quand la charge thermique ne suffit plus... attention les oreilles.',       price:450 },
    { id:'laptop',         img:'laptop.png',         title:'Ordinateur portable crypte',      desc:'Ordinateur crypte, concu pour une grande discretion.',                     price:600 },
    { id:'trojan_usb',     img:'usb_device.png',     title:'Cle USB Trojan',                  desc:'Contient un logiciel capable de cracker n\'importe quelle securite.',       price:150 },
  ];

  // ========= Ventes: liste d’items autorisés (UI) =========
  var SALES_ITEMS = [
    { id:'paintingg',    img:'paintingg.png',    title:'Peinture GG',            price:10000 },
    { id:'paintingf',    img:'paintingf.png',    title:'Peinture GF',            price:10000 },
    { id:'diamondbox',   img:'diamondbox.png',   title:'Boite de diamants',     price:2000  },
    { id:'argentbar',    img:'argentbar.png',    title:'Barre d\'Argent',       price:1500  },
    { id:'vandiamond',   img:'vanDiamond.png',   title:'LeVan Diamond',         price:30000 },
    { id:'vanpanther',   img:'vanPanther.png',   title:'LeVan Panther',         price:30000 },
    { id:'vannecklace',  img:'vanNecklace.png',  title:'LeVan Collier',         price:30000 },
    { id:'vanbottle',    img:'vanBottle.png',    title:'LeVan Bouteille',       price:30000 },
    { id:'vanpogo',      img:'vanPogo.png',      title:'LeVan Pogo',            price:30000 },
    { id:'rolex',        img:'rolex.png',        title:'Montre en or',          price:5000  },
    { id:'diamond_ring', img:'diamond_ring.png', title:'Bague en diamant',      price:4500  },
    { id:'goldchain',    img:'goldchain.png',    title:'Chaîne en or',          price:2500  },
    { id:'tenkgoldchain',img:'10kgoldchain.png', title:'Chaîne en or 10 carats',price:5000  },
    { id:'goldbar',      img:'goldbar.png',      title:'Lingot d\'or',          price:8000  },
  ];

  var contentEl = $('#bb-content');
  function fmtUSD(n){ return 'USD $' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 }); }
  function norm(s){ return String(s||'').toLowerCase(); }

  // ======== Marché UI existant ========
  function productCard(it){
    return ''+
    '<article class="bbItem" data-id="'+it.id+'">'+
      '<div class="bbItem__imgWrap"><img class="bbItem__img" src="'+INV+it.img+'" alt=""></div>'+
      '<h3 class="bbItem__title">'+it.title+'</h3>'+
      '<p class="bbItem__desc">'+(it.desc||'')+'</p>'+
      '<div class="bbItem__foot">'+
        '<div class="bbItem__price">'+fmtUSD(it.price)+'</div>'+
        '<div class="bbItem__actions">'+
          '<div class="qty" aria-label="Quantite">'+
            '<button class="qty__btn" data-act="minus" type="button">-</button>'+
            '<div class="qty__val" data-val>1</div>'+
            '<button class="qty__btn" data-act="plus" type="button">+</button>'+
          '</div>'+
          '<button class="bbItem__add" type="button">Add</button>'+
        '</div>'+
      '</div>'+
    '</article>';
  }
  function renderProducts(list, emptyText){
    if (!content) return;
    if (!list || !list.length){
      content.innerHTML = '<div class="bbEmpty">'+(emptyText||'Aucun item.')+
        '</div><div class="bbBottomSpacer" aria-hidden="true"></div>';
      return;
    }
    content.innerHTML = '<div class="bbList">'+list.map(productCard).join('')+
      '</div><div class="bbBottomSpacer" aria-hidden="true"></div>';
  }

  // Filtre du Marché
  function applyFilter(){
    var q = norm(filterInp ? filterInp.value : '');
    if (!q) return renderProducts(MARKET);
    var list = MARKET.filter(function(it){
      return norm(it.title).indexOf(q) !== -1 ||
             norm(it.id).indexOf(q)    !== -1 ||
             norm(it.desc||'').indexOf(q) !== -1;
    });
    renderProducts(list, 'Aucun resultat pour votre recherche.');
  }
  if (filterInp) filterInp.addEventListener('input', applyFilter);

  // Panier actions
function addToCart(id, qty){
  var it = MARKET.find(function(x){ return String(x.id) === String(id); });
  if (!it) return;
  var cart = getCart();
  var i = cart.findIndex(function(x){ return String(x.id) === String(id); });
  if (i === -1) cart.push({ id:it.id, title:it.title, img:it.img, price:it.price, qty:qty });
  else cart[i].qty = (Number(cart[i].qty)||0) + qty;
  setCart(cart); updateCartBadge();
}

contentEl && contentEl.addEventListener('click', function(e){
  // [0] Supprimer une vente (icône poubelle en haut à droite de la carte)
  var delBtn = e.target.closest('.saleAct--del');
  if (delBtn) {
    var sid = Number(delBtn.getAttribute('data-id') || 0) || 0;
    if (!sid) return;
    lbConfirm({
      title: "Retirer l'annonce",
      description: "Êtes-vous sûr de vouloir supprimer cette vente ?",
      okText: "Supprimer",
      cancelText: "Annuler"
    }).then(function(yes){
      if (!yes) return;
      postNUI('bb_delete_sale', { id: sid }).then(function(res){
        if (!res || !res.ok) {
          var r = (res && res.reason) || 'erreur';
          if (r === 'mission_running') lbAlert("Impossible", "Cette vente est liée à une mission en cours.");
          else lbAlert("Échec", "Suppression impossible ("+r+").");
          return;
        }
        // refresh Mes ventes
        showMesVentes();
      });
    });
    return;
  }

  // [1] Démarrer une mission de livraison
  var deliverBtn = e.target.closest('.saleCard__deliver');
  if (deliverBtn) {
    var sid = Number(deliverBtn.getAttribute('data-id') || 0) || 0;
    if (!sid) return;
    postNUI('bb_start_delivery', { id: sid }).then(function(res){
      if (!res || !res.ok) {
        var r = res && res.reason || 'indisponible';
        lbAlert('Impossible de lancer la mission', 'Raison : '+r);
        return;
      }
    });
    return;
  }

  // [2] Cartes produits du Marché
  var cardEl = e.target.closest('.bbItem');
  if (!cardEl) return;

  var val = cardEl.querySelector('[data-val]');
  if (e.target.closest('[data-act="plus"]')) { val.textContent = String(Math.min(99,(+val.textContent||1)+1)); return; }
  if (e.target.closest('[data-act="minus"]')) { val.textContent = String(Math.max(1,(+val.textContent||1)-1)); return; }
  if (e.target.closest('.bbItem__add')) {
    addToCart(cardEl.dataset.id, Math.max(1, Number(val.textContent)||1));
  }
});

  // ======== Annonces (existant) ========
  function escapeHtml(s){ s = String(s||''); return s.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m]); }); }
  function frDate(ts){
    if (typeof ts==='number'){ try{ return new Date(ts*1000).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}); }catch(e){} }
    return String(ts||'');
  }
  function getAnnId(a){ return String(a && (a.id || a.annonce_id || a.uuid || '')); }

  var editingId = null;
  var lastMyRows = [];

  function annCardHTML(a, opts){
    opts = opts || {};
    var my = !!opts.my;

    var id        = getAnnId(a);
    var title     = escapeHtml(a && a.title   || '');
    var message   = escapeHtml(a && a.message || '');
    var contact   = escapeHtml(a && a.contact || '');
    var author    = String(a && a.author || '');
    var authorEsc = escapeHtml(author);
    var when      = frDate(a && (a.created_ts || a.created_at));

    var EDIT_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 20h9"></path>' +
        '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>' +
      '</svg>';

    var DEL_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="3 6 5 6 21 6"></polyline>' +
        '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>' +
        '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
        '<line x1="10" y1="11" x2="10" y2="17"></line>' +
        '<line x1="14" y1="11" x2="14" y2="17"></line>' +
      '</svg>';

    var actions = '';
    if (my) {
      actions =
        '<div class="annActions">' +
          '<button class="annAct annAct--edit" type="button" data-id="' + id + '" aria-label="Modifier">' +
            EDIT_SVG +
          '</button>' +
          '<button class="annAct annAct--del" type="button" data-id="' + id + '" aria-label="Supprimer">' +
            DEL_SVG +
          '</button>' +
        '</div>';
    }

    return '' +
      '<article class="annCard" data-id="' + id + '">' +
        actions +
        '<div class="annCard__logoWrap"><img class="annCard__logo" src="./assets/icon-blackbay.png" alt=""></div>' +
        '<div class="annCard__head"><h3 class="annCard__title">' + title + '</h3></div>' +
        '<div class="annCard__body">' + message + '</div>' +
        '<div class="annCard__foot">' +
          '<div class="annPhone"><span>' + contact + '</span>' +
            '<button class="annPhone__copy" type="button" aria-label="Copier le numero" data-copy="' + contact + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>' +
                '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="annMeta">' +
            '<div class="annMeta__left" title="' + authorEsc + '">Auteur : ' + authorEsc + '</div>' +
            '<div class="annMeta__right">' + escapeHtml(when) + '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }
  function renderAnnoncesList(rows, emptyText, opts){
    opts = opts || {};
    var my = !!opts.my;

    if (!content) return;
    if (!rows || !rows.length){
      content.innerHTML = '<div class="bbEmpty">'+(emptyText || 'Aucune annonce publiee pour le moment.')+'</div><div class="bbBottomSpacer" aria-hidden="true"></div>';
      return;
    }
    content.innerHTML = '<div class="annList">'+ rows.map(function(r){ return annCardHTML(r, { my: my }); }).join('') +'</div><div class="bbBottomSpacer" aria-hidden="true"></div>';

    // Copy (NUI -> fallback)
    var btns = content.querySelectorAll('.annPhone__copy');
    for (var i=0;i<btns.length;i++){
      (function(btn){
        btn.addEventListener('click', function(){
          var text = btn.getAttribute('data-copy') || '';
          var original = btn.innerHTML;
          postNUI('bb_copy_os', { text: text }).then(function(res){
            var ok = !!(res && res.ok);
            if (!ok){
              var area = document.createElement('textarea');
              area.value = text;
              area.setAttribute('readonly','');
              area.style.position='absolute';
              area.style.left='-9999px';
              document.body.appendChild(area);
              area.select();
              try { ok = document.execCommand('copy'); } catch(e){ ok = false; }
              area.remove();
            }
            btn.innerHTML = '<span class="annPhone__copied">'+(ok?'Copie effectuée':'Echec de la copie')+'</span>';
            setTimeout(function(){ btn.innerHTML = original; }, 1000);
          });
        });
      })(btns[i]);
    }

    // Actions Mes annonces (edit/suppr)
    if (my) {
      var dels = content.querySelectorAll('.annAct--del');
      for (var d=0; d<dels.length; d++){
        dels[d].addEventListener('click', function(ev){
          var id = (ev.currentTarget.getAttribute('data-id') || '').trim();
          if (!id) return;

          lbConfirm({
            title: "Supprimer l'annonce",
            description: "Êtes-vous sûr de vouloir supprimer cette annonce ?",
            okText: "Supprimer",
            cancelText: "Annuler"
          }).then(function(yes){
            if (!yes) return;
            postNUI('bb_delete_annonce', { id: id, annonce_id: id, uuid: id }).then(function(){
              showMesAnnonces(); // refresh
            });
          });
        });
      }
      var edits = content.querySelectorAll('.annAct--edit');
      for (var eidx=0; eidx<edits.length; eidx++){
        edits[eidx].addEventListener('click', function(ev){
          var id = (ev.currentTarget.getAttribute('data-id') || '').trim();
          if (!id) return;
          var row = null;
          for (var k=0;k<lastMyRows.length;k++){ if (getAnnId(lastMyRows[k]) === id) { row = lastMyRows[k]; break; } }
          renderNewAnnonceForm(row);
        });
      }
    }
  }

  function showAnnBar(v){ if (annBar) annBar.classList.toggle('is-hidden', !v); }
  function showVentesBar(v){ if (ventesBar) ventesBar.classList.toggle('is-hidden', !v); }
  function showFilter(v){ if (filterBar) filterBar.classList.toggle('is-hidden', !v); }

  function showAllAnnonces(){
    showAnnBar(true); showVentesBar(false); showFilter(false);
    if (content) content.innerHTML = '<div class="bbEmpty">Chargement...</div>';
    postNUI('bb_list_all_annonces', {}).then(function(res){
      var rows = (res && res.ok && Array.isArray(res.rows)) ? res.rows : [];
      renderAnnoncesList(rows);
    });
  }
  function showMesAnnonces(){
    showAnnBar(true); showVentesBar(false); showFilter(false);
    if (content) content.innerHTML = '<div class="bbEmpty">Chargement...</div>';
    postNUI('bb_list_my_annonces', {}).then(function(res){
      var rows = (res && res.ok && Array.isArray(res.rows)) ? res.rows : [];
      lastMyRows = rows.slice();
      renderAnnoncesList(rows, 'Vous n\'avez publie aucune annonce.', { my: true });
    });
  }

  function renderNewAnnonceForm(ann){
    showAnnBar(true); showVentesBar(false); showFilter(false);
    if (!content) return;
    editingId = ann ? getAnnId(ann) : null;

    content.innerHTML =
      '<form id="annonce-form" class="bbForm" novalidate>'+
        '<div class="bbNotice" id="annonce-success">'+ (editingId ? 'Annonce mise a jour.' : 'Annonce enregistree.') +'</div>'+
        '<div class="bbError" id="annonce-error"></div>'+
        '<div class="bbForm__row">'+
          '<label for="ann_titre">Titre de l\'annonce</label>'+
          '<input id="ann_titre" name="title" type="text" maxlength="20" required />'+
          '<div class="bbForm__help"><span class="bbForm__counter" data-count-for="ann_titre">0</span>/20</div>'+
        '</div>'+
        '<div class="bbForm__row">'+
          '<label for="ann_msg">Annonce</label>'+
          '<textarea id="ann_msg" name="message" maxlength="140" required></textarea>'+
          '<div class="bbForm__help"><span class="bbForm__counter" data-count-for="ann_msg">0</span>/140</div>'+
        '</div>'+
        '<div class="bbForm__row">'+
          '<label for="ann_contact">Contact (téléphone)</label>'+
          '<input id="ann_contact" name="contact" type="text" maxlength="13" required />'+
        '</div>'+
        '<div class="bbForm__row">'+
          '<label for="ann_author">Auteur (pseudonyme, 16 max)</label>'+
          '<input id="ann_author" name="author" type="text" maxlength="16" required />'+
        '</div>'+
        '<div class="bbForm__actions">'+
          '<button type="button" class="bbBtn bbBtn--primary" id="ann_save">'+ (editingId ? 'Mettre a jour' : 'Enregistrer') +'</button>'+
        '</div>'+
      '</form>'+
      '<div class="bbBottomSpacer" aria-hidden="true"></div>';

    if (ann){
      var t = $('#ann_titre'), m = $('#ann_msg'), c = $('#ann_contact'), a = $('#ann_author');
      if (t) t.value = String(ann.title || '');
      if (m) m.value = String(ann.message || '');
      if (c) c.value = String(ann.contact || '');
      if (a) a.value = String(ann.author || '');
    }

    var counters = content.querySelectorAll('[data-count-for]');
    for (var i=0; i<counters.length; i++){
      (function(span){
        var id = span.getAttribute('data-count-for');
        var el = content.querySelector('#'+id);
        var update = function(){ span.textContent = String((el.value || '').length); };
        el.addEventListener('input', update); update();
      })(counters[i]);
    }

    var err  = $('#annonce-error');
    var ok   = $('#annonce-success');
    var btn  = $('#ann_save');

    function sendAnnonce(){
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
        !author || author.length > 16;
      if (invalid) {
        if (err) { err.textContent = 'Verifiez les champs (longueurs / format du contact).'; err.classList.add('is-visible'); }
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = 'Envoi...'; }

      var payload = { title: title, message: message, contact: contact, author: author };
      var endpoint = 'bb_create_annonce';
      if (editingId) {
        endpoint = 'bb_update_annonce';
        payload.id = editingId;
        payload.annonce_id = editingId;
        payload.uuid = editingId;
      }

      postNUI(endpoint, payload).then(function(res){
        if (btn) { btn.disabled = false; btn.textContent = editingId ? 'Mettre a jour' : 'Enregistrer'; }
        if (!res || !res.ok) {
          if (err) {
            err.textContent = 'Echec de l\'enregistrement.' + (res && res.reason ? ' ('+res.reason+')' : '');
            err.classList.add('is-visible');
          }
          return;
        }
        editingId = null;
        showMesAnnonces();
      });
    }

    if (btn) btn.addEventListener('click', function(e){ e.preventDefault(); sendAnnonce(); });
  }

  // ======================
  // ===== MES VENTES =====
  // ======================
  function renderNewVenteForm(){
    showAnnBar(false); showVentesBar(true); showFilter(false);
    if (!content) return;

    var qtyOptions = '';
    for (var i=1;i<=CONFIG.maxQtyPerSale;i++){ qtyOptions += '<option value="'+i+'">'+i+'</option>'; }

    content.innerHTML =
      '<form id="sale-form" class="saleForm" novalidate>'+
        '<div class="saleForm__group">'+
          '<label><strong>Choisir l\'item à mettre en vente</strong></label>'+
          '<div class="saleRadioList">'+
            SALES_ITEMS.map(function(it, idx){
              var rId = 'sale_item_'+idx;
              return ''+
              '<label class="saleRadio">'+
                '<div class="saleRadio__imgWrap"><img class="saleRadio__img" src="'+INV+it.img+'" alt=""></div>'+
                '<div class="saleRadio__meta">'+
                  '<div class="saleRadio__title">'+it.title+'</div>'+
                  '<div class="saleRadio__price">'+fmtUSD(it.price)+'</div>'+
                '</div>'+
                '<div class="saleRadio__pick">'+
                  '<input type="radio" name="sale_item" value="'+it.id+'" id="'+rId+'"/>'+
                '</div>'+
              '</label>';
            }).join('')+
          '</div>'+
        '</div>'+

        '<div class="saleForm__group saleQtyRow">'+
          '<label for="sale_qty"><strong>Quantité :</strong></label>'+   // ← ajout des deux-points
          '<select id="sale_qty" name="qty">'+ qtyOptions +'</select>'+
        '</div>'+

        '<div class="saleActions">'+
          '<button type="button" class="bbBtn bbBtn--primary" id="sale_submit">Mettre en vente</button>'+
          '<button type="button" class="bbBtn bbBtn--ghost" id="sale_cancel">Annuler</button>'+
        '</div>'+
      '</form>'+
      '<div class="bbBottomSpacer" aria-hidden="true"></div>';

    $('#sale_cancel').addEventListener('click', function(e){
      e.preventDefault(); showMesVentes();
    });

    $('#sale_submit').addEventListener('click', function(e){
      e.preventDefault();
      var sel = document.querySelector('input[name="sale_item"]:checked');
      if (!sel){ lbAlert('Sélection requise', 'Choisis un item à mettre en vente.'); return; }
      var itemId = sel.value;
      var qty = Math.max(1, Math.min(CONFIG.maxQtyPerSale, Number(($('#sale_qty')||{}).value || 1)));

      postNUI('bb_create_sale', { item: itemId, qty: qty }).then(function(res){
        if (!res || !res.ok){
          var reason = res && res.reason || 'unknown';
          if (reason === 'inventory_missing') {
            lbAlert('Inventaire insuffisant', 'Tu dois avoir les items sur toi au moment de la mise en vente.');
          } else if (reason === 'limit_reached') {
            lbAlert('Limite atteinte', 'Tu as déjà le nombre maximum d\'annonces actives ('+CONFIG.maxSalesPerCitizen+').');
          } else if (reason === 'invalid_item') {
            lbAlert('Item invalide', 'Cet item n\'est pas autorisé à la vente.');
          } else {
            lbAlert('Erreur', 'Impossible de créer la vente. ('+reason+')');
          }
          return;
        }
        showMesVentes();
      });
    });
  }

  function saleRowHTML(row){
    var isActive = row && (row.active === 1 || row.active === "1" || row.active === true);
    var meta = SALES_ITEMS.find(function(x){ return x.id === row.item; }) || { img:'', title: row.item, price: row.price||0 };
    var when = frDate(row.created_ts || row.created_at || row.createdAt || row.ts);

    var deliverBtn = isActive
      ? '<button class="bbBtn bbBtn--primary saleCard__deliver" data-id="'+row.id+'">Livrer le colis</button>'
      : '';

    var DEL_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
        '<polyline points="3 6 5 6 21 6"></polyline>'+
        '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>'+
        '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>'+
        '<line x1="10" y1="11" x2="10" y2="17"></line>'+
        '<line x1="14" y1="11" x2="14" y2="17"></line>'+
      '</svg>';

    return ''+
      '<article class="saleCard" data-id="'+row.id+'">'+
        '<button class="saleAct saleAct--del" type="button" data-id="'+row.id+'" aria-label="Supprimer">'+ DEL_SVG +'</button>'+
        '<div class="saleCard__imgWrap"><img class="saleCard__img" src="'+INV+meta.img+'" alt=""></div>'+

        // Colonne centrale : Titre/Qté, puis ligne Prix + Date (ID d’item retiré)
        '<div class="saleCard__body">'+
          '<div class="saleCard__title">'+meta.title+' ×'+(row.qty||1)+'</div>'+
          '<div class="saleCard__metaRow">'+
            '<div class="saleCard__price">'+fmtUSD(meta.price)+'</div>'+
            '<div class="saleCard__date">'+escapeHtml(when)+'</div>'+
          '</div>'+
        '</div>'+

        // Colonne droite : uniquement le bouton "Livrer" si actif
        '<div class="saleCard__right">'+
          deliverBtn+
        '</div>'+
      '</article>';
  }

  function renderSalesList(rows){
    if (!content) return;
    if (!rows || !rows.length){
      content.innerHTML = '<div class="saleEmpty">vous n\'avez pas encore de ventes actives</div><div class="bbBottomSpacer" aria-hidden="true"></div>';
      return;
    }
    content.innerHTML = '<div class="salesList">'+ rows.map(saleRowHTML).join('') +'</div><div class="bbBottomSpacer" aria-hidden="true"></div>';
  }

  function showMesVentes(){
    showAnnBar(false); showVentesBar(true); showFilter(false);
    if (content) content.innerHTML = '<div class="bbEmpty">Chargement...</div>';

    postNUI('bb_list_my_sales', {}).then(function(res){
      var rows = (res && res.ok && Array.isArray(res.rows)) ? res.rows : [];
      renderSalesList(rows);
    });
  }

  // ======== Tabs principaux ========
  var tabs = $('#bb-tabs');
  if (tabs) {
    var tItems = tabs.querySelectorAll('.bb__tab');
    for (var i=0;i<tItems.length;i++) tItems[i].classList.remove('bb__tab--active');
    var marche = tabs.querySelector('[data-tab="marche"]');
    if (marche && marche.parentElement) marche.parentElement.classList.add('bb__tab--active');

    tabs.addEventListener('click', function(e){
      var a = e.target && e.target.closest ? e.target.closest('a[data-tab]') : null;
      if (!a) return;
      e.preventDefault();
      var t = a.getAttribute('data-tab');
      if (t === 'drogues') { if (window.OnionRouter && typeof window.OnionRouter.go === 'function') window.OnionRouter.go('blackbay_drogues'); return; }
      if (t === 'armes')   { if (window.OnionRouter && typeof window.OnionRouter.go === 'function') window.OnionRouter.go('blackbay_armes');   return; }
      if (t === 'marche')  { setActiveSubTab('market'); showMarketDefault(); return; }
    });
  }

  // ======== Sous-onglets ========
  var sub = $('#bb-subtabs');
  function setActiveSubTab(key){
    if (!sub) return;
    var items = sub.querySelectorAll('.bbSub__tab');
    for (var i=0;i<items.length;i++) items[i].classList.remove('bbSub__tab--active');
    var target = sub.querySelector('[data-sub="'+key+'"]');
    if (target && target.parentElement) target.parentElement.classList.add('bbSub__tab--active');
  }

  if (sub){
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
        showAnnBar(false); showVentesBar(false); showFilter(true);
        showMarketDefault();
      } else if (key === 'annonces') {
        showAllAnnonces();
      } else if (key === 'ventes') {
        showMesVentes();
      } else {
        showAnnBar(false); showVentesBar(false); showFilter(false);
        content.innerHTML = '<div class="bbEmpty">vous n\'avez pas encore de ventes actives</div><div class="bbBottomSpacer" aria-hidden="true"></div>';
      }
    });
  }

  // Boutons barres tertiaires
  var btnNew = $('#btn-new-annonce');
  if (btnNew) btnNew.addEventListener('click', function(){ renderNewAnnonceForm(null); });

  var btnMine = $('#btn-my-annonces');
  if (btnMine) btnMine.addEventListener('click', function(e){ e.preventDefault(); showMesAnnonces(); });

  var btnNewVente = $('#btn-new-vente');
  if (btnNewVente) btnNewVente.addEventListener('click', function(e){
    e.preventDefault();
    renderNewVenteForm();
  });

  // Panier bouton (header)
  var cartBtn = document.querySelector('.bbSub__cart');
  if (cartBtn) cartBtn.addEventListener('click', function(e){
    e.preventDefault();
    if (window.OnionRouter && typeof window.OnionRouter.go === 'function') window.OnionRouter.go('blackbay_cart');
  });

  // Démarrages
  function showMarketDefault(){
    showAnnBar(false); showVentesBar(false); showFilter(true);
    applyFilter();
  }

  updateCartBadge();
  setActiveSubTab('market');
  showMarketDefault();
})();
