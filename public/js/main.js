/* Arranque de la aplicación y navegación por hash */
window.addEventListener('hashchange',()=>{window.scrollTo(0,0);render()});
loadPS();loadP().then(()=>{if(S.token)afterLogin();render()}).catch(()=>{$('#app').innerHTML='<p>No se pudo cargar el catálogo. Revisa que el servidor y la base de datos estén en línea.</p>'});
/* Las frases del banner de inicio cambian solas (se pausan con el mouse encima o si el usuario pidió menos movimiento) */
setInterval(()=>{const h=$('#hero');if(!h||HP||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;H=(H+1)%HERO.length;h.innerHTML=heroInner(H)},6500);
/* Chat de pedidos: se revisa cada 4 segundos mientras Mi cuenta está abierta */
setInterval(()=>{if(!document.hidden)loadChats()},4000);

/* Modo claro u oscuro: sigue al sistema hasta que la persona elige; la elección se recuerda en este navegador */
(()=>{const b=document.getElementById('tm'),mq=matchMedia('(prefers-color-scheme: dark)'),R=document.documentElement;
const SUN='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',MOON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const oscuro=()=>R.dataset.theme?R.dataset.theme==='dark':mq.matches;
function pinta(){const d=oscuro();b.innerHTML=(d?SUN+'Modo claro':MOON+'Modo oscuro');b.setAttribute('aria-label',d?'Cambiar a modo claro':'Cambiar a modo oscuro')}
b.addEventListener('click',()=>{const t=oscuro()?'light':'dark';R.dataset.theme=t;try{localStorage.setItem('tema',t)}catch(e){}pinta()});
mq.addEventListener&&mq.addEventListener('change',pinta);pinta()})();