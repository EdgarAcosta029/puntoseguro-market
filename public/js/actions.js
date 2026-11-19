/* Render principal, avisos, confirmación de pedido y acciones (agregar al carrito, login, etc.) */
function render(){const[v,a]=(location.hash.slice(1)||'inicio').split('-');if(v==='producto'&&a&&!RV[a]){RV[a]=[];api('/api/productos/'+a+'/resenas').then(r=>{RV[a]=r;render()}).catch(()=>{})}
$('#app').innerHTML=({inicio:home,catalogo:cat,producto:()=>prod(a),carrito:cart,checkout:chk,gracias:()=>thanks(a),cuenta:acc,ayuda:help,puntos:puntosV}[v]||home)();$('#n').textContent=cnt();if(v==='puntos')initMapa(+a||0);
const b=$('#cb');if(b)b.scrollTop=b.scrollHeight}
function toast(t){const e=$('#ts');e.textContent=t;e.className='on';clearTimeout(toast.h);toast.h=setTimeout(()=>e.className='',2200)}
async function place(){const g=i=>$('#'+i).value.trim();if(place.busy)return;
if(!S.user&&!$('#gu').checked){toast('Marca “Comprar como invitado” o inicia sesión');return}
if(['fn','fe'].some(i=>!g(i))||!/\S+@\S+\.\S+/.test(g('fe'))){toast('Completa tu nombre y un correo válido');return}
const vs=vendedoresCart(),modo=DM||(vs.some(p=>!p.vp)?'chat':'vendedor');
if(modo==='chat'&&!S.user){toast('Para acordar el punto por chat inicia sesión');return}
let pago;try{if(PAY==='tarjeta')pago=validaTarjeta();else if(PAY==='paypal'){const e=g('ppe');if(!/\S+@\S+\.\S+/.test(e))throw new Error('Escribe el correo de tu cuenta de PayPal');if(!await paypalOk(e,tot().t))return;pago={metodo:'paypal',email:e}}else pago={metodo:PAY}}catch(e){toast(e.message);return}
place.busy=true;const bt=$('#pagarbtn');if(bt){bt.disabled=true;bt.textContent=pago.metodo==='tarjeta'||pago.metodo==='paypal'?'Procesando pago…':'Generando tu referencia…'}
try{if(pago.metodo==='tarjeta'||pago.metodo==='paypal')await new Promise(r=>setTimeout(r,900));
const r=await api('/api/pedidos',{method:'POST',body:{items:Object.keys(S.cart).map(k=>({id:pid(k),cant:S.cart[k],variante:vr(k)})),codigo:S.dc?S.dc.codigo:'',nombre:g('fn'),email:g('fe'),pago,modo}});
S.last=r.pagos.map(p=>({...p,email:g('fe')}));S.cart={};S.dc=null;DM='';save();await loadP();if(S.user)loadOrders();location.hash='gracias-'+r.ids.join('_');render()}catch(e){toast(e.message);if(bt){bt.disabled=false;bt.textContent='Pagar '+m(tot().t)}}finally{place.busy=false}}
function act(a,v){switch(a){
case'add':if(esMio(by(v))){toast('No puedes comprar tu propio producto');return}if(incart(v)>=stk(v)){toast(stk(v)?'Ya tienes todas las piezas disponibles':'Producto agotado');return}S.cart[v]=(S.cart[v]||0)+1;toast('Agregado al carrito');break;
case'addp':{const p=by(v);if(esMio(p)){toast('No puedes comprar tu propio producto');return}const o={};for(const x of document.querySelectorAll('[data-og]')){if(!x.value){toast('Elige '+x.dataset.og);return}o[x.dataset.og]=x.value}const k=ckey(v,o),n=Math.min(Math.max(1,+$('#qn').value||1),stk(v)-incart(v));if(n<1){toast('Ya tienes todas las piezas disponibles');return}S.cart[k]=(S.cart[k]||0)+n;toast('Agregado al carrito');break}
case'q':{const j=v.lastIndexOf(','),i=v.slice(0,j),d=+v.slice(j+1);if(d>0&&incart(pid(i))>=stk(pid(i))){toast('No hay más piezas disponibles');return}S.cart[i]+=d;if(S.cart[i]<1)delete S.cart[i];break}
case'rm':delete S.cart[v];break;
case'wish':S.wish=S.wish.includes(+v)?S.wish.filter(x=>x!=v):[...S.wish,+v];if(S.user)api('/api/deseos',{method:'PUT',body:{ids:S.wish}}).catch(()=>{});break;
case'cat':{const[c,s]=v.split('|');Q.cat=c;Q.sub=s||'';break}
case'all':Q={...Q,cat:'',sub:'',max:null,br:[],of:false,con:[],opt:{},vv:false,q:''};break;
case'vw':Q.vw=v;break;case'g':G=+v;break;case'tab':T=v;if(v==='datos'&&S.user)loadDir();if(v==='vender'&&S.user)loadSeller().then(loadChats);if(v==='seguimiento')setTimeout(loadChats,0);break;case'offers':Q.of=true;Q.cat='';Q.sub='';Q.q='';break;case'hero':{H=+v;const h=$('#hero');if(h)h.innerHTML=heroInner(H);return}
case'code':{api('/api/descuento',{method:'POST',body:{codigo:$('#cd').value.trim()}}).then(c=>{S.dc=c;toast('Código aplicado')}).catch(e=>{S.dc=null;toast(e.message)}).finally(()=>{save();render()});return}
case'savec':if(!S.user){toast('Inicia sesión para guardar tu carrito');location.hash='cuenta';return}api('/api/carrito',{method:'PUT',body:{items:S.cart}}).then(()=>{S.saved={...S.cart};toast('Carrito guardado');save();render()}).catch(e=>toast(e.message));return;
case'rest':if(S.saved){S.cart={...S.saved};cleanCart();toast('Carrito restaurado')}break;
case'login':case'reg':{const n=$('#un').value.trim(),e=$('#ue').value.trim(),p=$('#up').value;if(!/\S+@\S+/.test(e)||p.length<6||(a==='reg'&&!n)){toast('Escribe un correo válido, una contraseña de 6 o más caracteres y tu nombre si creas cuenta');return}api(a==='reg'?'/api/registro':'/api/login',{method:'POST',body:{nombre:n,email:e,password:p}}).then(d=>{S.token=d.token;S.user={n:d.user.n,e:d.user.e};S.addr=d.user.direccion||'';S.pref=d.user.pref;return afterLogin()}).catch(x=>toast(x.message));return}
case'out':S.user=null;S.token='';S.orders=[];S.saved=null;DIR=[];break;
case'psend':{const i=$('#mi-'+v),t=i.value.trim();if(!t)return;api('/api/pedidos/'+v+'/mensajes',{method:'POST',body:{texto:t}}).then(()=>{i.value='';return loadChats()}).catch(x=>toast(x.message));return}
case'pprop':{const x=pick('ps-'+v,'pp-'+v);if(!x.punto&&!x.punto_id){toast('Elige un Punto Seguro o escribe el lugar que propones');return}api('/api/pedidos/'+v+'/punto',{method:'POST',body:x}).then(()=>T==='vender'?loadSeller():loadOrders()).then(loadChats).catch(e=>toast(e.message));return}
case'pacc':api('/api/pedidos/'+v+'/aceptar',{method:'POST'}).then(()=>{toast('Punto de entrega acordado');return T==='vender'?loadSeller():loadOrders()}).catch(x=>toast(x.message));return;
case'prec':if(!confirm('¿Ya tienes el producto y lo revisaste? Al confirmar se liberan al vendedor los fondos que estaban en custodia.'))return;api('/api/pedidos/'+v+'/recibido',{method:'POST'}).then(()=>{toast('Entrega confirmada. Fondos liberados al vendedor (simulación)');return loadOrders()}).catch(x=>toast(x.message));return;
case'vpunto':{const x=pick('vps','vpu');api('/api/yo',{method:'PUT',body:x.punto_id?{punto:'x',punto_id:x.punto_id}:{punto:x.punto}}).then(async()=>{const u=await api('/api/yo');S.punto=u.punto||'';S.puntoId=u.puntoId||null;save();toast(S.punto?'Punto de entrega guardado':'Punto de entrega quitado');return loadP()}).then(render).catch(e=>toast(e.message));return}
case'spay':{const o=(S.last||[]).find(x=>x.id==v);api('/api/pedidos/'+v+'/simular-pago',{method:'POST',body:{email:o?o.email:(S.user&&S.user.e)}}).then(()=>{if(o)o.estado='retenido';save();toast('Pago recibido: tus fondos quedaron en custodia');return S.user?loadOrders():0}).then(render).catch(e=>toast(e.message));return}
case'pcan':if(!confirm('¿Cancelar este pedido? Si tu pago ya estaba en custodia, se devuelve al comprador.'))return;api('/api/pedidos/'+v+'/cancelar',{method:'POST'}).then(async()=>{toast('Pedido cancelado');await(T==='vender'?loadSeller():loadOrders());await loadP();render()}).catch(e=>toast(e.message));return;
case'copy':{const f=()=>toast('Copiado');(navigator.clipboard?navigator.clipboard.writeText(v).then(f):Promise.reject()).catch(()=>{const t=document.createElement('textarea');t.value=v;document.body.appendChild(t);t.select();try{document.execCommand('copy');f()}catch(e){}t.remove()});return}
case'pmap':{const mk=MK[v];if(mk&&MAP){MAP.setView(mk.getLatLng(),16);mk.openPopup()}return}
case'ineocr':ineOCR();return;case'inesave':ineSave();return;case'diradd':dirAdd();return;case'dirdel':dirDel(v);return;
case'addr':S.addr=$('#ad').value;api('/api/yo',{method:'PUT',body:{direccion:S.addr}}).then(()=>toast('Datos guardados')).catch(x=>toast(x.message));break;
case'news':{const e=$('#ne').value.trim();if(!/\S+@\S+/.test(e)){toast('Escribe un correo válido');return}api('/api/newsletter',{method:'POST',body:{email:e}}).then(()=>{S.news=1;save();render()}).catch(x=>toast(x.message));return}
case'rev':{const t=$('#rt').value.trim();if(!t){toast('Escribe un comentario');return}api('/api/productos/'+v+'/resenas',{method:'POST',body:{calificacion:+$('#rs').value,comentario:t}}).then(()=>{RV[v]=null;toast('Reseña publicada');return loadP()}).then(render).catch(x=>toast(x.message));return}
case'contact':{const n=$('#kn').value.trim(),e=$('#ke').value.trim(),t=$('#km').value.trim();if(!n||!/\S+@\S+/.test(e)||!t){toast('Completa tu nombre, un correo válido y el mensaje');return}api('/api/contacto',{method:'POST',body:{nombre:n,email:e,mensaje:t}}).then(()=>{toast('Mensaje enviado. Te respondemos en 1 día hábil');render()}).catch(x=>toast(x.message));return}
case'vadd':{const g=i=>$('#'+i).value.trim();api('/api/vender/productos',{method:'POST',body:{nombre:g('vn'),descripcion:g('vde'),categoria:g('vc'),subcategoria:g('vs'),marca:g('vm'),precio:g('vpr'),precio_anterior:g('van'),stock:g('vst'),es_nuevo:$('#vnu').checked,condicion:g('vco'),opciones:[1,2].map(k=>({nombre:g('vo'+k+'n'),valores:g('vo'+k+'v')}))}}).then(async r=>{await uploadSeller(r.id,$('#vfo').files);toast('Producto publicado')}).catch(x=>toast(x.message));return}
case'vsv':api('/api/vender/productos/'+v,{method:'PUT',body:{precio:$('#vp'+v).value,precio_anterior:$('#va'+v).value,stock:$('#vk'+v).value}}).then(()=>{toast('Cambios guardados');return loadSeller().then(loadP)}).catch(x=>toast(x.message));return;
case'vdp':if(!confirm('¿Eliminar este producto y sus fotos?'))return;api('/api/vender/productos/'+v,{method:'DELETE'}).then(()=>{toast('Producto eliminado');return loadSeller().then(loadP)}).catch(x=>toast(x.message));return;
case'vdi':api('/api/vender/imagenes/'+v,{method:'DELETE'}).then(loadSeller).then(loadP).catch(x=>toast(x.message));return;
case'pay':place();return;
case'chat':case'ask':{const i=$('#ci'),t=a==='ask'?v:i.value.trim();if(!t)return;CH.push(['u',t],['bt',bot(t)]);const c=$('#cb');if(c){c.innerHTML=chatHTML();c.scrollTop=c.scrollHeight}if(i){if(a==='chat')i.value='';i.focus()}return}}
save();render()}
