const ChecklistCli = ({ checklist }) => {
  return (
    <div style={styles.panelCard}>
      <div style={styles.panelHeader}>
        <span>🏢 Checklist Contratti Mancanti Clienti</span>
      </div>
      <ul style={styles.alertList}>
        {!checklist ? (
          <li style={{...styles.alertItem, ...styles.alertEmpty}}>Caricamento in corso...</li>
        ) : checklist.length === 0 ? (
          <li style={{...styles.alertItem, ...styles.alertEmpty}}>Tutti i contratti clienti sono firmati</li>
        ) : (
          checklist.map((c, idx) => (
            <li key={idx} style={styles.alertItem}>
              <span>{c.ragioneSociale}</span>
              <span style={{ color: '#fca5a5', fontSize: '11px' }}>Contratto Mancante</span>
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
    maxHeight: '200px',
    overflowY: 'auto',
  },
  alertItem: {
    padding: '10px 14px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '13px',
    color: 'var(--text-light)',
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

export default ChecklistCli;
