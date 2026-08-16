import { useState, useEffect } from 'react';
import { dashboardApi } from '../../api/dashboard';
import WelcomeBanner from './WelcomeBanner';
import KpiRow from './KpiRow';
import AlertScadenze from './AlertScadenze';
import ChecklistDip from './ChecklistDip';
import ChecklistCli from './ChecklistCli';

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await dashboardApi.caricaKpiDashboard();
        setData(response);
      } catch (err) {
        console.error("Errore caricamento dashboard:", err);
        setError("Si è verificato un errore durante il caricamento dei dati.");
      }
    };

    fetchData();
  }, []);

  if (error) {
    return (
      <div style={{ color: '#fca5a5', padding: '20px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div>
      <WelcomeBanner />
      
      <KpiRow 
        dipendentiAttivi={data?.dipendentiAttivi} 
        clientiAttivi={data?.clientiAttivi}
        totaleFatturato={data?.totaleFatturato}
        totaleOreMese={data?.totaleOreMese}
        nomeMese={data?.nomeMesePrecedente}
      />

      <div style={styles.mainGrid}>
        <AlertScadenze scadenze={data?.scadenzeDipendenti} />
        <ChecklistDip checklist={data?.checklistDipendenti} />
        <ChecklistCli checklist={data?.checklistClienti} />
      </div>
    </div>
  );
};

const styles = {
  mainGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    marginBottom: '30px',
  }
};

export default DashboardPage;
