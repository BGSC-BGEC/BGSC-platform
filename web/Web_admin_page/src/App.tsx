import React from 'react';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { BracketManagerPage } from './pages/BracketManagerPage';
import { CaptainsPage } from './pages/CaptainsPage';
import { AuctionsPage } from './pages/AuctionsPage';
import { ScoringEnginePage } from './pages/ScoringEnginePage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { TicketsPage } from './pages/TicketsPage';
import { ModerationPage } from './pages/ModerationPage';
import { BroadcastsPage } from './pages/BroadcastsPage';
import { SettingsPage } from './pages/SettingsPage';

const AppContent: React.FC = () => {
  const { currentTab } = useAdmin();

  const renderActivePage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'tournaments':
      case 'bracket':
        return <BracketManagerPage />;
      case 'captains':
        return <CaptainsPage />;
      case 'auctions':
        return <AuctionsPage />;
      case 'scoring':
        return <ScoringEnginePage />;
      case 'investments':
        return <InvestmentsPage />;
      case 'tickets':
        return <TicketsPage />;
      case 'moderation':
        return <ModerationPage />;
      case 'broadcasts':
        return <BroadcastsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return <AdminLayout>{renderActivePage()}</AdminLayout>;
};

export const App: React.FC = () => {
  return (
    <AdminProvider>
      <AppContent />
    </AdminProvider>
  );
};

export default App;
