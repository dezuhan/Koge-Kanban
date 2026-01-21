import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import BoardPage from './pages/BoardPage';
import SettingsPage from './pages/SettingsPage';
import TrashPage from './pages/TrashPage';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * Main Application Component
 * Sets up the routing structure and global context provider.
 * Routes:
 * - / : Dashboard showing all projects and recent tasks
 * - /board/:projectId : Kanban board for a specific project
 * - /board/:projectId/task/:taskId : Deep link to a specific task on a board
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/board/:projectId" element={<BoardPage />} />
            <Route path="/board/:projectId/task/:taskId" element={<BoardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
