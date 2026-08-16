import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../../api/dashboard';
import ModernModal from '../../components/ui/ModernModal';

const LogSistema = () => {
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await dashboardApi.recuperaTuttiLogs(1, 50);
        setLogs(response.logs || response); // Support backward comp just in case
        setHasMore(response.page < response.totalPages);
      } catch (err) {
        console.error("Errore caricamento log sistema:", err);
        setError("Impossibile caricare lo storico dei log.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const handleLoadMore = async () => {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await dashboardApi.recuperaTuttiLogs(nextPage, 50);
      setLogs(prev => [...prev, ...(response.logs || [])]);
      setPage(nextPage);
      setHasMore(response.page < response.totalPages);
    } catch (err) {
      console.error("Errore caricamento altri log:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleReset = async () => {
    const pwd = window.prompt("Attenzione: Inserisci la password per resettare completamente il registro delle attività:");
    if (pwd) {
      try {
        setLoading(true);
        await dashboardApi.svuotaLogSistema(pwd);
        const response = await dashboardApi.recuperaTuttiLogs(1, 50);
        setLogs(response.logs || response);
        setPage(1);
        setError(null);
        setAlertModal({
          isOpen: true,
          type: 'success',
          title: 'Successo',
          content: 'Log svuotati con successo!',
          primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
        });
      } catch (err) {
        console.error("Errore reset log:", err);
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          content: err.message || "Password errata o errore durante il reset.",
          primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div>
      <div style={styles.headerContainer}>
        <div>
          <h2 style={styles.title}>Registro Attività (Log Sistema)</h2>
          <p style={styles.subtitle}>
            Qui trovi l'elenco cronologico di tutte le azioni e operazioni eseguite nel gestionale.
          </p>
        </div>
        <button style={styles.resetBtn} onClick={handleReset}>🗑️ Azzera Log</button>
      </div>

      {error && (
        <div style={styles.errorBox}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Caricamento log in corso...</p>
      ) : (
        <div style={styles.logContainer}>
          <ul style={styles.timelineList}>
            {logs.length === 0 ? (
              <li style={{...styles.timelineItem, justifyContent: 'center', color: 'var(--text-muted)'}}>
                Nessuna attività registrata.
              </li>
            ) : (
              logs.map((a, idx) => (
                <li key={idx} style={styles.timelineItem}>
                  <div style={{
                    ...styles.timelineDot, 
                    background: `${a.colore}33`,
                    color: a.colore
                  }}>
                    {a.icona}
                  </div>
                  <div style={styles.timelineContent}>
                    <p style={styles.timelineText} dangerouslySetInnerHTML={{ __html: a.testo }}></p>
                    <span style={styles.timelineTime}>{a.dataFormattata}</span>
                  </div>
                </li>
              ))
            )}
          </ul>
          
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button 
                onClick={handleLoadMore} 
                disabled={loadingMore}
                style={styles.loadMoreBtn}
              >
                {loadingMore ? 'Caricamento...' : 'Carica Altri'}
              </button>
            </div>
          )}
        </div>
      )}
      
      <ModernModal 
        {...alertModal}
        onClose={() => setAlertModal({ isOpen: false })}
      />
    </div>
  );
};

const styles = {
  title: {
    fontSize: '22px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  headerContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  resetBtn: {
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  errorBox: {
    color: '#fca5a5',
    padding: '16px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '12px',
    marginBottom: '24px',
  },
  logContainer: {
    background: 'var(--bg-card-secondary)',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid var(--border-color)',
    maxHeight: '600px',
    overflowY: 'auto',
  },
  timelineList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  timelineItem: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
  timelineContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    paddingTop: '2px',
  },
  timelineText: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    lineHeight: '1.4',
    margin: 0,
  },
  timelineTime: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  loadMoreBtn: {
    background: 'var(--bg-dark)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    padding: '10px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  }
};

export default LogSistema;
