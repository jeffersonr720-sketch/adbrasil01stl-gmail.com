import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopAppBar } from './components/TopAppBar';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { SchedulesScreen } from './components/screens/SchedulesScreen';
import { ServicesScreen } from './components/screens/ServicesScreen';
import { MinistriesScreen } from './components/screens/MinistriesScreen';
import { MembersScreen } from './components/screens/MembersScreen';
import { AttendanceScreen } from './components/screens/AttendanceScreen';
import { ChangePasswordScreen } from './components/screens/ChangePasswordScreen';
import { LoginPage } from './components/LoginPage';
import { Snackbar } from './components/Snackbar';

const MainLayout: React.FC = () => {
  const { activeTab, isDark } = useApp();
  const { user, isAuthLoading } = useAuth();

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  if (isAuthLoading) {
    return (
      <div
        className={`min-h-screen w-full flex flex-col items-center justify-center gap-3 font-sans antialiased ${
          isDark ? 'dark bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'
        }`}
      >
        <div className="h-14 w-14 rounded-2xl bg-white p-2 border border-emerald-200 shadow-sm flex items-center justify-center">
          <img src="/assets/aistudio/image_533f3802.png" alt="AD Brasil" className="h-full w-full object-contain" />
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
          Verificando acesso ministerial...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage />
        <Snackbar />
      </>
    );
  }

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'schedules':
        return <SchedulesScreen />;
      case 'services':
        return <ServicesScreen />;
      case 'ministries':
        return <MinistriesScreen />;
      case 'members':
        return <MembersScreen />;
      case 'attendance':
        return <AttendanceScreen />;
      case 'password':
        return <ChangePasswordScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col transition-colors font-sans antialiased ${
        isDark ? 'dark bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Top Header Bar + Mobile Fixed Top Function Bar */}
      <TopAppBar />

      {/* Main Responsive Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6">
        {renderActiveScreen()}
      </main>

      <Snackbar />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </AuthProvider>
  );
}

