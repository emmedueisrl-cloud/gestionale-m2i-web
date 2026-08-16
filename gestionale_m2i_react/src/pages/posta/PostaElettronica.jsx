import React, { useState, useEffect, useMemo } from 'react';

// Safe date formatter helper
const formatDateSafe = (dateString) => {
  if (!dateString) return 'N/D';
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) {
    return String(dateString);
  }
  const now = new Date();
  
  // If today: show HH:MM
  if (parsed.toDateString() === now.toDateString()) {
    return parsed.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  
  // If this year: show Day Month (e.g. 13 lug)
  if (parsed.getFullYear() === now.getFullYear()) {
    return parsed.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  }
  
  // Older: show DD/MM/YYYY
  return parsed.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Pastel colors for sender avatars
const getAvatarColor = (name = '') => {
  const colors = [
    '#f87171', '#fb923c', '#fbbf24', '#34d399', '#2dd4bf', 
    '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#f472b6'
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
};

import { recuperaTuttiIDipendenti } from '../../api/dipendenti';
import { recuperaTuttiIClienti } from '../../api/clienti';

export default function PostaElettronica() {
  const showStatus = (type, title, msg) => console.log(type, title, msg);
  const [emails, setEmails] = useState([]);
  const [dipendenti, setDipendenti] = useState([]);
  const [clienti, setClienti] = useState([]);

  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);

  // Attachment linking states
  const [linkingAttachment, setLinkingAttachment] = useState(null);
  const [linkingCandidateId, setLinkingCandidateId] = useState('');
  const [linkingDocType, setLinkingDocType] = useState('cv');
  const [submittingLink, setSubmittingLink] = useState(false);

  // Custom confirmation modal state
  const [confirmModalData, setConfirmModalData] = useState(null);

  const showConfirm = (message) => {
    return new Promise((resolve) => {
      setConfirmModalData({
        message,
        onConfirm: () => {
          setConfirmModalData(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmModalData(null);
          resolve(false);
        }
      });
    });
  };

  const handleConfirmLink = async (att, forceOverwrite = false) => {
    if (!linkingCandidateId) return;

    // Optional frontend client-side warning check (safety measure)
    const dip = dipendenti.find(c => String(c.id) === String(linkingCandidateId));
    if (dip && !forceOverwrite) {
      if (linkingDocType === 'cv' && dip.link_cv && dip.link_cv.trim() !== '') {
        const confirmOverwrite = await showConfirm(`Il Dipendente ${dip.nome} ${dip.cognome} ha già un Curriculum Vitae collegato. Vuoi sostituirlo con questo allegato?`);
        if (!confirmOverwrite) return;
      } else if (linkingDocType === 'doc' && dip.link_documenti && dip.link_documenti.trim() !== '') {
        const confirmOverwrite = await showConfirm(`Il Dipendente ${dip.nome} ${dip.cognome} ha già un Documento d'identità collegato. Vuoi sostituirlo con questo allegato?`);
        if (!confirmOverwrite) return;
      }
    }

    try {
      setSubmittingLink(true);
      showStatus('loading', 'Collegamento allegato...', 'Collegamento del file alla scheda Dipendente in corso...');
      const res = await fetch(`/api/dipendenti/${linkingCandidateId}/collega-allegato`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localName: att.localName,
          filename: att.filename,
          tipo_documento: linkingDocType,
          overwrite: forceOverwrite
        })
      });
      const json = await res.json();
      if (json.success) {
        showStatus('success', 'Allegato collegato!', `L'allegato "${att.filename}" è stato collegato con successo.`);
        setLinkingAttachment(null);
        setLinkingCandidateId('');
        if (typeof fetchdipendenti === 'function') {
          await fetchdipendenti();
        }
      } else if (json.error === 'already_exists') {
        const confirmOverwrite = await showConfirm(json.message);
        if (confirmOverwrite) {
          await handleConfirmLink(att, true);
        }
      } else {
        showStatus('error', 'Errore di collegamento', json.error || 'Impossibile collegare l\'allegato.');
      }
    } catch (err) {
      showStatus('error', 'Errore di rete', err.message);
    } finally {
      setSubmittingLink(false);
    }
  };
  
  // Navigation & Folders
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Floating Compose Drawer
  const [isComposing, setIsComposing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Form states
  const [destinatario, setDestinatario] = useState('');
  const [oggetto, setOggetto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [selectedDipendenteId, setSelectedDipendenteId] = useState('');
  const [selectedclienteId, setSelectedclienteId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('custom');

  // IMAP Sync States
  const [syncing, setSyncing] = useState(false);
  const [offset, setOffset] = useState(0);

  // Load emails
  const fetchEmails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/emails`);
      const json = await res.json();
      if (json.success) {
        setEmails(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncEmails = async (isLoadMore = false) => {
    try {
      setSyncing(true);
      const nextOffset = isLoadMore ? offset + 50 : 0;
      
      showStatus('loading', 'Sincronizzazione...', isLoadMore ? 'Recupero messaggi meno recenti...' : 'Sincronizzazione con il server Aruba in corso...');
      
      const res = await fetch(`/api/emails/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50, offset: nextOffset })
      });
      const json = await res.json();
      if (json.success) {
        showStatus('success', 'Sincronizzazione completata!', isLoadMore 
          ? `Caricati altri messaggi (nuovi messaggi salvati: ${json.addedCount || 0}).`
          : `La casella postale è aggiornata (nuovi messaggi scaricati: ${json.addedCount || 0}).`);
        
        if (isLoadMore) {
          setOffset(nextOffset);
        } else {
          setOffset(0); // Reset offset on fresh sync
        }
        await fetchEmails();
    recuperaTuttiIDipendenti().then(d => setDipendenti(d || []));
    recuperaTuttiIClienti().then(c => setClienti(c || []));
      } else {
        showStatus('error', 'Errore sincronizzazione', json.error || 'Impossibile connettersi ad Aruba.');
      }
    } catch (err) {
      showStatus('error', 'Errore di connessione', err.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchEmails();
    recuperaTuttiIDipendenti().then(d => setDipendenti(d || []));
    recuperaTuttiIClienti().then(c => setClienti(c || []));
    if (typeof fetchdipendenti === 'function') {
      fetchdipendenti();
    }
  }, []);

  // Templates definition
  const templates = {
    custom: { label: 'Scrittura Libera', subject: '', body: '' },
    colloquio: {
      label: 'Richiesta di Colloquio',
      subject: 'Convocazione Colloquio Conoscitivo - HEMA Selezione',
      body: 'Gentile Dipendente,\n\nin merito alla sua candidatura inserita nel nostro database, vorremmo concordare un colloquio conoscitivo in presenza o video-call.\n\nLe chiediamo cortesemente di comunicarci la sua disponibilità per i primi giorni della prossima settimana.\n\nUn cordiale saluto,\nTeam Risorse Umane'
    },
    presentazione_cv: {
      label: 'Presentazione CV al Cliente',
      subject: 'Presentazione Profilo Dipendente per cliente in Corso',
      body: 'Spettabile Cliente,\n\nin merito al mandato di cliente da voi affidatoci, vi inoltriamo in allegato il profilo del Dipendente selezionato che riteniamo in linea con le vostre richieste.\n\nRestiamo a disposizione per programmare un colloquio di approfondimento.\n\nCordiali saluti,\nArea Selezione Personale'
    },
    assunzione: {
      label: 'Comunicazione Assunzione',
      subject: 'Conferma Assunzione e Invio Scheda Amministrativa',
      body: 'Gentile Collaboratore,\n\nsiamo lieti di confermarle il superamento del periodo di prova e la formalizzazione dell\'assunzione.\n\nLe trasmettiamo in allegato la scheda riepilogativa da firmare e rispedire per avviare le pratiche amministrative.\n\nBenvenuto a bordo,\nAmministrazione HR'
    }
  };

  // Handle template selection
  const handleTemplateChange = (type) => {
    setSelectedTemplate(type);
    if (type !== 'custom') {
      setOggetto(templates[type].subject);
      setCorpo(templates[type].body);
    } else {
      setOggetto('');
      setCorpo('');
    }
  };

  // Autocomplete/fill details on candidate select
  const handleDipendenteSelect = (id) => {
    setSelectedDipendenteId(id);
    if (id) {
      setSelectedclienteId('');
      const dip = dipendenti.find(c => String(c.id) === id);
      if (dip) {
        setDestinatario(dip.email || 'EMAIL NON PRESENTE');
      }
    } else {
      setDestinatario('');
    }
  };

  const handleClienteSelect = (id) => {
    setSelectedclienteId(id);
    if (id) {
      setSelectedDipendenteId('');
      const cli = clienti.find(r => String(r.id) === id);
      if (cli) {
        setDestinatario(cli.email || 'EMAIL NON PRESENTE');
      }
    } else {
      setDestinatario('');
    }
  };

  // Toggle favorite / star status
  const toggleStar = async (id, currentVal, e) => {
    if (e) e.stopPropagation();
    const newVal = currentVal === 1 ? 0 : 1;
    // Optimistic UI update
    setEmails(prev => prev.map(item => item.id === id ? { ...item, preferito: newVal } : item));
    if (selectedEmail && selectedEmail.id === id) {
      setSelectedEmail(prev => ({ ...prev, preferito: newVal }));
    }
    
    try {
      await fetch(`/api/emails/${id}/preferito`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferito: newVal })
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle read/unread status
  const toggleReadStatus = async (id, currentVal, e) => {
    if (e) e.stopPropagation();
    const newVal = currentVal === 1 ? 0 : 1;
    setEmails(prev => prev.map(item => item.id === id ? { ...item, letto: newVal } : item));
    if (selectedEmail && selectedEmail.id === id) {
      setSelectedEmail(prev => ({ ...prev, letto: newVal }));
    }

    try {
      await fetch(`/api/emails/${id}/letto`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letto: newVal })
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Move single or batch to folder (trash, spam, etc.)
  const moveToFolder = async (ids, folder, e) => {
    if (e) e.stopPropagation();
    const idList = Array.isArray(ids) ? ids : [ids];
    
    // Optimistic update
    setEmails(prev => prev.map(item => idList.includes(item.id) ? { ...item, cartella: folder } : item));
    if (selectedEmail && idList.includes(selectedEmail.id)) {
      setSelectedEmail(null);
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      idList.forEach(id => next.delete(id));
      return next;
    });

    try {
      await Promise.all(idList.map(id => 
        fetch(`/api/emails/${id}/cartella`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cartella: folder })
        })
      ));
      showStatus('success', 'Operazione completata', `E-mail spostate in ${folder === 'trash' ? 'Cestino' : folder}.`);
    } catch (err) {
      console.error(err);
      showStatus('error', 'Errore', 'Impossibile completare lo spostamento.');
    }
  };

  // Permanently delete from trash
  const deletePermanently = async (ids, e) => {
    if (e) e.stopPropagation();
    const idList = Array.isArray(ids) ? ids : [ids];
    
    if (!window.confirm("Sei sicuro di voler eliminare DEFINITIVAMENTE questi messaggi? Non potrai più recuperarli.")) {
      return;
    }

    setEmails(prev => prev.filter(item => !idList.includes(item.id)));
    if (selectedEmail && idList.includes(selectedEmail.id)) {
      setSelectedEmail(null);
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      idList.forEach(id => next.delete(id));
      return next;
    });

    try {
      await Promise.all(idList.map(id => 
        fetch(`/api/emails/${id}`, { method: 'DELETE' })
      ));
      showStatus('success', 'Eliminazione completata', 'Messaggi eliminati definitivamente.');
    } catch (err) {
      console.error(err);
    }
  };

  // Batch actions
  const handleBatchStar = async (starred) => {
    const list = Array.from(selectedIds);
    setEmails(prev => prev.map(item => list.includes(item.id) ? { ...item, preferito: starred ? 1 : 0 } : item));
    setSelectedIds(new Set());
    try {
      await Promise.all(list.map(id => 
        fetch(`/api/emails/${id}/preferito`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferito: starred ? 1 : 0 })
        })
      ));
    } catch (e) {
      console.error(e);
    }
  };

  const handleBatchRead = async (read) => {
    const list = Array.from(selectedIds);
    setEmails(prev => prev.map(item => list.includes(item.id) ? { ...item, letto: read ? 1 : 0 } : item));
    setSelectedIds(new Set());
    try {
      await Promise.all(list.map(id => 
        fetch(`/api/emails/${id}/letto`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ letto: read ? 1 : 0 })
        })
      ));
    } catch (e) {
      console.error(e);
    }
  };

  // Selection toggle
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const ids = currentFolderEmails.map(item => item.id);
      setSelectedIds(new Set(ids));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Handle send email
  const handleSend = async (e) => {
    e.preventDefault();
    if (!destinatario || !oggetto || !corpo) {
      showStatus("warning", "Attenzione", "Compila tutti i campi obbligatori!");
      return;
    }

    try {
      showStatus('loading', 'Invio e-mail...', 'Trasmissione del messaggio in corso...');
      const res = await fetch(`/api/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinatario,
          oggetto,
          corpo,
          id_dipendente: selectedDipendenteId || null,
          id_cliente: selectedclienteId || null,
          tipo: selectedTemplate === 'custom' ? 'custom' : selectedTemplate
        })
      });
      const json = await res.json();
      if (json.success) {
        showStatus('success', 'E-mail inviata!', json.stato === 'Simulata' 
          ? 'Simulazione completata con successo (credenziali SMTP non configurate).' 
          : 'E-mail inviata con successo tramite il server SMTP.');
        
        // Reset composer
        setDestinatario('');
        setOggetto('');
        setCorpo('');
        setSelectedDipendenteId('');
        setSelectedclienteId('');
        setSelectedTemplate('custom');
        setIsComposing(false);
        
        // Refresh email list
        await fetchEmails();
    recuperaTuttiIDipendenti().then(d => setDipendenti(d || []));
    recuperaTuttiIClienti().then(c => setClienti(c || []));
      } else {
        showStatus('error', 'Errore invio', json.error || 'Impossibile completare l\'operazione.');
      }
    } catch (err) {
      showStatus('error', 'Errore di connessione', err.message);
    }
  };

  // Reply email
  const handleReply = (email) => {
    setDestinatario(email.mittente);
    setOggetto(`Risp: ${email.oggetto}`);
    setCorpo(`\n\n--- Il giorno ${new Date(email.data_invio).toLocaleString('it-IT')} <${email.mittente}> ha scritto:\n> ${email.corpo.split('\n').join('\n> ')}`);
    setIsComposing(true);
    setIsMinimized(false);
  };

  // Filter and display current folder emails
  const currentFolderEmails = useMemo(() => {
    let list = emails;
    if (currentFolder === 'speciali') {
      list = emails.filter(e => e.preferito === 1 && e.cartella !== 'trash');
    } else if (currentFolder === 'posticipati') {
      list = emails.filter(e => e.data_posticipato != null && e.cartella !== 'trash');
    } else {
      list = emails.filter(e => e.cartella === currentFolder);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(e => 
      (e.destinatario || '').toLowerCase().includes(q) ||
      (e.oggetto || '').toLowerCase().includes(q) ||
      (e.corpo || '').toLowerCase().includes(q) ||
      (e.mittente || '').toLowerCase().includes(q)
    );
  }, [emails, currentFolder, searchQuery]);

  // Unread folder counts
  const counts = useMemo(() => {
    return {
      inbox: emails.filter(e => e.cartella === 'inbox' && e.letto === 0).length,
      spam: emails.filter(e => e.cartella === 'spam' && e.letto === 0).length,
      trash: emails.filter(e => e.cartella === 'trash' && e.letto === 0).length,
    };
  }, [emails]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px', height: 'calc(100vh - 120px)', minHeight: '600px', position: 'relative', fontFamily: "'Inter', 'Roboto', sans-serif" }}>
      
      {/* Styles Injection */}
      <style>{`
        .gmail-sidebar-item {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #94a3b8;
          transition: all 0.2s ease;
          margin-bottom: 4px;
          border: 1px solid transparent;
        }
        .gmail-sidebar-item:hover {
          background-color: #1e293b;
          color: #f8fafc;
        }
        .gmail-sidebar-item.active {
          background-color: #1e293b;
          color: #f8fafc;
          font-weight: 600;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border: 1px solid #334155;
        }
        .email-row {
          display: grid;
          grid-template-columns: 40px 30px 220px 1fr 100px;
          align-items: center;
          padding: 14px 20px;
          border-bottom: 1px solid #1e293b;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #0f172a;
        }
        .email-row:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          z-index: 2;
          background: #1e293b;
          border-radius: 8px;
          transform: translateY(-1px);
        }
        .email-row.unread {
          font-weight: 700;
          color: #f8fafc;
        }
        .email-row.selected {
          background: rgba(79, 70, 229, 0.1);
        }
        .hover-actions-trigger {
          position: relative;
        }
        .hover-actions {
          display: none;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: #1e293b;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid #334155;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
          gap: 12px;
        }
        .email-row:hover .hover-actions {
          display: flex;
        }
        
        /* Modern Scrollbar for emails list */
        .emails-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .emails-scroll::-webkit-scrollbar-track {
          background: #0f172a; 
        }
        .emails-scroll::-webkit-scrollbar-thumb {
          background: #334155; 
          border-radius: 4px;
        }
        .emails-scroll::-webkit-scrollbar-thumb:hover {
          background: #475569; 
        }
      `}</style>

      {/* LEFT SIDEBAR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '10px' }}>
        
        {/* Pill Scrivi Button */}
        <button
          onClick={() => {
            setIsComposing(true);
            setIsMinimized(false);
          }}
          style={{
            borderRadius: '16px',
            padding: '14px 24px',
            fontSize: '15px',
            fontWeight: 600,
            backgroundColor: '#4f46e5',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)',
            width: '100%',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s, transform 0.1s'
          }}
          onMouseOver={e=>e.currentTarget.style.backgroundColor='#4338ca'}
          onMouseOut={e=>e.currentTarget.style.backgroundColor='#4f46e5'}
          onMouseDown={e=>e.currentTarget.style.transform='scale(0.98)'}
          onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
        >
          <span style={{ fontSize: '18px' }}>✏️</span>
          Scrivi Messaggio
        </button>

        {/* Folders List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          
          <div 
            className={`gmail-sidebar-item ${currentFolder === 'inbox' ? 'active' : ''}`}
            onClick={() => { setCurrentFolder('inbox'); setSelectedEmail(null); }}
          >
            <span style={{ fontSize: '18px' }}>📥</span>
            <span style={{ flex: 1 }}>Posta in arrivo</span>
            {counts.inbox > 0 && (
              <span style={{ backgroundColor: 'rgba(79, 70, 229, 0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                {counts.inbox}
              </span>
            )}
          </div>

          <div 
            className={`gmail-sidebar-item ${currentFolder === 'speciali' ? 'active' : ''}`}
            onClick={() => { setCurrentFolder('speciali'); setSelectedEmail(null); }}
          >
            <span style={{ fontSize: '18px' }}>⭐</span>
            <span style={{ flex: 1 }}>Speciali</span>
          </div>

          <div 
            className={`gmail-sidebar-item ${currentFolder === 'posticipati' ? 'active' : ''}`}
            onClick={() => { setCurrentFolder('posticipati'); setSelectedEmail(null); }}
          >
            <span style={{ fontSize: '18px' }}>⏰</span>
            <span style={{ flex: 1 }}>Posticipati</span>
          </div>

          <div 
            className={`gmail-sidebar-item ${currentFolder === 'sent' ? 'active' : ''}`}
            onClick={() => { setCurrentFolder('sent'); setSelectedEmail(null); }}
          >
            <span style={{ fontSize: '18px' }}>📤</span>
            <span style={{ flex: 1 }}>Inviate</span>
          </div>

          <div 
            className={`gmail-sidebar-item ${currentFolder === 'spam' ? 'active' : ''}`}
            onClick={() => { setCurrentFolder('spam'); setSelectedEmail(null); }}
          >
            <span style={{ fontSize: '18px' }}>🚫</span>
            <span style={{ flex: 1 }}>Spam</span>
            {counts.spam > 0 && (
              <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                {counts.spam}
              </span>
            )}
          </div>

          <div 
            className={`gmail-sidebar-item ${currentFolder === 'trash' ? 'active' : ''}`}
            onClick={() => { setCurrentFolder('trash'); setSelectedEmail(null); }}
          >
            <span style={{ fontSize: '18px' }}>🗑️</span>
            <span style={{ flex: 1 }}>Cestino</span>
          </div>

        </div>

      </div>

      {/* RIGHT PANE: LIST OR VIEW */}
      <div style={{ 
        background: '#0f172a', 
        border: '1px solid #1e293b', 
        borderRadius: '16px', 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.2)'
      }}>

        {/* 1. Top Search Bar */}
        <div style={{ 
          padding: '16px 24px', 
          borderBottom: '1px solid #1e293b', 
          background: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: '#1e293b', 
            borderRadius: '12px', 
            padding: '10px 16px',
            flex: 1,
            maxWidth: '720px',
            border: '1px solid #334155',
            transition: 'border-color 0.2s'
          }}
          onFocus={e => e.currentTarget.style.borderColor = '#818cf8'}
          onBlur={e => e.currentTarget.style.borderColor = '#334155'}
          >
            <span style={{ fontSize: '16px', marginRight: '12px', color: '#94a3b8' }}>🔍</span>
            <input 
              type="text" 
              placeholder="Cerca nella posta..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', padding: 0, outline: 'none', boxShadow: 'none', width: '100%', color: '#f8fafc', fontSize: '14px' }}
            />
          </div>
          <button 
            onClick={fetchEmails}
            style={{ padding: '10px 20px', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
            onMouseOver={e=>{e.currentTarget.style.background='#334155'; e.currentTarget.style.color='#f8fafc';}}
            onMouseOut={e=>{e.currentTarget.style.background='#1e293b'; e.currentTarget.style.color='#cbd5e1';}}
          >
            🔄 Ricarica
          </button>
          <button 
            onClick={() => handleSyncEmails(false)} disabled={syncing}
            style={{ padding: '10px 20px', borderRadius: '12px', background: syncing ? '#334155' : '#4f46e5', border: 'none', color: 'white', cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
            onMouseOver={e=>{if(!syncing) e.currentTarget.style.background='#4338ca';}}
            onMouseOut={e=>{if(!syncing) e.currentTarget.style.background='#4f46e5';}}
          >
            {syncing ? '⏳ Sincronizzazione...' : '🌐 Sincronizza'}
          </button>
        </div>

        {/* 2. List or Detail View */}
        {!selectedEmail ? (
          /* EMAIL LISTING */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Action Bar (Top Controls) */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '12px 24px', 
              background: '#0f172a', 
              borderBottom: '1px solid #1e293b'
            }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <input 
                  type="checkbox" 
                  checked={currentFolderEmails.length > 0 && selectedIds.size === currentFolderEmails.length}
                  onChange={handleSelectAll} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#818cf8' }}
                />
                
                {/* Batch Actions buttons */}
                {selectedIds.size > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button style={{padding:'6px 12px', borderRadius:'8px', background:'#1e293b', border:'1px solid #334155', color:'#cbd5e1', cursor:'pointer', fontSize:'12px', fontWeight:500, display:'flex', alignItems:'center', gap:'6px'}} onClick={() => handleBatchRead(true)}><span>📧</span> Letto</button>
                    <button style={{padding:'6px 12px', borderRadius:'8px', background:'#1e293b', border:'1px solid #334155', color:'#cbd5e1', cursor:'pointer', fontSize:'12px', fontWeight:500, display:'flex', alignItems:'center', gap:'6px'}} onClick={() => handleBatchRead(false)}><span>📩</span> Non Letto</button>
                    <button style={{padding:'6px 12px', borderRadius:'8px', background:'#1e293b', border:'1px solid #334155', color:'#cbd5e1', cursor:'pointer', fontSize:'12px', fontWeight:500, display:'flex', alignItems:'center', gap:'6px'}} onClick={() => handleBatchStar(true)}><span>⭐</span> Speciale</button>
                    
                    {currentFolder !== 'trash' ? (
                      <button style={{padding:'6px 12px', borderRadius:'8px', background:'rgba(239, 68, 68, 0.1)', border:'1px solid rgba(239, 68, 68, 0.2)', color:'#ef4444', cursor:'pointer', fontSize:'12px', fontWeight:500, display:'flex', alignItems:'center', gap:'6px'}} onClick={() => moveToFolder(Array.from(selectedIds), 'trash')}><span>🗑️</span> Cestino</button>
                    ) : (
                      <button style={{padding:'6px 12px', borderRadius:'8px', background:'rgba(239, 68, 68, 0.1)', border:'1px solid rgba(239, 68, 68, 0.2)', color:'#ef4444', cursor:'pointer', fontSize:'12px', fontWeight:500, display:'flex', alignItems:'center', gap:'6px'}} onClick={() => deletePermanently(Array.from(selectedIds))}><span>🗑️</span> Elimina Definitivamente</button>
                    )}
                    {currentFolder !== 'spam' && currentFolder !== 'trash' && (
                      <button style={{padding:'6px 12px', borderRadius:'8px', background:'#1e293b', border:'1px solid #334155', color:'#cbd5e1', cursor:'pointer', fontSize:'12px', fontWeight:500, display:'flex', alignItems:'center', gap:'6px'}} onClick={() => moveToFolder(Array.from(selectedIds), 'spam')}><span>🚫</span> Spam</button>
                    )}
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>
                {currentFolderEmails.length > 0 ? `1-${currentFolderEmails.length} di ${currentFolderEmails.length}` : '0-0 di 0'}
              </div>

            </div>

            {/* Emails Scrollable Area */}
            <div className="emails-scroll" style={{ flex: 1, overflowY: 'auto', background: '#0f172a' }}>
              {loading && emails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '32px', animation: 'spin 2s linear infinite' }}>⏳</span> 
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>Caricamento in corso...</span>
                </div>
              ) : currentFolderEmails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '100px 20px', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                    📭
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '18px', fontWeight: 600 }}>Nessun messaggio</h3>
                    <p style={{ margin: 0, fontSize: '14px' }}>Non ci sono e-mail in questa cartella al momento.</p>
                  </div>
                </div>
              ) : (
                currentFolderEmails.map(e => {
                  const isStarred = e.preferito === 1;
                  const isRead = e.letto === 1;
                  const isChecked = selectedIds.has(e.id);
                  const senderName = e.cartella === 'sent' ? `A: ${e.destinatario}` : e.mittente.split('@')[0];

                  return (
                    <div 
                      key={e.id}
                      className={`email-row ${!isRead ? 'unread' : ''} ${isChecked ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedEmail(e);
                        // Automatically mark as read when opened
                        if (!isRead) {
                          toggleReadStatus(e.id, 0);
                        }
                      }}
                    >
                      {/* Checkbox */}
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={(event) => handleSelectRow(e.id, event)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                      />

                      {/* Star */}
                      <span 
                        onClick={(event) => toggleStar(e.id, e.preferito, event)}
                        style={{ fontSize: '16px', color: isStarred ? '#f59e0b' : '#9ca3af', cursor: 'pointer' }}
                      >
                        {isStarred ? '★' : '☆'}
                      </span>

                      {/* Sender */}
                      <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>
                        {senderName}
                      </span>

                      {/* Subject and snippet */}
                      <div style={{ display: 'flex', gap: '8px', overflow: 'hidden', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{e.oggetto}</span>
                        <span style={{ color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          — {e.corpo}
                        </span>
                      </div>

                      {/* Date / Hover actions */}
                      <div className="hover-actions-trigger" style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span>{formatDateSafe(e.data_invio)}</span>
                        
                        {/* Hover Actions */}
                        <div className="hover-actions">
                          <span 
                            title={isRead ? "Segna come da leggere" : "Segna come letto"}
                            onClick={(event) => toggleReadStatus(e.id, e.letto, event)}
                            style={{ cursor: 'pointer', fontSize: '14px' }}
                          >
                            {isRead ? '📧' : '📩'}
                          </span>
                          {e.cartella !== 'trash' ? (
                            <span 
                              title="Sposta nel Cestino"
                              onClick={(event) => moveToFolder(e.id, 'trash', event)}
                              style={{ cursor: 'pointer', fontSize: '14px' }}
                            >
                              🗑️
                            </span>
                          ) : (
                            <span 
                              title="Elimina definitivamente"
                              onClick={(event) => deletePermanently(e.id, event)}
                              style={{ cursor: 'pointer', fontSize: '14px' }}
                            >
                              ❌
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {currentFolder === 'inbox' && currentFolderEmails.length > 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => handleSyncEmails(true)}
                    disabled={syncing}
                    style={{ padding: '8px 24px', borderRadius: '20px', fontWeight: 600 }}
                  >
                    {syncing ? '⏳ Caricamento...' : '⬇️ Carica altre e-mail (meno recenti)'}
                  </button>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* DETAILED EMAIL VIEW */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
            
            {/* Detail Actions Top Bar */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '20px', 
              padding: '12px 20px', 
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)'
            }}>
              
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setSelectedEmail(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                ⬅️ Torna alla lista
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '1px solid var(--border)', paddingLeft: '20px' }}>
                <span 
                  title="Aggiungi/Rimuovi da Speciali"
                  onClick={() => toggleStar(selectedEmail.id, selectedEmail.preferito)}
                  style={{ fontSize: '20px', cursor: 'pointer', color: selectedEmail.preferito === 1 ? '#f59e0b' : '#9ca3af' }}
                >
                  {selectedEmail.preferito === 1 ? '★' : '☆'}
                </span>

                <span 
                  title={selectedEmail.letto === 1 ? "Segna come da leggere" : "Segna come letto"}
                  onClick={() => { toggleReadStatus(selectedEmail.id, selectedEmail.letto); setSelectedEmail(null); }}
                  style={{ fontSize: '18px', cursor: 'pointer' }}
                >
                  {selectedEmail.letto === 1 ? '📧' : '📩'}
                </span>

                {selectedEmail.cartella !== 'trash' ? (
                  <button 
                    className="btn btn-danger btn-xs" 
                    title="Sposta nel Cestino"
                    onClick={() => moveToFolder(selectedEmail.id, 'trash')}
                  >
                    🗑️ Sposta nel Cestino
                  </button>
                ) : (
                  <button 
                    className="btn btn-danger btn-xs" 
                    title="Elimina Definitivamente"
                    onClick={() => deletePermanently(selectedEmail.id)}
                  >
                    🗑️ Elimina Definitivamente
                  </button>
                )}

                {selectedEmail.cartella !== 'spam' && selectedEmail.cartella !== 'trash' && (
                  <button 
                    className="btn btn-secondary btn-xs"
                    onClick={() => moveToFolder(selectedEmail.id, 'spam')}
                  >
                    🚫 Segna come Spam
                  </button>
                )}
                
                {selectedEmail.cartella === 'trash' || selectedEmail.cartella === 'spam' ? (
                  <button 
                    className="btn btn-secondary btn-xs"
                    onClick={() => moveToFolder(selectedEmail.id, 'inbox')}
                  >
                    📥 Sposta in Posta in Arrivo
                  </button>
                ) : null}
              </div>

            </div>

            {/* Email Header Metadata */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
              
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
                {selectedEmail.oggetto}
              </h2>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                {/* Sender Avatar */}
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  background: getAvatarColor(selectedEmail.mittente), 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: 'bold',
                  fontSize: '18px'
                }}>
                  {(selectedEmail.mittente || 'H')[0].toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{selectedEmail.mittente}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {new Date(selectedEmail.data_invio).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    a {selectedEmail.destinatario}
                  </div>
                </div>
              </div>

            </div>

            {/* Email Content scrollable area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px', background: 'var(--bg-primary)' }}>
              
              {/* Linked Subject Metadata Box */}
              {(selectedEmail.id_dipendente || selectedEmail.id_cliente) && (
                <div style={{ 
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '10px', 
                  padding: '12px 16px',
                  marginBottom: '24px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  fontSize: '13px'
                }}>
                  {selectedEmail.id_dipendente && (
                    <div>
                      🔗 <strong>Dipendente:</strong>{' '}
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        {dipendenti.find(c => String(c.id) === String(selectedEmail.id_dipendente))?.cognome || 'Vedi Profilo'} 
                        {' '}{dipendenti.find(c => String(c.id) === String(selectedEmail.id_dipendente))?.nome || ''}
                      </span>
                    </div>
                  )}
                  {selectedEmail.id_cliente && (
                    <div>
                      💼 <strong>Mandato:</strong>{' '}
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        {clienti.find(r => String(r.id) === String(selectedEmail.id_cliente))?.azienda || 'Vedi cliente'} 
                        {' '}- {clienti.find(r => String(r.id) === String(selectedEmail.id_cliente))?.ruolo || ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ 
                whiteSpace: 'pre-wrap', 
                lineHeight: 1.6, 
                fontSize: '14px', 
                color: 'var(--text-primary)',
                fontFamily: 'inherit'
              }}>
                {selectedEmail.corpo}
              </div>

              {/* Email Attachments Render */}
              {(() => {
                let parsedAllegati = [];
                if (selectedEmail.allegati) {
                  try {
                    parsedAllegati = typeof selectedEmail.allegati === 'string'
                      ? JSON.parse(selectedEmail.allegati)
                      : selectedEmail.allegati;
                  } catch (e) {
                    console.error("Errore parsing allegati:", e);
                  }
                }
                
                if (!parsedAllegati || parsedAllegati.length === 0) return null;
                
                const formatSize = (bytes) => {
                  if (!bytes) return '';
                  if (bytes < 1024) return `${bytes} B`;
                  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
                  return `${(bytes / 1048576).toFixed(1)} MB`;
                };

                return (
                  <div style={{ 
                    marginTop: '30px', 
                    padding: '16px', 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border)', 
                    borderRadius: '10px' 
                  }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: 600, 
                      color: 'var(--text-primary)', 
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      📎 Allegati ({parsedAllegati.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {parsedAllegati.map((att, i) => {
                        const fileUrl = `${API_BASE.replace('/api', '')}/uploads/doc/${att.localName}`;
                        const isCurrentlyLinking = linkingAttachment && linkingAttachment.localName === att.localName;
                        return (
                          <div key={i} style={{ 
                            background: 'var(--bg-primary)', 
                            border: '1px solid var(--border)', 
                            borderRadius: '8px',
                            padding: '10px 14px', 
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            fontSize: '13px'
                          }}>
                            {/* Main row */}
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              width: '100%'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                <span style={{ fontSize: '18px' }}>📄</span>
                                <span style={{ 
                                  fontWeight: 500, 
                                  color: 'var(--text-primary)', 
                                  textOverflow: 'ellipsis', 
                                  overflow: 'hidden', 
                                  whiteSpace: 'nowrap' 
                                }}>
                                  {att.filename}
                                </span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                                  ({formatSize(att.size)})
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isCurrentlyLinking) {
                                      setLinkingAttachment(null);
                                      setLinkingCandidateId('');
                                    } else {
                                      setLinkingAttachment(att);
                                      setLinkingCandidateId('');
                                    }
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: isCurrentlyLinking ? 'var(--border)' : 'rgba(79, 70, 229, 0.1)',
                                    color: isCurrentlyLinking ? 'var(--text-secondary)' : 'var(--primary)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                  }}
                                >
                                  🔗 Collega
                                </button>
                                <a 
                                  href={fileUrl} 
                                  download={att.filename}
                                  target="_blank" 
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                                  onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                  ⬇️ Scarica
                                </a>
                              </div>
                            </div>

                            {/* Inline linking container */}
                            {isCurrentlyLinking && (
                              <div style={{ 
                                padding: '12px', 
                                background: 'var(--bg-secondary)', 
                                border: '1px dashed var(--primary)', 
                                borderRadius: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                marginTop: '4px'
                              }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  Collega questo allegato ad un Dipendente:
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <select 
                                    value={linkingCandidateId} 
                                    onChange={(e) => setLinkingCandidateId(e.target.value)}
                                    className="form-control"
                                    style={{ flex: 1, minWidth: '180px', height: '32px', fontSize: '13px', padding: '4px 8px' }}
                                  >
                                    <option value="">-- Seleziona Dipendente --</option>
                                    {[...dipendenti].sort((a,b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`)).map(c => (
                                      <option key={c.id} value={c.id}>{c.cognome} {c.nome} ({c.email || 'N/D'})</option>
                                    ))}
                                  </select>

                                  <select 
                                    value={linkingDocType} 
                                    onChange={(e) => setLinkingDocType(e.target.value)}
                                    className="form-control"
                                    style={{ width: '180px', height: '32px', fontSize: '13px', padding: '4px 8px' }}
                                  >
                                    <option value="cv">Curriculum Vitae (CV)</option>
                                    <option value="doc">Documento Identità</option>
                                  </select>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button 
                                    type="button" 
                                    className="btn btn-secondary btn-xs"
                                    onClick={() => {
                                      setLinkingAttachment(null);
                                      setLinkingCandidateId('');
                                    }}
                                  >
                                    Annulla
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn btn-primary btn-xs"
                                    disabled={!linkingCandidateId || submittingLink}
                                    onClick={() => handleConfirmLink(att)}
                                  >
                                    {submittingLink ? 'Collegamento...' : 'Conferma Collegamento'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Action reply at bottom */}
              <div style={{ marginTop: '40px', borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleReply(selectedEmail)}>
                  ↩️ Rispondi
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setOggetto(`Inoltra: ${selectedEmail.oggetto}`);
                    setCorpo(`\n\n---------- Messaggio inoltrato ----------\nDa: <${selectedEmail.mittente}>\nData: ${new Date(selectedEmail.data_invio).toLocaleString('it-IT')}\nOggetto: ${selectedEmail.oggetto}\nA: <${selectedEmail.destinatario}>\n\n${selectedEmail.corpo}`);
                    setDestinatario('');
                    setIsComposing(true);
                    setIsMinimized(false);
                  }}
                >
                  ➡️ Inoltra
                </button>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* 3. FLOATING COMPOSE WIDGET (Gmail-Style Drawer at bottom-right) */}
      {isComposing && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '80px',
          width: '560px',
          height: isMinimized ? '48px' : '600px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 15px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          overflow: 'hidden',
          transition: 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          
          {/* Header Compose Widget */}
          <div style={{
            background: '#1e293b',
            color: '#f8fafc',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            borderBottom: isMinimized ? 'none' : '1px solid #334155'
          }} onClick={() => setIsMinimized(!isMinimized)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>✏️</span>
              <strong style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.3px' }}>Nuovo Messaggio</strong>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#94a3b8', transition: 'color 0.2s' }} title="Riduci/Ingrandisci" onMouseOver={e=>e.target.style.color='#f8fafc'} onMouseOut={e=>e.target.style.color='#94a3b8'}>
                {isMinimized ? '🗖' : '🗕'}
              </span>
              <span 
                style={{ fontSize: '18px', fontWeight: 'bold', color: '#94a3b8', transition: 'color 0.2s' }} 
                title="Chiudi bozza" 
                onMouseOver={e=>e.target.style.color='#ef4444'} onMouseOut={e=>e.target.style.color='#94a3b8'}
                onClick={(e) => { e.stopPropagation(); setIsComposing(false); }}
              >
                ✕
              </span>
            </div>
          </div>

          {/* Form Content */}
          {!isMinimized && (
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              
              <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, background: '#0f172a' }}>
                
                {/* Collega Record */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Collega Dipendente</label>
                    <select 
                      value={selectedDipendenteId} 
                      onChange={(e) => handleDipendenteSelect(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', outline: 'none' }}
                    >
                      <option value="" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>-- Nessuno --</option>
                      {dipendenti.map(c => (
                        <option key={c.id} value={c.id} style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>{c.nomeCompleto}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Collega Cliente</label>
                    <select 
                      value={selectedclienteId} 
                      onChange={(e) => handleClienteSelect(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', outline: 'none' }}
                    >
                      <option value="" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>-- Nessuno --</option>
                      {clienti.map(r => (
                        <option key={r.id} value={r.id} style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>{r.ragione_sociale}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Destinatario */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>A <span style={{color: '#f87171'}}>*</span></label>
                  <input 
                    type="email" 
                    required
                    placeholder="destinatario@mail.it" 
                    value={destinatario}
                    onChange={(e) => setDestinatario(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Oggetto */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>Oggetto <span style={{color: '#f87171'}}>*</span></label>
                  <input 
                    type="text" 
                    required
                    placeholder="Oggetto dell'e-mail..." 
                    value={oggetto}
                    onChange={(e) => setOggetto(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Message Body */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>Corpo del Messaggio <span style={{color: '#f87171'}}>*</span></label>
                  <textarea 
                    required
                    placeholder="Scrivi il messaggio qui..." 
                    value={corpo}
                    onChange={(e) => setCorpo(e.target.value)}
                    style={{ 
                      flex: 1, 
                      resize: 'none', 
                      padding: '12px', 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155', 
                      borderRadius: '8px', 
                      color: '#f8fafc', 
                      fontSize: '14px', 
                      fontFamily: 'inherit',
                      outline: 'none',
                      lineHeight: '1.5',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

              </div>

              {/* Compose Footer Actions */}
              <div style={{ 
                padding: '12px 20px', 
                borderTop: '1px solid #334155', 
                background: '#1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <button 
                  type="submit" 
                  style={{ 
                    padding: '10px 24px', 
                    backgroundColor: '#4f46e5', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '24px', 
                    fontSize: '14px', 
                    fontWeight: 600, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4338ca'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
                >
                  🚀 Invia
                </button>
                
                <span 
                  title="Elimina Bozza"
                  onClick={() => setIsComposing(false)}
                  style={{ fontSize: '20px', cursor: 'pointer', padding: '8px', color: '#94a3b8', transition: 'color 0.2s' }}
                  onMouseOver={e=>e.target.style.color='#ef4444'} onMouseOut={e=>e.target.style.color='#94a3b8'}
                >
                  🗑️
                </span>
              </div>

            </form>
          )}

        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            width: '420px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <h4 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Conferma Operazione</h4>
            </div>
            <div style={{ 
              fontSize: '14px', 
              color: 'var(--text-secondary)', 
              lineHeight: 1.5 
            }}>
              {confirmModalData.message}
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'flex-end', 
              marginTop: '8px' 
            }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ 
                  borderRadius: '8px', 
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
                onClick={confirmModalData.onCancel}
              >
                Annulla
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ 
                  borderRadius: '8px', 
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
                onClick={confirmModalData.onConfirm}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
