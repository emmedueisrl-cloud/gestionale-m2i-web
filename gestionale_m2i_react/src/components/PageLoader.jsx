const PageLoader = ({ text = 'Caricamento in corso...' }) => {
  return (
    <div style={styles.container}>
      <div style={styles.spinner}></div>
      <div style={styles.text}>{text}</div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '200px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(79, 70, 229, 0.2)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },
  text: {
    color: 'var(--text-muted)',
    fontSize: '14px',
    fontWeight: 500,
  }
};

// Aggiungiamo l'animazione globalmente (se non è già in index.css)
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default PageLoader;
