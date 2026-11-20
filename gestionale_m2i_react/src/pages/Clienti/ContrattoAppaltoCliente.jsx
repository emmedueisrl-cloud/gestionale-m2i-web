import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { recuperaDatiCompletiCliente } from '../../api/clienti';
import ContrattoAppaltoForm from '../../components/appalto/ContrattoAppaltoForm';

export default function ContrattoAppaltoCliente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    recuperaDatiCompletiCliente(id).then(result => {
      if (!active) return;
      if (result) setCliente(result);
      else setError('Cliente non trovato.');
    }).catch(err => { if (active) setError(err.message || 'Impossibile caricare il cliente.'); });
    return () => { active = false; };
  }, [id]);
  if (error) return <p role="alert" className="rounded-lg bg-red-950 p-5 text-red-200">{error}</p>;
  if (!cliente) return <p className="p-5 text-slate-300">Caricamento cliente...</p>;
  return <div className="mx-auto max-w-6xl p-5"><ContrattoAppaltoForm cliente={cliente} clienteId={id} visura={cliente.visuraDati}
    onClose={() => navigate(`/admin/clienti/scheda/${encodeURIComponent(id)}`)} /></div>;
}
