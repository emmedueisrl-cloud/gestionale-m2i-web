import { apiCall } from './client';

export const dashboardApi = {
  recuperaDatiDashboard: () => apiCall('recuperaDatiDashboard'),
  caricaKpiDashboard: () => apiCall('caricaKpiDashboard'),
  recuperaTuttiLogs: (page = 1, limit = 50) => apiCall('recuperaTuttiLogs', [page, limit]),
  svuotaLogSistema: (password) => apiCall('svuotaLogSistema', [password]),
  elaboraDomandaBot: (domanda) => apiCall('elaboraDomandaBot', [domanda]),
};
