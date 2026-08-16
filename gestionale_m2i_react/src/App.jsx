import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ComingSoonPage from './components/ComingSoonPage';
import DipendentiPage from './pages/Dipendenti/DipendentiPage';
import SchedaDipendente from './pages/Dipendenti/SchedaDipendente';
import NuovoDipendente from './pages/Dipendenti/NuovoDipendente';
import ModificaDipendente from './pages/Dipendenti/ModificaDipendente';
import Proroghe from './pages/Dipendenti/Proroghe';
import Trasformazione from './pages/Dipendenti/Trasformazione';
import Cessazione from './pages/Dipendenti/Cessazione';
import MaggiorazioniDetrazioni from './pages/Dipendenti/MaggiorazioniDetrazioni';
import Chiavi from './pages/Dipendenti/Chiavi';

// Fase 3
import RegistroOre from './pages/Ore/RegistroOre';
import AgendaCaposquadra from './pages/Ore/AgendaCaposquadra';
import ElaboratoDipendenti from './pages/Elaborati/ElaboratoDipendenti';
import ElaboratoClienti from './pages/Elaborati/ElaboratoClienti';

// Fase 4
import ClientiPage from './pages/Clienti/ClientiPage';
import MagazzinoPage from './pages/Magazzino/MagazzinoPage';
import SchedaCliente from './pages/Clienti/SchedaCliente';
import NuovoCliente from './pages/Clienti/NuovoCliente';
import ModificaCliente from './pages/Clienti/ModificaCliente';
import ScontiMaggiorazioniClienti from './pages/Clienti/ScontiMaggiorazioniClienti';
import Fatture from './pages/Commerciale/Fatture';
import Pagamenti from './pages/Commerciale/Pagamenti';
import Provvigioni from './pages/Commerciale/Provvigioni';

import Preventivi from './pages/Commerciale/Preventivi';

// Fase 5
import BustePaga from './pages/BustePaga/BustePaga';
import ModuliDipendenti from './pages/Dipendenti/ModuliDipendenti';
import SchedaAzienda from './pages/Azienda/SchedaAzienda';

// AI
import ReportIA from './pages/Report/ReportIA';

// Posta
import PostaElettronica from './pages/posta/PostaElettronica';
import EmailConfig from './pages/Impostazioni/EmailConfig';

// Impostazioni
import ImpostazioniLayout from './pages/Impostazioni/ImpostazioniLayout';
import LogSistema from './pages/Impostazioni/LogSistema';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AppShell area="amministrazione" />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        
        {/* Gestione Dipendenti */}
        <Route path="dipendenti/lista" element={<DipendentiPage />} />
        <Route path="dipendenti/scheda/:id" element={<SchedaDipendente />} />
        <Route path="dipendenti/nuovo" element={<NuovoDipendente />} />
        <Route path="dipendenti/modifica" element={<ModificaDipendente />} />
        <Route path="dipendenti/proroghe" element={<Proroghe />} />
        <Route path="dipendenti/trasformazione" element={<Trasformazione />} />
        <Route path="dipendenti/cessazione" element={<Cessazione />} />
        <Route path="dipendenti/regolazioni" element={<MaggiorazioniDetrazioni />} />
        <Route path="dipendenti/chiavi" element={<Chiavi />} />

        {/* Gestione Ore e Stampe (Fase 3) */}
        <Route path="ore/registro" element={<RegistroOre />} />
        <Route path="ore/agenda" element={<AgendaCaposquadra />} />
        <Route path="elaborati/dipendenti" element={<ElaboratoDipendenti />} />
        <Route path="elaborati/clienti" element={<ElaboratoClienti />} />
        <Route path="azienda" element={<SchedaAzienda />} />

        {/* Gestione Clienti & Contabilità (Fase 4) */}
        <Route path="clienti/lista" element={<ClientiPage />} />
        <Route path="magazzino" element={<MagazzinoPage />} />
        <Route path="clienti/scheda/:id" element={<SchedaCliente />} />
        <Route path="clienti/nuovo" element={<NuovoCliente />} />
        <Route path="clienti/modifica" element={<ModificaCliente />} />
        <Route path="clienti/regolazioni" element={<ScontiMaggiorazioniClienti />} />
        <Route path="fatture" element={<Fatture />} />
        <Route path="pagamenti" element={<Pagamenti />} />
        <Route path="provvigioni" element={<Provvigioni />} />
        <Route path="preventivi" element={<Preventivi />} />

        {/* Gestione Documentale (Fase 5) */}
        <Route path="bustepaga" element={<BustePaga />} />
        <Route path="dipendenti/moduli" element={<ModuliDipendenti />} />

        {/* AI Reports */}
        <Route path="report" element={<ReportIA />} />

        {/* Posta */}
        <Route path="posta" element={<PostaElettronica />} />
        
        {/* Impostazioni di Sistema */}
        <Route path="impostazioni" element={<ImpostazioniLayout />}>
          <Route path="email" element={<EmailConfig />} />
          <Route path="log" element={<LogSistema />} />
        </Route>

        {/* Tutte le altre route per ora mostrano "In costruzione" */}
        <Route path="*" element={<ComingSoonPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
