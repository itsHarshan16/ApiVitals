import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import EndpointsPage from './pages/EndpointsPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';

function RequireLogin({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/endpoints"
        element={
          <RequireLogin>
            <EndpointsPage />
          </RequireLogin>
        }
      />
      <Route
        path="/endpoints/:id"
        element={
          <RequireLogin>
            <HistoryPage />
          </RequireLogin>
        }
      />
      <Route path="*" element={<Navigate to="/endpoints" replace />} />
    </Routes>
  );
}

