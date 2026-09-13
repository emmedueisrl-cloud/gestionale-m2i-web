import React, { useState } from 'react';

const BackupSistema = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleBackup = async () => {
    setIsDownloading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/api/backup-db`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Errore durante il download del backup');
      }

      // Convert the response into a blob
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Retrieve the filename from the content-disposition header if available, otherwise use a default
      let filename = 'gestionale_backup.db';
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const matches = /filename="([^"]*)"/.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1];
        } else {
            const matchesPlain = /filename=([^;]*)/.exec(disposition);
            if (matchesPlain != null && matchesPlain[1]) {
                filename = matchesPlain[1];
            }
        }
      }

      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Append to body, click and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore:', error);
      alert('Si è verificato un errore durante il backup: ' + error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Backup Dati in Locale</h2>
      <p style={styles.description}>
        Scarica una copia completa del database attuale (file SQLite). Questo file contiene tutti i dati del sistema: clienti, dipendenti, fatture, ore, etc. 
        Ti consigliamo di effettuare backup regolari per prevenire la perdita di dati.
      </p>

      <div style={styles.card}>
        <div style={styles.iconContainer}>
          <span style={styles.icon}>💾</span>
        </div>
        <div style={styles.infoContainer}>
          <h3 style={styles.cardTitle}>Esporta Database (SQLite)</h3>
          <p style={styles.cardText}>L'operazione scaricherà un file .db sul tuo computer.</p>
        </div>
        <button 
          style={{ ...styles.button, ...(isDownloading ? styles.buttonDisabled : {}) }} 
          onClick={handleBackup} 
          disabled={isDownloading}
        >
          {isDownloading ? 'Scaricamento...' : 'Esegui Backup'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#333'
  },
  description: {
    fontSize: '15px',
    color: '#666',
    marginBottom: '32px',
    lineHeight: '1.6',
    maxWidth: '800px'
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    padding: '24px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    gap: '24px'
  },
  iconContainer: {
    width: '64px',
    height: '64px',
    background: '#e0e7ff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: {
    fontSize: '32px'
  },
  infoContainer: {
    flex: 1
  },
  cardTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    color: '#1e293b'
  },
  cardText: {
    margin: 0,
    color: '#64748b',
    fontSize: '14px'
  },
  button: {
    padding: '12px 24px',
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  buttonDisabled: {
    background: '#94a3b8',
    cursor: 'not-allowed'
  }
};

export default BackupSistema;
