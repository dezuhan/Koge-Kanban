import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Loader2 } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import ChatBot from './ChatBot';
import SearchModal from './SearchModal';
import DatabaseConfigModal from './DatabaseConfigModal';
import { db } from '../services/db';

const Layout: React.FC = () => {
  const { appLoading, isSearchOpen, setIsSearchOpen, showConnModal, apiBaseUrl, setApiBaseUrl } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

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

  const handleSaveDatabaseUrl = async (url: string) => {
    // Basic validation
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('URL must start with http:// or https://');
    }

    const isOk = await db.testConnection(url);
    if (isOk) {
      setApiBaseUrl(url);
      window.location.reload();
    } else {
      throw new Error('Connection failed. Please check the URL and ensure the server is running.');
    }
  };

  return (
    <div className="app-root flex h-screen bg-slate-50 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
        <Outlet />
      </div>
      <ChatBot />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <DatabaseConfigModal
        isOpen={showConnModal}
        initialUrl={apiBaseUrl || 'http://localhost:3000/api'}
        onSave={handleSaveDatabaseUrl}
      />
    </div>
  );
};

export default Layout;
