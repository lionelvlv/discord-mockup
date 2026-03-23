import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './app/login/LoginPage';
import SignupPage from './app/signup/SignupPage';
import ForgotPasswordPage from './app/forgot-password/ForgotPasswordPage';
import AppLayout from './app/app/AppLayout';
import { AuthProvider, useAuth } from './features/auth/useAuth';
import { unlockAudio } from './lib/sounds';
import './styles/globals.css';
import './styles/theme.css';
import './styles/retro-effects.css';

// iOS keyboard fix: when the virtual keyboard opens, window.innerHeight doesn't
// change but visualViewport.height does. Pin the app-layout to the visual viewport
// height so the keyboard doesn't push content up or leave blank space.
function applyViewportHeight() {
  const vh = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${vh}px`);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', applyViewportHeight);
  window.visualViewport.addEventListener('scroll', applyViewportHeight);
}
window.addEventListener('resize', applyViewportHeight);
applyViewportHeight();

// Unlock Web Audio on first user interaction (required by mobile browsers)
const _unlock = () => { unlockAudio(); document.removeEventListener('click', _unlock); document.removeEventListener('keydown', _unlock); document.removeEventListener('touchend', _unlock); };
document.addEventListener('click', _unlock);
document.addEventListener('keydown', _unlock);
document.addEventListener('touchend', _unlock);

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
