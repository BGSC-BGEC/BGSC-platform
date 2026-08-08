import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '../common/ToastContainer';
import { CommandPalette } from '../common/CommandPalette';
import { NotificationDrawer } from '../common/NotificationDrawer';
import { AuditDrawer } from '../common/AuditDrawer';
import { useAdmin } from '../../context/AdminContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { sidebarCollapsed } = useAdmin();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex">
      {/* Fixed Left Navigation Sidebar */}
      <Sidebar />

      {/* Global Fixed Header */}
      <Header />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 pt-16 transition-all duration-300 ${
          sidebarCollapsed ? 'pl-16' : 'pl-60'
        }`}
      >
        <main className="flex-1 p-4 lg:p-6 xl:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {children}
        </main>
      </div>

      {/* Global Overlays */}
      <ToastContainer />
      <CommandPalette />
      <NotificationDrawer />
      <AuditDrawer />
    </div>
  );
};
