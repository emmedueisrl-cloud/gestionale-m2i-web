import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import ComingSoonPage from './components/ComingSoonPage';
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'));
const DipendentiPage = lazy(() => import('./pages/Dipendenti/DipendentiPage'));
const SchedaDipendente = lazy(() => import('./pages/Dipendenti/SchedaDipendente'));
const NuovoDipendente = lazy(() => import('./pages/Dipendenti/NuovoDipendente'));
const ModificaDipendente = lazy(() => import('./pages/Dipendenti/ModificaDipendente'));
const Proroghe = lazy(() => import('./pages/Dipendenti/Proroghe'));
const Trasformazione = lazy(() => import('./pages/Dipendenti/Trasformazione'));
const Cessazione = lazy(() => import('./pages/Dipendenti/Cessazione'));
const MaggiorazioniDetrazioni = lazy(() => import('./pages/Dipendenti/MaggiorazioniDetrazioni'));
const Chiavi = lazy(() => import('./pages/Dipendenti/Chiavi'));

// Fase 3
const RegistroOre = lazy(() => import('./pages/Ore/RegistroOre'));
const AgendaCaposquadra = lazy(() => import('./pages/Ore/AgendaCaposquadra'));
const AgendaCaposquadraPubblica = lazy(() => import('./pages/Ore/AgendaCaposquadraPubblica'));
const InserisciAppuntamentoPubblico = lazy(() => import('./pages/Commerciale/InserisciAppuntamentoPubblico'));
const ProspettoSettimanale = lazy(() => import('./pages/Ore/ProspettoSettimanale'));
const ElaboratoDipendenti = lazy(() => import('./pages/Elaborati/ElaboratoDipendenti'));
const ElaboratoClienti = lazy(() => import('./pages/Elaborati/ElaboratoClienti'));

// Fase 4
const ClientiPage = lazy(() => import('./pages/Clienti/ClientiPage'));
const MagazzinoPage = lazy(() => import('./pages/Magazzino/MagazzinoPage'));
const SchedaCliente = lazy(() => import('./pages/Clienti/SchedaCliente'));
const NuovoCliente = lazy(() => import('./pages/Clienti/NuovoCliente'));
const ModificaCliente = lazy(() => import('./pages/Clienti/ModificaCliente'));
const ScontiMaggiorazioniClienti = lazy(() => import('./pages/Clienti/ScontiMaggiorazioniClienti'));
const Fatture = lazy(() => import('./pages/Commerciale/Fatture'));
const Pagamenti = lazy(() => import('./pages/Commerciale/Pagamenti'));
const Provvigioni = lazy(() => import('./pages/Commerciale/Provvigioni'));
const Preventivi = lazy(() => import('./pages/Commerciale/Preventivi'));

// Fase 5
const BustePaga = lazy(() => import('./pages/BustePaga/BustePaga'));
const ModuliDipendenti = lazy(() => import('./pages/Dipendenti/ModuliDipendenti'));
const SchedaAzienda = lazy(() => import('./pages/Azienda/SchedaAzienda'));

// AI
const ReportIA = lazy(() => import('./pages/Report/ReportIA'));

// Posta
const PostaElettronica = lazy(() => import('./pages/posta/PostaElettronica'));
const EmailConfig = lazy(() => import('./pages/Impostazioni/EmailConfig'));

// Impostazioni
const ImpostazioniLayout = lazy(() => import('./pages/Impostazioni/ImpostazioniLayout'));
const LogSistema = lazy(() => import('./pages/Impostazioni/LogSistema'));
const BackupSistema = lazy(() => import('./pages/Impostazioni/BackupSistema'));
const Utenti = lazy(() => import('./pages/Impostazioni/Utenti'));
const Autodiagnosi = lazy(() => import('./pages/Impostazioni/Autodiagnosi'));
const Operatori = lazy(() => import('./pages/Impostazioni/Operatori'));
const ContabilitaElaborati = lazy(() => import('./pages/Contabilita/ContabilitaElaborati'));

function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-slate-200 flex items-center justify-center">Caricamento...</div>}>
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/agenda/:token" element={<AgendaCaposquadraPubblica />} />
      <Route path="/inserisci-appuntamento/:token" element={<InserisciAppuntamentoPubblico />} />
      <Route path="/contabilita" element={
        <ProtectedRoute allowedRoles={['admin', 'user', 'contabilita']}>
          <AppShell area="contabilita" />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="clienti" replace />} />
        <Route path="clienti" element={<ContabilitaElaborati tipo="cliente" />} />
        <Route path="dipendenti" element={<ContabilitaElaborati tipo="dipendente" />} />
        <Route path="provvigioni" element={<Provvigioni />} />
      </Route>
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
        <Route path="ore/prospetto" element={<ProspettoSettimanale />} />
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
        <Route path="provvigioni" element={<Navigate to="/contabilita/provvigioni" replace />} />
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
          <Route index element={<Navigate to="utenti" replace />} />
          <Route path="email" element={<EmailConfig />} />
          <Route path="log" element={<LogSistema />} />
          <Route path="autodiagnosi" element={<Autodiagnosi />} />
          <Route path="operatori" element={<Operatori />} />
          <Route path="backup" element={<BackupSistema />} />
          <Route path="utenti" element={<Utenti />} />
        </Route>

        {/* Tutte le altre route per ora mostrano "In costruzione" */}
        <Route path="*" element={<ComingSoonPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

export default App;
