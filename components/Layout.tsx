import React from 'react';
import { useApp } from '../context/AppContext';
import { Loader2 } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import ChatBot from './ChatBot';

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
    <div className="app-root flex h-screen bg-slate-50 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
            <Outlet />
        </div>
        <ChatBot />
    </div>
  );
};

export default Layout;

