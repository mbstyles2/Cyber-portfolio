(function(){
  var root=document.documentElement, btn=document.getElementById('theme'), lab=document.getElementById('theme-label');
  function current(){
    var t=root.getAttribute('data-theme');
    if(t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  }
  function sync(){
    var t=current();
    btn.setAttribute('aria-pressed', t==='dark');
    btn.setAttribute('aria-label','Switch to '+(t==='dark'?'light':'dark')+' theme');
    lab.textContent=t==='dark'?'Light':'Dark';
  }
  try{var s=localStorage.getItem('nf-theme'); if(s) root.setAttribute('data-theme',s);}catch(e){}
  sync();
  btn.addEventListener('click',function(){
    var n=current()==='dark'?'light':'dark';
    root.setAttribute('data-theme',n);
    try{localStorage.setItem('nf-theme',n);}catch(e){}
    sync();
  });

  var names=['Assess','Test','Plan','Train','Secure'];
  var tick='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  var grid=document.getElementById('grid'), cells=[], html='';
  if(!grid) return;
  names.forEach(function(n,r){
    html+='<div class="row"><span>'+n+'</span>';
    for(var d=0;d<7;d++) html+='<div class="cell" data-i="'+(d*5+r)+'">'+tick+'</div>';
    html+='</div>';
  });
  grid.innerHTML=html;
  cells=[].slice.call(grid.querySelectorAll('.cell'));
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){cells.forEach(function(c){c.classList.add('on')});return;}
  cells.sort(function(a,b){return a.dataset.i-b.dataset.i}).forEach(function(c,i){
    setTimeout(function(){c.classList.add('on')},300+i*45);
  });
})();

(function(){var f=document.getElementById('contact-form');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();var d=new FormData(f);var body='Name: '+d.get('name')+'\nEmail: '+d.get('email')+'\nPhone: '+(d.get('phone')||'-')+'\nService of interest: '+d.get('service')+'\n\n'+d.get('message');location.href='mailto:info@nexfortified.com?subject='+encodeURIComponent('Enquiry from '+d.get('name'))+'&body='+encodeURIComponent(body);});})();

(function(){
  var dd=document.querySelector('.dropdown'); if(!dd) return;
  var btn=dd.querySelector('.dd-btn');
  function set(o){dd.classList.toggle('open',o);btn.setAttribute('aria-expanded',o);}
  btn.addEventListener('click',function(){set(!dd.classList.contains('open'));});
  document.addEventListener('click',function(e){if(!dd.contains(e.target)) set(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&dd.classList.contains('open')){set(false);btn.focus();}});
  dd.addEventListener('focusout',function(e){if(!dd.contains(e.relatedTarget)) set(false);});
  if(window.matchMedia('(hover:hover)').matches){
    dd.addEventListener('mouseenter',function(){set(true);});
    dd.addEventListener('mouseleave',function(){set(false);});
  }
})();
