import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const base = import.meta.env.VITE_API_URL || '';

async function authRequest(path, options = {}) {
  const response = await fetch(`${base}/api/auth${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Richiesta non riuscita (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

export default function Utenti() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', role: 'user' });
  const [resetId, setResetId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => setUsers(await authRequest('/users'));

  useEffect(() => {
    authRequest('/me').then(async current => {
      setMe(current);
      if (current.role === 'admin') setUsers(await authRequest('/users'));
    }).catch(err => setError(err.message));
  }, []);

  const run = async action => {
    setError('');
    setMessage('');
    try { await action(); } catch (err) { setError(err.message); }
  };

  const createUser = event => {
    event.preventDefault();
    run(async () => {
      await authRequest('/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ email: '', password: '', role: 'user' });
      await refresh();
      setMessage('Account creato. Comunica la password alla persona interessata tramite un canale riservato.');
    });
  };

  const resetUserPassword = event => {
    event.preventDefault();
    run(async () => {
      await authRequest(`/users/${resetId}/password`, {
        method: 'PUT', body: JSON.stringify({ password: resetPassword })
      });
      setResetPassword('');
      setResetId(null);
      setMessage('Password aggiornata. Le sessioni precedenti sono state chiuse.');
    });
  };

  const changeOwnPassword = event => {
    event.preventDefault();
    run(async () => {
      await authRequest('/me/password', {
        method: 'PUT', body: JSON.stringify({ currentPassword, newPassword })
      });
      setCurrentPassword('');
      setNewPassword('');
      navigate('/');
    });
  };

  return (
    <div className="space-y-8 text-slate-100">
      <h2 className="text-xl font-bold">Account e password</h2>
      {error && <p role="alert" className="rounded bg-red-900/40 p-3 text-red-200">{error}</p>}
      {message && <p role="status" className="rounded bg-green-900/40 p-3 text-green-200">{message}</p>}

      <form onSubmit={changeOwnPassword} className="space-y-3">
        <h3 className="font-semibold">Cambia la mia password</h3>
        <input className="w-full rounded bg-slate-800 p-2" type="password" autoComplete="current-password" required
          placeholder="Password attuale" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
        <input className="w-full rounded bg-slate-800 p-2" type="password" autoComplete="new-password" minLength={12} required
          placeholder="Nuova password (almeno 12 caratteri)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        <button className="rounded bg-indigo-600 px-4 py-2" type="submit">Aggiorna password</button>
      </form>

      {me?.role === 'admin' && <>
        <form onSubmit={createUser} className="space-y-3 border-t border-slate-700 pt-6">
          <h3 className="font-semibold">Crea account individuale</h3>
          <input className="w-full rounded bg-slate-800 p-2" type="email" autoComplete="off" required placeholder="E-mail"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="w-full rounded bg-slate-800 p-2" type="password" autoComplete="new-password" minLength={12} required
            placeholder="Password iniziale (almeno 12 caratteri)" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} />
          <select className="w-full rounded bg-slate-800 p-2" value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="user">Utente</option><option value="contabilita">Contabilità (fatture e pagamenti)</option><option value="admin">Amministratore</option>
          </select>
          <button className="rounded bg-indigo-600 px-4 py-2" type="submit">Crea account</button>
        </form>

        <section className="space-y-3 border-t border-slate-700 pt-6">
          <h3 className="font-semibold">Account esistenti</h3>
          {users.map(user => <div key={user.id} className="flex flex-wrap items-center gap-3 border-b border-slate-700 py-2">
            <span className="min-w-52 flex-1 break-all">{user.email}</span>
            <span>{user.role === 'admin' ? 'Amministratore' : user.role === 'contabilita' ? 'Contabilità' : 'Utente'} · {user.active ? 'Attivo' : 'Disattivato'}</span>
            <button className="rounded bg-slate-700 px-3 py-1" type="button" onClick={() => {
              setResetId(user.id); setResetPassword('');
            }}>Reimposta password</button>
            {user.id !== me.id && <button className="rounded bg-slate-700 px-3 py-1" type="button"
              onClick={() => run(async () => {
                await authRequest(`/users/${user.id}/active`, {
                  method: 'PATCH', body: JSON.stringify({ active: !user.active })
                });
                await refresh();
              })}>{user.active ? 'Disattiva' : 'Riattiva'}</button>}
          </div>)}
        </section>

        {resetId !== null && <form onSubmit={resetUserPassword} className="space-y-3 border-t border-slate-700 pt-6">
          <h3 className="font-semibold">Nuova password per l’account selezionato</h3>
          <input className="w-full rounded bg-slate-800 p-2" type="password" autoComplete="new-password" minLength={12} required
            value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
          <button className="rounded bg-indigo-600 px-4 py-2" type="submit">Conferma reimpostazione</button>
          <button className="ml-3 rounded bg-slate-700 px-4 py-2" type="button" onClick={() => setResetId(null)}>Annulla</button>
        </form>}
      </>}
    </div>
  );
}
