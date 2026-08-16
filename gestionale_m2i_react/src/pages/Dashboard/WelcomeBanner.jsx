import { useState, useEffect } from 'react';

const WelcomeBanner = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('it-IT', { hour12: false });
  };

  const getDayName = (date) => {
    return date.toLocaleDateString('it-IT', { weekday: 'long' }).toUpperCase();
  };

  const getFullDate = (date) => {
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getGreeting = (date) => {
    const hour = date.getHours();
    if (hour < 12) return 'Buongiorno';
    if (hour < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  };

  return (
    <div style={styles.banner}>
      <div style={styles.textContainer}>
        <h1 style={styles.greeting}>Riepilogo Generale M2I</h1>
        <p style={styles.subtitle}>
          Dashboard amministrativa e stato operativo aggiornato al <span style={styles.highlight}>{getFullDate(time)}</span>
        </p>
      </div>
      <div style={styles.timeWidget}>
        <span style={styles.clock}>{formatTime(time)}</span>
        <span style={styles.day}>{getDayName(time)}</span>
      </div>
    </div>
  );
};

const styles = {
  banner: {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '24px 30px',
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
    position: 'relative',
    overflow: 'hidden',
  },
  textContainer: {
    zIndex: 1,
  },
  greeting: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-light)',
    margin: '0 0 6px 0',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '13.5px',
    color: 'rgba(248, 250, 252, 0.75)',
    margin: 0,
  },
  highlight: {
    color: 'var(--secondary)',
    fontWeight: 600,
  },
  timeWidget: {
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    zIndex: 1,
  },
  clock: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--secondary)',
    fontFamily: 'monospace',
    letterSpacing: '1px',
  },
  day: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'rgba(248, 250, 252, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
  }
};

export default WelcomeBanner;
