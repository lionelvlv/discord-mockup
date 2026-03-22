import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './app/login/LoginPage';
import SignupPage from './app/signup/SignupPage';
import ForgotPasswordPage from './app/forgot-password/ForgotPasswordPage';
import AppLayout from './app/app/AppLayout';
import { AuthProvider, useAuth } from './features/auth/useAuth';
import './styles/globals.css';
import './styles/theme.css';
import './styles/retro-effects.css';

// IMPORTANT: these must be defined OUTSIDE App() so React doesn't treat them
// as new component types on every render (which would unmount+remount the entire
// subtree and cause constant re-initialization of auth, subscriptions, etc.)
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return !user ? <>{children}</> : <Navigate to="/app/channel/general" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/app/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
