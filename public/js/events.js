/* Eventos globales: clics, búsqueda con autocompletar, filtros y teclado */
document.addEventListener('click',e=>{if(!e.target.closest('.sr')||e.target.closest('#sg a'))$('#sg').hidden=true;const t=e.target.closest('[data-a]');if(t)act(t.dataset.a,t.dataset.v)});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='q'){const v=t.value.trim().toLowerCase(),b=$('#sg');if(!v){b.hidden=true;return}b.innerHTML=P.filter(p=>(p.n+p.b).toLowerCase().includes(v)).slice(0,5).map(p=>`<a href="#producto-${p.id}">${p.e} ${p.n}</a>`).join('')||'<span class="mut">Sin resultados</span>';b.hidden=false}if(t.id==='mx')$('#mxv').textContent=+t.value>=pmax()?'Sin límite':m(+t.value);
if(t.id==='pcn'){const d=t.value.replace(/\D/g,'').slice(0,16),mk=marcaTarjeta(d),x=mk==='American Express'?d.slice(0,15):d;t.value=agrupa(x,mk);const b=$('#pbr');if(b)b.textContent=mk}
if(t.id==='pcx'){const d=t.value.replace(/\D/g,'').slice(0,4);t.value=d.length>2?d.slice(0,2)+'/'+d.slice(2):d}});
document.addEventListener('change',e=>{const t=e.target,i=t.dataset.i;if(t.dataset.vup){uploadSeller(t.dataset.vup,t.files);return}if(t.id==='ine-f'){inePrev(t);return}if(!i)return;
if(i==='pref'){S.pref[t.dataset.v]=+t.checked;save();if(S.user)api('/api/yo',{method:'PUT',body:{pref:S.pref}}).catch(()=>{});return}
if(i==='dm'){DM=t.value;return}
if(i==='pay'){PAY=t.value;$('#payf').innerHTML=payFields();return}
if(i==='con')Q.con=t.checked?[...Q.con,t.value]:Q.con.filter(x=>x!==t.value);if(i==='opt'){const k=t.dataset.k,l=Q.opt[k]||[];Q.opt={...Q.opt,[k]:t.checked?[...l,t.value]:l.filter(x=>x!==t.value)}}if(i==='vv')Q.vv=t.checked;
if(i==='sort')Q.sort=t.value;if(i==='max')Q.max=+t.value>=pmax()?null:+t.value;if(i==='of')Q.of=t.checked;
if(i==='brand')Q.br=t.checked?[...Q.br,t.value]:Q.br.filter(x=>x!==t.value);render()});
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;if(e.target.id==='ci')act('chat');if((e.target.id||'').startsWith('mi-'))act('psend',e.target.id.slice(3));if(e.target.id==='q'){Q={...Q,cat:'',sub:'',max:null,br:[],of:false,con:[],opt:{},vv:false,q:e.target.value.trim()};$('#sg').hidden=true;location.hash='catalogo';render()}});
document.addEventListener('mousemove',e=>{const z=e.target.closest('.zoom');if(z){const r=z.getBoundingClientRect(),s=z.querySelector('span');s.style.transformOrigin=((e.clientX-r.left)/r.width*100)+'% '+((e.clientY-r.top)/r.height*100)+'%'}});
document.addEventListener('mouseover',e=>{HP=!!e.target.closest('#hero')});
document.addEventListener('focusout',()=>{HP=false});
