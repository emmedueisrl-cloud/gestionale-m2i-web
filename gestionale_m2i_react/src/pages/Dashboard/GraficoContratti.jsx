import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const GraficoContratti = ({ counts }) => {
  const data = counts ? [
    { name: 'Determinato', value: counts.determinato || 0, color: '#f59e0b' },
    { name: 'Indeterminato', value: counts.indeterminato || 0, color: '#10b981' },
    { name: 'In Prova', value: counts.prova || 0, color: '#3b82f6' }
  ].filter(item => item.value > 0) : [];

  return (
    <div style={styles.panelCard}>
      <div style={styles.panelHeader}>
        <span>📊 Distribuzione Contratti Attivi</span>
      </div>
      <div style={{ position: 'relative', height: '240px', marginTop: '14px', marginBottom: '6px' }}>
        {!counts ? (
          <div style={styles.empty}>Caricamento in corso...</div>
        ) : data.length === 0 ? (
          <div style={styles.empty}>Nessun dato disponibile</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius="50%"
                outerRadius="75%"
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--text-light)' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
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
  empty: {
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  }
};

export default GraficoContratti;
