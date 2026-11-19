/* Datos: el catálogo se carga desde la API (MySQL) con loadP() */
let P=[],CATS={},BR=[],OV={};
function setP(l){P=l;CATS={};P.forEach(p=>(CATS[p.c]=CATS[p.c]||new Set()).add(p.s));BR=[...new Set(P.map(p=>p.b))];OV={};P.forEach(p=>Object.entries(p.ops||{}).forEach(([k,v])=>{(OV[k]=OV[k]||new Set());v.forEach(x=>OV[k].add(x))}))}
