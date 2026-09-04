const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
async function check() {
  const r1 = await (await fetch('https://m2i-backend.onrender.com/api/run', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({functionName:'recuperaElencoClientiModifica',args:[]}) })).json();
  const clienti = r1.data || [];
  const trovato = clienti.find(c => c.partita_iva === '02313740363');
  console.log('Trovato:', trovato ? trovato.ragione_sociale : 'NO');
}
check();
