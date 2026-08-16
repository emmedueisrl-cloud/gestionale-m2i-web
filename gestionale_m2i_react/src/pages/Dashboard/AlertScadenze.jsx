const AlertScadenze = ({ scadenze }) => {
  return (
    <div style={styles.panelCard}>
      <div style={styles.panelHeader}>
        <span>⚠️ Allert Scadenze Contratti (30 gg)</span>
      </div>
      <ul style={styles.alertList}>
        {!scadenze ? (
          <li style={{...styles.alertItem, ...styles.alertEmpty}}>Caricamento in corso...</li>
        ) : scadenze.length === 0 ? (
          <li style={{...styles.alertItem, ...styles.alertEmpty}}>Nessun contratto in scadenza nei prossimi 30 giorni</li>
        ) : (
          scadenze.map((s, idx) => (
            <li key={idx} style={styles.alertItem}>
              <span>{s.oggetto || s.nomeCompleto} - {s.scadenza}</span>
              <span style={{ fontWeight: 'bold' }}>{s.giorniRimasti !== undefined ? s.giorniRimasti : s.giorniMancanti} gg</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

const styles = {
  panelCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
  },
  panelHeader: {
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '16px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '250px',
    overflowY: 'auto',
  },
  alertItem: {
    padding: '10px 14px',
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#fca5a5',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertEmpty: {
    background: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-muted)',
    justifyContent: 'center',
    fontStyle: 'italic',
  }
};

export default AlertScadenze;
