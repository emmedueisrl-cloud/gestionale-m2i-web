import React, { useEffect, useState } from 'react';
import { elencaOperatori } from '../../api/operatori';

export default function OperatoreSelect({ name, value, onChange, className = '', placeholder = 'Seleziona operatore' }) {
  const [operatori, setOperatori] = useState([]);

  useEffect(() => {
    elencaOperatori(false).then(lista => setOperatori(lista || [])).catch(console.error);
  }, []);

  const valoreFuoriLista = value && !operatori.some(op => op.nome === value);

  return (
    <select name={name} value={value || ''} onChange={onChange} className={className}>
      <option value="">{placeholder}</option>
      {valoreFuoriLista && <option value={value}>{value} (già assegnato, non disponibile)</option>}
      {operatori.map(operatore => <option key={operatore.id} value={operatore.nome}>{operatore.nome}</option>)}
    </select>
  );
}
