(function () {
  const ITEMS = [
    { name:'Kit chimie basique', desc:'Béchers, tubes, gants, masques.' },
    { name:'Précurseur A', desc:'Réactif — usage contrôlé.' },
    { name:'Précurseur B', desc:'Additif — pureté 98%.' },
    { name:'Brûleur portable', desc:'Chauffe précis et stable.' },
    { name:'Manuel discret', desc:'Procédures et précautions.' },
    { name:'Containers étanches', desc:'Transport sécurisé.' },
  ];
  const grid = document.getElementById('bb-grid');
  grid.innerHTML = ITEMS.map(it => `<div class="bb__card"><h3>${it.name}</h3><p>${it.desc}</p></div>`).join('');
})();
