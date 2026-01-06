import React from 'react';
import { useApp } from '../context/AppContext';
import { Loader2 } from 'lucide-react';
import { Outlet } from 'react-router-dom';

const Layout: React.FC = () => {
  const { appLoading } = useApp();

  if (appLoading) {
      return (
          <div className="flex h-screen items-center justify-center bg-slate-50 loading-screen">
              <div className="flex flex-col items-center gap-4 text-blue-600">
                  <Loader2 size={48} className="animate-spin" />
                  <p className="font-medium text-lg">Loading...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="app-root flex flex-col h-screen bg-slate-50">
        <Outlet />
    </div>
  );
};

export default Layout;

