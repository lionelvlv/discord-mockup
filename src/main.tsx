import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './app/login/LoginPage';
import SignupPage from './app/signup/SignupPage';
import ForgotPasswordPage from './app/forgot-password/ForgotPasswordPage';
import AppLayout from './app/app/AppLayout';
import { AuthProvider, useAuth } from './features/auth/useAuth';
import { unlockAudio } from './lib/sounds';
import './features/theme/themeStore'; // initializes theme from localStorage on load
import './styles/globals.css';
import './styles/theme.css';
import './styles/retro-effects.css';

// iOS keyboard fix:
// When the keyboard opens on iOS, the browser scrolls window.scrollY upward
// (to keep the focused input visible) AND shrinks visualViewport.height.
// We counteract both:
//   1. Set --app-height to visualViewport.height so the layout shrinks correctly
//   2. On every viewport change, scroll window back to 0 so there's no blank space
function applyViewportHeight() {
  const vvp = window.visualViewport;
  const vh  = vvp ? vvp.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${vh}px`);
  // Kill any scroll offset the browser introduced (iOS does this when keyboard opens)
  if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', applyViewportHeight);
  window.visualViewport.addEventListener('scroll', applyViewportHeight);
}
window.addEventListener('resize', applyViewportHeight);
// Also reset scroll whenever any input/textarea gets focus (keyboard about to open)
document.addEventListener('focusin', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    // Delay slightly so the keyboard has started opening
    setTimeout(() => {
      applyViewportHeight();
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }, 100);
    setTimeout(applyViewportHeight, 400); // second pass after keyboard fully open
  }
});
document.addEventListener('focusout', () => {
  // Keyboard closed — restore full height
  setTimeout(applyViewportHeight, 100);
});
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
