import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('amministrazione@m2i.it');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    sessionStorage.setItem('auth_token', 'mock-token-m2i');
    navigate('/admin/dashboard');
  };

  return (
    <div style={styles.container}>
      
      {/* Modulo di Login (Ora a sinistra) */}
      <div style={styles.formPanel}>
        <div style={styles.card}>
          <div style={styles.logoContainer}>
            <div style={styles.logoIcon}>
              <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 10 L80 40 L50 90 L20 40 Z" fill="#4B88C6" opacity="0.8"/>
                <path d="M50 10 L80 40 L50 60 Z" fill="#1C5C9C" opacity="0.9"/>
                <path d="M20 40 L50 60 L50 90 Z" fill="#2E75B6"/>
              </svg>
            </div>
            <div style={styles.logoTextGroup}>
              <span style={styles.logoTextM2I}>M2I</span>
              <span style={styles.logoTextSub}>GESTIONALE PULIZIE</span>
            </div>
          </div>

          <h1 style={styles.title}>Bentornato!</h1>
          <p style={styles.subtitle}>Accedi per continuare a rendere tutto splendente.</p>
          
          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>👤</span>
              <input 
                type="text" 
                style={styles.input} 
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>🔒</span>
              <input 
                type={showPassword ? "text" : "password"} 
                style={styles.input} 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span 
                style={styles.eyeIcon} 
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </span>
            </div>

            <div style={styles.optionsRow}>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" style={styles.checkbox} />
                Ricordami
              </label>
              <a href="#" style={styles.forgotPassword}>Password dimenticata?</a>
            </div>
            
            <button type="submit" style={styles.button}>Accedi</button>
          </form>
        </div>
      </div>

      {/* Immagine di sfondo (Ora a destra). Coprirà tutto lo spazio rimanente in modo responsive */}
      <div style={styles.imagePanel}></div>

    </div>
  );
};

const styles = {
  container: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  formPanel: {
    width: '600px',
    flexShrink: 0,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '10px 0 30px rgba(0,0,0,0.05)', /* Ombra verso destra ora */
    zIndex: 10,
  },
  imagePanel: {
    flex: 1,
    background: 'url(/bg-login.jpg) top center / cover no-repeat',
    backgroundColor: '#ffffff',
  },
  card: {
    width: '100%',
    padding: '60px',
    textAlign: 'center',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    marginBottom: '20px',
  },
  logoIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTextGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  logoTextM2I: {
    fontSize: '52px',
    fontWeight: '900',
    color: '#0033a0',
    lineHeight: '1',
    letterSpacing: '-2px',
  },
  logoTextSub: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: '1px',
    marginTop: '-2px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#0033a0',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#666666',
    fontSize: '14px',
    marginBottom: '40px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '15px',
    color: '#999999',
    fontSize: '16px',
  },
  eyeIcon: {
    position: 'absolute',
    right: '15px',
    cursor: 'pointer',
    color: '#999999',
    fontSize: '16px',
  },
  input: {
    width: '100%',
    padding: '16px 45px', // Spazio per le icone
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    color: '#1a1a1a',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  optionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '-5px',
    marginBottom: '5px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#666666',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: '#0033a0',
  },
  forgotPassword: {
    fontSize: '13px',
    color: '#0033a0',
    textDecoration: 'none',
    fontWeight: '600',
  },
  button: {
    width: '100%',
    padding: '16px',
    background: '#0033a0',
    borderRadius: '10px',
    color: 'white',
    fontWeight: '700',
    fontSize: '16px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};

export default LoginPage;
