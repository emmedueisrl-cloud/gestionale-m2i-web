import React, { useEffect, useState } from 'react';




import ModernModal from '../../components/ui/ModernModal';

export default function ConfigurazioneEmail() {
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  
  const showStatus = (type, title, msg) => {
    setAlertModal({
      isOpen: true,
      type: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'),
      title: title,
      content: msg,
      primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
    });
  };

  const [emailConfig, setEmailConfig] = useState({});
  const [useSmtpCreds, setUseSmtpCreds] = useState(true);
  const [smtpUser, setSmtpUser] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [smtpHost, setSmtpHost] = useState('');

  const fetchEmailConfig = async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/configurazione-email');
      const json = await res.json();
      if (json.success && json.data) {
        setEmailConfig(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch email config', err);
    }
  };

  useEffect(() => {
    fetchEmailConfig();
  }, []);

  // Sync state with loaded configuration
  useEffect(() => {
    if (emailConfig && Object.keys(emailConfig).length > 0) {
      setUseSmtpCreds(emailConfig.use_smtp_creds !== undefined ? emailConfig.use_smtp_creds : true);
      setSmtpUser(emailConfig.user || '');
      setImapHost(emailConfig.imap_host || '');
      setSmtpHost(emailConfig.host || '');
    }
  }, [emailConfig]);

  // Auto-complete rules for common providers
  const handleEmailChange = (val) => {
    setSmtpUser(val);
    if (val.endsWith('@aruba.it')) {
      if (!smtpHost) setSmtpHost('smtps.aruba.it');
      if (!imapHost) setImapHost('imaps.aruba.it');
    } else if (val.endsWith('@gmail.com')) {
      if (!smtpHost) setSmtpHost('smtp.gmail.com');
      if (!imapHost) setImapHost('imap.gmail.com');
    }
  };

  const handleSaveEmailConfig = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      host: formData.get('host'),
      port: formData.get('port'),
      user: formData.get('user'),
      pass: formData.get('pass'),
      nome_mittente: formData.get('nome_mittente') || '',
      secure: formData.get('secure') === 'on',
      
      imap_host: formData.get('imap_host'),
      imap_port: formData.get('imap_port'),
      imap_secure: formData.get('imap_secure') === 'on',
      imap_user: formData.get('imap_user') || '',
      imap_pass: formData.get('imap_pass') || '',
      use_smtp_creds: useSmtpCreds
    };
    
    try {
      showStatus('loading', 'Salvataggio...', 'Salvataggio configurazione server...');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/configurazione-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        showStatus('success', 'Configurazione Salvata!', json.message);
        fetchEmailConfig();
      } else {
        showStatus('error', 'Errore', json.error);
      }
    } catch (err) {
      showStatus('error', 'Errore di connessione', err.message);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', fontFamily: '"Inter", "Segoe UI", sans-serif' }}>
      
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', fontSize: '28px', marginBottom: '16px' }}>
          ⚙️
        </div>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
          Configurazione E-mail
        </h2>
        <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: '1.6', maxWidth: '500px', margin: '0 auto' }}>
          Imposta i parametri del server per abilitare l'invio e la ricezione di posta elettronica direttamente dal gestionale.
        </p>
      </div>
      
      <form onSubmit={handleSaveEmailConfig} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* 1. SMTP SERVER CARD */}
        <div style={{ padding: '32px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
            <span style={{ fontSize: '20px' }}>📤</span>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Server SMTP (Invio)</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>Server Host SMTP <span style={{color: '#f87171'}}>*</span></label>
              <input 
                type="text" 
                name="host" 
                required 
                value={smtpHost} 
                onChange={e => setSmtpHost(e.target.value)}
                placeholder="Es: smtps.aruba.it o smtp.gmail.com"
                style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>Porta SMTP <span style={{color: '#f87171'}}>*</span></label>
                <input 
                  type="number" 
                  name="port" 
                  required 
                  min="1" 
                  max="65535" 
                  defaultValue={emailConfig.port || '465'} 
                  placeholder="Es: 465 o 587" 
                  style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                  onBlur={(e) => e.target.style.borderColor = '#334155'}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '28px' }}>
                <input 
                  type="checkbox" 
                  name="secure" 
                  id="emailSecure" 
                  defaultChecked={emailConfig.secure !== undefined ? emailConfig.secure : true} 
                  style={{ width: '18px', height: '18px', accentColor: '#818cf8', cursor: 'pointer' }} 
                />
                <label htmlFor="emailSecure" style={{ cursor: 'pointer', userSelect: 'none', fontSize: '14px', color: '#cbd5e1' }}>Usa SSL/TLS</label>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>Nome Utente / E-mail <span style={{color: '#f87171'}}>*</span></label>
              <input 
                type="text" 
                name="user" 
                required 
                value={smtpUser} 
                onChange={e => handleEmailChange(e.target.value)} 
                placeholder="latuamail@dominio.it" 
                style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>Password <span style={{color: '#f87171'}}>*</span></label>
              <input 
                type="password" 
                name="pass" 
                required 
                defaultValue={emailConfig.pass} 
                placeholder="Inserisci password" 
                style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>Nome Mittente <span style={{fontSize: '12px', fontWeight: 'normal', color: '#64748b'}}>(Opzionale)</span></label>
              <input 
                type="text" 
                name="nome_mittente" 
                defaultValue={emailConfig.nome_mittente || ''} 
                placeholder="Es: HR Manager, Il Tuo Nome..." 
                style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>
          </div>
        </div>

        {/* 2. IMAP SERVER CARD */}
        <div style={{ padding: '32px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
            <span style={{ fontSize: '20px' }}>📥</span>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Server IMAP (Ricezione)</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>Server Host IMAP <span style={{color: '#f87171'}}>*</span></label>
              <input 
                type="text" 
                name="imap_host" 
                required 
                value={imapHost} 
                onChange={e => setImapHost(e.target.value)}
                placeholder="Es: imaps.aruba.it" 
                style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>Porta IMAP <span style={{color: '#f87171'}}>*</span></label>
                <input 
                  type="number" 
                  name="imap_port" 
                  required 
                  min="1" 
                  max="65535" 
                  defaultValue={emailConfig.imap_port || '993'} 
                  placeholder="Es: 993" 
                  style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                  onBlur={(e) => e.target.style.borderColor = '#334155'}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '28px' }}>
                <input 
                  type="checkbox" 
                  name="imap_secure" 
                  id="imapSecure" 
                  defaultChecked={emailConfig.imap_secure !== undefined ? emailConfig.imap_secure : true} 
                  style={{ width: '18px', height: '18px', accentColor: '#818cf8', cursor: 'pointer' }} 
                />
                <label htmlFor="imapSecure" style={{ cursor: 'pointer', userSelect: 'none', fontSize: '14px', color: '#cbd5e1' }}>Usa SSL/TLS</label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)', marginTop: '8px' }}>
              <input 
                type="checkbox" 
                id="useSmtpCreds" 
                checked={useSmtpCreds} 
                onChange={e => setUseSmtpCreds(e.target.checked)} 
                style={{ width: '18px', height: '18px', accentColor: '#818cf8', cursor: 'pointer' }} 
              />
              <label htmlFor="useSmtpCreds" style={{ cursor: 'pointer', userSelect: 'none', fontSize: '14px', fontWeight: 600, color: '#818cf8' }}>
                Usa le stesse credenziali dell'SMTP per ricevere la posta
              </label>
            </div>

            {/* Reveal credentials if unchecked */}
            {!useSmtpCreds && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px', paddingTop: '24px', borderTop: '1px dashed #334155' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>Nome Utente IMAP <span style={{color: '#f87171'}}>*</span></label>
                  <input 
                    type="text" 
                    name="imap_user" 
                    defaultValue={emailConfig.imap_user || smtpUser} 
                    placeholder="username@dominio.it" 
                    style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                    onBlur={(e) => e.target.style.borderColor = '#334155'}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>Password IMAP <span style={{color: '#f87171'}}>*</span></label>
                  <input 
                    type="password" 
                    name="imap_pass" 
                    defaultValue={emailConfig.imap_pass || emailConfig.pass} 
                    placeholder="Password per IMAP" 
                    style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                    onBlur={(e) => e.target.style.borderColor = '#334155'}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button 
            type="submit" 
            style={{ 
              padding: '14px 32px', 
              backgroundColor: '#4f46e5', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontSize: '16px', 
              fontWeight: 600, 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4), 0 2px 4px -1px rgba(79, 70, 229, 0.3)',
              transition: 'background-color 0.2s, transform 0.1s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4338ca'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span>💾</span> Salva Configurazione Server
          </button>
        </div>

      </form>
      <ModernModal 
        {...alertModal}
        onClose={() => setAlertModal({ isOpen: false })}
      />
    </div>
  );
}
