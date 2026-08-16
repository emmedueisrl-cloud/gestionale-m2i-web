const ComingSoonPage = () => {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>🚧</div>
      <h2 style={styles.title}>Lavori in Corso</h2>
      <p style={styles.subtitle}>
        Questa sezione è attualmente in fase di migrazione verso il nuovo sistema React.<br />
        Sarà disponibile prossimamente. Nel frattempo, puoi usare il vecchio gestionale per questa funzione.
      </p>
    </div>
  );
};

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    background: 'var(--bg-card)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    padding: '40px',
  },
  icon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '12px',
    color: 'var(--text-light)',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '15px',
    lineHeight: 1.6,
    maxWidth: '500px',
  }
};

export default ComingSoonPage;
