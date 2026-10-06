import React, { useEffect, useState } from 'react';
import { creaOperatore, elencaOperatori } from '../../api/operatori';

export default function OperatoreSelect({ name, value, onChange, className = '', placeholder = 'Seleziona operatore' }) {
  const [operatori, setOperatori] = useState([]);

  const carica = async () => setOperatori(await elencaOperatori(false) || []);
  useEffect(() => { carica().catch(console.error); }, []);

  const cambia = async event => {
    const prossimo = event.target.value;
    if (prossimo !== '__nuovo__') {
      onChange({ target: { name, value: prossimo } });
      return;
    }
    const nome = window.prompt('Nome del nuovo operatore:');
    if (!nome?.trim()) return;
    try {
      const creato = await creaOperatore(nome);
      await carica();
      onChange({ target: { name, value: creato.nome } });
    } catch (errore) {
      window.alert(errore.message);
    }
  };

  const valoreFuoriLista = value && !operatori.some(op => op.nome.toLocaleLowerCase('it-IT') === String(value).toLocaleLowerCase('it-IT'));

  return (
    <select name={name} value={value || ''} onChange={cambia} className={className}>
      <option value="">{placeholder}</option>
      {valoreFuoriLista && <option value={value}>{value} (cessato)</option>}
      {operatori.map(operatore => <option key={operatore.id} value={operatore.nome}>{operatore.nome}</option>)}
      <option disabled>──────────</option>
      <option value="__nuovo__">＋ Inserisci nuovo operatore</option>
    </select>
  );
}
