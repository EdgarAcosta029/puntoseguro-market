/* Comunicación con el servidor (API REST) */
const api=(u,o={})=>{const fd=o.body instanceof FormData;return fetch(u,{method:o.method||'GET',headers:{...(fd?{}:{'Content-Type':'application/json'}),...(S.token?{Authorization:'Bearer '+S.token}:{})},body:o.body?(fd?o.body:JSON.stringify(o.body)):undefined}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401&&S.token){S.token='';S.user=null;save()}throw new Error(d.error||'Error del servidor')}return d})};
const loadP=()=>api('/api/productos').then(l=>{setP(l);cleanCart()});
function cleanCart(){for(const i of Object.keys(S.cart)){const p=by(i);if(!p||esMio(p)||!p.stock)delete S.cart[i];else S.cart[i]=Math.min(S.cart[i],p.stock)}save()}
const loadOrders=()=>api('/api/pedidos').then(l=>{S.orders=l;save();render()}).catch(()=>{});
async function afterLogin(){try{const u=await api('/api/yo');S.user={n:u.n,e:u.e,id:u.id};S.addr=u.direccion||'';S.punto=u.punto||'';S.pref=u.pref}catch(e){render();return}try{const c=await api('/api/carrito');S.saved=Object.keys(c.items).length?c.items:null;S.wish=(await api('/api/deseos')).ids}catch(e){}cleanCart();await loadOrders();save();render();if(T==='vender')loadSeller()}
/* Sección "Vender" de Mi cuenta */
let SV={categorias:[],marcas:[],productos:[],ventas:[]};
async function loadSeller(){try{const[a,v]=await Promise.all([api('/api/vender/productos'),api('/api/vender/ventas')]);SV={...a,ventas:v};render()}catch(e){toast(e.message)}}
async function uploadSeller(id,files){let f=0;for(const x of files){const fd=new FormData();fd.append('imagen',x);try{await api('/api/vender/productos/'+id+'/imagenes',{method:'POST',body:fd})}catch(e){f++}}if(f)toast(f+' foto(s) no se subieron (JPG, PNG o WEBP de hasta 4 MB)');await loadSeller();await loadP()}
/* Chat de cada pedido: se guarda en OM para no perder los mensajes al redibujar; el sondeo solo actualiza la lista */
const chatList=(n)=>{const o=OM[n];return o&&o.msgs.length?o.msgs.map(x=>`<div class="m ${x.mio?'u':'bt'}"><small>${esc(x.mio?'Tú':x.quien)} · ${x.h}</small><br>${esc(x.t)}</div>`).join(''):'<p class="mut">Aún no hay mensajes. Escribe para coordinar la entrega.</p>'};
const pedidosChat=()=>(T==='seguimiento'?S.orders:T==='vender'?SV.ventas:[]).filter(o=>o.modo!=='tienda'&&!o.inv&&(o.st<2||OM[o.n]));
async function loadChats(){if(!S.user||!/^#cuenta/.test(location.hash))return;let cambio=false;
for(const o of pedidosChat()){try{const r=await api('/api/pedidos/'+o.n+'/mensajes'),p=OM[o.n],igual=p&&p.msgs.length===r.msgs.length;
if(p&&(p.st!==r.st||p.prop!==r.prop||p.punto!==r.punto))cambio=true;OM[o.n]=r;
const l=$('#cm-'+o.n);if(l&&!igual){l.innerHTML=chatList(o.n);l.scrollTop=l.scrollHeight}}catch(e){}}
if(cambio){if(T==='vender')await loadSeller();else await loadOrders()}}
