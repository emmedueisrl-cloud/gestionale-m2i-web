const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

async function main() {
  const url = 'https://m2i-backend.onrender.com/api/run';

  // 1. Conta clienti totali online
  const r1 = await (await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({functionName:'recuperaElencoClientiModifica',args:[]}) })).json();
  const clienti = r1.data || [];
  console.log('1. Clienti totali online:', clienti.length);

  // 2. Cerca "fantasma" Fisio.Cast
  const fantasma = clienti.find(c => c.partita_iva === '05701431008');
  console.log('2. Cliente "fantasma" Fisio.Cast esiste?', fantasma ? 'SI - ID: ' + fantasma.id : 'NO');

  // 3. Cerca Condominio
  const cond = clienti.find(c => c.ragione_sociale && c.ragione_sociale.includes('TOR DE'));
  console.log('3. Condominio Via Tor de Schiavi:', cond ? 'SI - ID: ' + cond.id : 'NO');

  // 4. Cerca Zappadu tra dipendenti
  const r2 = await (await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({functionName:'elencoTuttiIDipendenti',args:[]}) })).json();
  const dip = r2.data || [];
  console.log('4. Dipendenti totali online:', dip.length);
  const zappadu = dip.find(d => d.cognome && d.cognome.toUpperCase().includes('ZAPPADU'));
  console.log('5. Zappadu:', zappadu ? 'SI - ' + zappadu.id : 'NO');
  const giacinti = dip.find(d => d.cognome && d.cognome.toUpperCase().includes('GIACINTI'));
  console.log('6. Di Giacinti:', giacinti ? 'SI (ancora presente) - ' + giacinti.id : 'NO (correttamente eliminato)');
}

main().catch(console.error);
