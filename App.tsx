import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import BoardPage from './pages/BoardPage';

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
    <AppProvider>
        <Routes>
            <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/board/:projectId" element={<BoardPage />} />
                <Route path="/board/:projectId/task/:taskId" element={<BoardPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    </AppProvider>
  );
};

export default App;
