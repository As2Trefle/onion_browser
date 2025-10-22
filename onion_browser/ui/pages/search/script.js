(function () {
  const INDEX = [
    { url:'onion://help/privacy', title:'Conseils de confidentialité', desc:'Réduisez votre empreinte.' },
    { url:'onion://guides/getting-started', title:'Démarrer avec Onion Browser', desc:'Configuration et sécurité.' },
    { url:'onion://news/updates', title:'Mises à jour', desc:'Nouveautés et annonces.' },
    { url:'onion://community/faq', title:'FAQ Communauté', desc:'Astuces et dépannage.' },
  ];

  const elQ    = document.getElementById('search-q');
  const elCnt  = document.getElementById('search-count');
  const elList = document.getElementById('results');

  const q = (sessionStorage.getItem('onion:q') || '').trim();
  elQ.textContent = q || 'Recherche';

  const score = (it, s) => {
    const n = s.toLowerCase();
    const hay = (it.title+' '+it.url+' '+it.desc).toLowerCase();
    let sc = 0;
    for (const tok of n.split(/\s+/).filter(Boolean)) if (hay.includes(tok)) sc++;
    if (it.title.toLowerCase().startsWith(n)) sc += 2;
    return sc;
  };

  function run(needle){
    if (!needle) return INDEX.slice();
    return INDEX.map(it => ({ it, s: score(it, needle) }))
                .filter(x => x.s>0)
                .sort((a,b)=>b.s-a.s)
                .map(x=>x.it);
  }
  function render(arr){
    elList.innerHTML=''; elCnt.textContent=arr.length;
    if (!arr.length){ elList.innerHTML = '<li><div class="r__desc">Aucun résultat.</div></li>'; return; }
    for (const r of arr){
      const li = document.createElement('li');
      li.innerHTML = `<div class="r__url">${r.url}</div><h3 class="r__title">${r.title}</h3><p class="r__desc">${r.desc}</p>`;
      elList.appendChild(li);
    }
  }
  render(run(q));
})();
