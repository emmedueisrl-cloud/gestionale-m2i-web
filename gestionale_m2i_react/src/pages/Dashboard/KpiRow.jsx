const KpiRow = ({ dipendentiAttivi, clientiAttivi, totaleFatturato, totaleOreMese, nomeMese }) => {
  const formatEuro = (val) => {
    if (val === undefined || val === null) return '--';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(val);
  };

  const formatOre = (val) => {
    if (val === undefined || val === null || val === 0) return '--';
    return `${Number(val).toFixed(1)} h`;
  };

  const meseLabel = nomeMese ? ` (${nomeMese})` : '';

  return (
    <div style={styles.kpiRow}>
      <div style={styles.kpiCard}>
        <div style={styles.kpiInfo}>
          <span style={styles.kpiLabel}>DIPENDENTI ATTIVI</span>
          <span style={styles.kpiValue}>{dipendentiAttivi !== undefined ? dipendentiAttivi : '--'}</span>
        </div>
        <div style={{...styles.kpiIcon, background: 'rgba(79, 70, 229, 0.12)'}}>👥</div>
      </div>

      <div style={styles.kpiCard}>
        <div style={styles.kpiInfo}>
          <span style={styles.kpiLabel}>CLIENTI ATTIVI</span>
          <span style={styles.kpiValue}>{clientiAttivi !== undefined ? clientiAttivi : '--'}</span>
        </div>
        <div style={{...styles.kpiIcon, background: 'rgba(16, 185, 129, 0.12)'}}>🏢</div>
      </div>

      <div style={styles.kpiCard}>
        <div style={styles.kpiInfo}>
          <span style={styles.kpiLabel}>FATTURATO{meseLabel}</span>
          <span style={{...styles.kpiValue, fontSize: '22px', color: '#10b981'}}>{formatEuro(totaleFatturato)}</span>
        </div>
        <div style={{...styles.kpiIcon, background: 'rgba(16, 185, 129, 0.12)'}}>💶</div>
      </div>

      <div style={styles.kpiCard}>
        <div style={styles.kpiInfo}>
          <span style={styles.kpiLabel}>ORE LAVORATE{meseLabel}</span>
          <span style={{...styles.kpiValue, color: '#f59e0b'}}>{formatOre(totaleOreMese)}</span>
        </div>
        <div style={{...styles.kpiIcon, background: 'rgba(245, 158, 11, 0.12)'}}>⏱️</div>
      </div>
    </div>
  );
};

const styles = {
  kpiRow: {
    display: 'flex',
    gap: '20px',
    marginBottom: '24px',
  },
  kpiCard: {
    flex: 1,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: 'var(--shadow)',
  },
  kpiInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  kpiLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  kpiValue: {
    fontSize: '30px',
    fontWeight: 700,
    color: 'var(--text-light)',
  },
  kpiIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '22px',
  },
};

export default KpiRow;
