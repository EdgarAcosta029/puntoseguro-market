/* Arranque de la aplicación y navegación por hash */
window.addEventListener('hashchange',()=>{window.scrollTo(0,0);render()});
loadP().then(()=>{if(S.token)afterLogin();render()}).catch(()=>{$('#app').innerHTML='<p>No se pudo cargar el catálogo. Revisa que el servidor y MySQL estén encendidos.</p>'});
/* Las frases del banner de inicio cambian solas (se pausan con el mouse encima o si el usuario pidió menos movimiento) */
setInterval(()=>{const h=$('#hero');if(!h||HP||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;H=(H+1)%HERO.length;h.innerHTML=heroInner(H)},6500);
/* Chat de pedidos: se revisa cada 4 segundos mientras Mi cuenta está abierta */
setInterval(()=>{if(!document.hidden)loadChats()},4000);
