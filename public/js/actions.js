/* Render principal, avisos, confirmación de pedido y acciones (agregar al carrito, login, etc.) */
function render(){const[v,a]=(location.hash.slice(1)||'inicio').split('-');if(v==='producto'&&a&&!RV[a]){RV[a]=[];api('/api/productos/'+a+'/resenas').then(r=>{RV[a]=r;render()}).catch(()=>{})}
$('#app').innerHTML=({inicio:home,catalogo:cat,producto:()=>prod(a),carrito:cart,checkout:chk,gracias:()=>thanks(a),cuenta:acc,ayuda:help}[v]||home)();$('#n').textContent=cnt();
const b=$('#cb');if(b)b.scrollTop=b.scrollHeight}
function toast(t){const e=$('#ts');e.textContent=t;e.className='on';clearTimeout(toast.h);toast.h=setTimeout(()=>e.className='',2200)}
async function place(){const g=i=>$('#'+i).value.trim();
if(!S.user&&!$('#gu').checked){toast('Marca “Comprar como invitado” o inicia sesión');return}
if(['fn','fe'].some(i=>!g(i))){toast('Completa tu nombre y correo');return}
const vs=vendedoresCart(),modo=DM||(vs.some(p=>!p.vp)?'chat':'vendedor');
if(modo==='chat'&&!S.user){toast('Para acordar el punto por chat inicia sesión');return}
if(PAY==='tarjeta'&&!/^\d{16}$/.test(g('cn').replace(/\s/g,''))){toast('Revisa el número de tarjeta');return}
try{const r=await api('/api/pedidos',{method:'POST',body:{items:Object.keys(S.cart).map(i=>({id:+i,cant:S.cart[i]})),codigo:S.dc?S.dc.codigo:'',nombre:g('fn'),email:g('fe'),pago:PAY,modo}});
S.cart={};S.dc=null;DM='';save();await loadP();if(S.user)loadOrders();location.hash='gracias-'+r.ids.join('_');render()}catch(e){toast(e.message)}}
function act(a,v){switch(a){
case'add':if(esMio(by(v))){toast('No puedes comprar tu propio producto');return}if((S.cart[v]||0)>=stk(v)){toast(stk(v)?'Ya tienes todas las piezas disponibles':'Producto agotado');return}S.cart[v]=(S.cart[v]||0)+1;toast('Agregado al carrito');break;
case'addp':{if(esMio(by(v))){toast('No puedes comprar tu propio producto');return}const n=Math.min(Math.max(1,+$('#qn').value||1),stk(v)-(S.cart[v]||0));if(n<1){toast('Ya tienes todas las piezas disponibles');return}S.cart[v]=(S.cart[v]||0)+n;toast('Agregado al carrito');break}
case'q':{const[i,d]=v.split(',');if(+d>0&&S.cart[i]>=stk(i)){toast('No hay más piezas disponibles');return}S.cart[i]+=+d;if(S.cart[i]<1)delete S.cart[i];break}
case'rm':delete S.cart[v];break;
case'wish':S.wish=S.wish.includes(+v)?S.wish.filter(x=>x!=v):[...S.wish,+v];if(S.user)api('/api/deseos',{method:'PUT',body:{ids:S.wish}}).catch(()=>{});break;
case'cat':{const[c,s]=v.split('|');Q.cat=c;Q.sub=s||'';break}
case'all':Q={...Q,cat:'',sub:'',max:null,br:[],of:false,q:''};break;
case'vw':Q.vw=v;break;case'g':G=+v;break;case'tab':T=v;if(v==='vender'&&S.user)loadSeller().then(loadChats);if(v==='seguimiento')setTimeout(loadChats,0);break;case'offers':Q.of=true;Q.cat='';Q.sub='';Q.q='';break;case'hero':{H=+v;const h=$('#hero');if(h)h.innerHTML=heroInner(H);return}
case'code':{api('/api/descuento',{method:'POST',body:{codigo:$('#cd').value.trim()}}).then(c=>{S.dc=c;toast('Código aplicado')}).catch(e=>{S.dc=null;toast(e.message)}).finally(()=>{save();render()});return}
case'savec':if(!S.user){toast('Inicia sesión para guardar tu carrito');location.hash='cuenta';return}api('/api/carrito',{method:'PUT',body:{items:S.cart}}).then(()=>{S.saved={...S.cart};toast('Carrito guardado');save();render()}).catch(e=>toast(e.message));return;
case'rest':if(S.saved){S.cart={...S.saved};cleanCart();toast('Carrito restaurado')}break;
case'login':case'reg':{const n=$('#un').value.trim(),e=$('#ue').value.trim(),p=$('#up').value;if(!/\S+@\S+/.test(e)||p.length<6||(a==='reg'&&!n)){toast('Escribe un correo válido, una contraseña de 6 o más caracteres y tu nombre si creas cuenta');return}api(a==='reg'?'/api/registro':'/api/login',{method:'POST',body:{nombre:n,email:e,password:p}}).then(d=>{S.token=d.token;S.user={n:d.user.n,e:d.user.e};S.addr=d.user.direccion||'';S.pref=d.user.pref;return afterLogin()}).catch(x=>toast(x.message));return}
case'out':S.user=null;S.token='';S.orders=[];S.saved=null;break;
case'psend':{const i=$('#mi-'+v),t=i.value.trim();if(!t)return;api('/api/pedidos/'+v+'/mensajes',{method:'POST',body:{texto:t}}).then(()=>{i.value='';return loadChats()}).catch(x=>toast(x.message));return}
case'pprop':{const t=$('#pp-'+v).value.trim();if(!t){toast('Escribe el lugar que propones');return}api('/api/pedidos/'+v+'/punto',{method:'POST',body:{punto:t}}).then(()=>T==='vender'?loadSeller():loadOrders()).then(loadChats).catch(x=>toast(x.message));return}
case'pacc':api('/api/pedidos/'+v+'/aceptar',{method:'POST'}).then(()=>{toast('Punto de entrega acordado');return T==='vender'?loadSeller():loadOrders()}).catch(x=>toast(x.message));return;
case'prec':if(!confirm('¿Ya tienes el producto y lo revisaste? Al confirmar se libera el pago al vendedor.'))return;api('/api/pedidos/'+v+'/recibido',{method:'POST'}).then(()=>{toast('Entrega confirmada');return loadOrders()}).catch(x=>toast(x.message));return;
case'vpunto':{const t=$('#vpu').value.trim();api('/api/yo',{method:'PUT',body:{punto:t}}).then(()=>{S.punto=t;save();toast(t?'Punto de entrega guardado':'Punto de entrega quitado');return loadP()}).then(render).catch(x=>toast(x.message));return}
case'addr':S.addr=$('#ad').value;api('/api/yo',{method:'PUT',body:{direccion:S.addr}}).then(()=>toast('Datos guardados')).catch(x=>toast(x.message));break;
case'news':{const e=$('#ne').value.trim();if(!/\S+@\S+/.test(e)){toast('Escribe un correo válido');return}api('/api/newsletter',{method:'POST',body:{email:e}}).then(()=>{S.news=1;save();render()}).catch(x=>toast(x.message));return}
case'rev':{const t=$('#rt').value.trim();if(!t){toast('Escribe un comentario');return}api('/api/productos/'+v+'/resenas',{method:'POST',body:{calificacion:+$('#rs').value,comentario:t}}).then(()=>{RV[v]=null;toast('Reseña publicada');return loadP()}).then(render).catch(x=>toast(x.message));return}
case'contact':{const n=$('#kn').value.trim(),e=$('#ke').value.trim(),t=$('#km').value.trim();if(!n||!/\S+@\S+/.test(e)||!t){toast('Completa tu nombre, un correo válido y el mensaje');return}api('/api/contacto',{method:'POST',body:{nombre:n,email:e,mensaje:t}}).then(()=>{toast('Mensaje enviado. Te respondemos en 1 día hábil');render()}).catch(x=>toast(x.message));return}
case'vadd':{const g=i=>$('#'+i).value.trim();api('/api/vender/productos',{method:'POST',body:{nombre:g('vn'),descripcion:g('vde'),categoria:g('vc'),subcategoria:g('vs'),marca:g('vm'),precio:g('vpr'),precio_anterior:g('van'),stock:g('vst'),es_nuevo:$('#vnu').checked}}).then(async r=>{await uploadSeller(r.id,$('#vfo').files);toast('Producto publicado')}).catch(x=>toast(x.message));return}
case'vsv':api('/api/vender/productos/'+v,{method:'PUT',body:{precio:$('#vp'+v).value,precio_anterior:$('#va'+v).value,stock:$('#vk'+v).value}}).then(()=>{toast('Cambios guardados');return loadSeller().then(loadP)}).catch(x=>toast(x.message));return;
case'vdp':if(!confirm('¿Eliminar este producto y sus fotos?'))return;api('/api/vender/productos/'+v,{method:'DELETE'}).then(()=>{toast('Producto eliminado');return loadSeller().then(loadP)}).catch(x=>toast(x.message));return;
case'vdi':api('/api/vender/imagenes/'+v,{method:'DELETE'}).then(loadSeller).then(loadP).catch(x=>toast(x.message));return;
case'pay':place();return;
case'chat':case'ask':{const i=$('#ci'),t=a==='ask'?v:i.value.trim();if(!t)return;CH.push(['u',t],['bt',bot(t)]);const c=$('#cb');if(c){c.innerHTML=chatHTML();c.scrollTop=c.scrollHeight}if(i){if(a==='chat')i.value='';i.focus()}return}}
save();render()}
