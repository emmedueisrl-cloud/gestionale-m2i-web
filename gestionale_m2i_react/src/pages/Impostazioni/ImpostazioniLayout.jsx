import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';

const ImpostazioniLayout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/admin/impostazioni/email', label: '✉️ Impostazioni Mail' },
    { path: '/admin/impostazioni/log', label: '🕒 Log Sistema' }
  ];

  return (
    <div style={styles.layout}>
      <h1 style={styles.pageTitle}>Impostazioni di Sistema</h1>
      <p style={styles.pageSubtitle}>Gestisci le configurazioni globali e visualizza i registri operativi.</p>

      <div style={styles.container}>
        {/* Sidebar Impostazioni */}
        <div style={styles.sidebar}>
          <ul style={styles.navList}>
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  style={({ isActive }) => ({
                    ...styles.navLink,
                    ...(isActive || location.pathname === item.path ? styles.navLinkActive : {})
                  })}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Contenuto Principale */}
        <div style={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const styles = {
  layout: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  pageSubtitle: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    marginBottom: '32px',
  },
  container: {
    display: 'flex',
    gap: '32px',
    alignItems: 'flex-start',
  },
  sidebar: {
    width: '280px',
    background: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid var(--border-color)',
    flexShrink: 0,
  },
  navList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: '12px',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  navLinkActive: {
    background: 'var(--primary)',
    color: 'white',
  },
  content: {
    flex: 1,
    background: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '32px',
    border: '1px solid var(--border-color)',
    minHeight: '600px',
  }
};

export default ImpostazioniLayout;
