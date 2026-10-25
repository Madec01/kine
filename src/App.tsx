import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthProvider';
import { LibraryProvider, useLibrary } from './state/LibraryProvider';
import { SelectionProvider } from './state/SelectionProvider';
import { ToastProvider } from './state/ToastProvider';
import { Layout } from './components/Layout';
import { Splash } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { ExerciseDetailPage } from './pages/ExerciseDetailPage';
import { ExerciseFormPage } from './pages/ExerciseFormPage';
import { TagsPage } from './pages/TagsPage';
import { SettingsPage } from './pages/SettingsPage';

const SelectionPage = lazy(() => import('./pages/SelectionPage').then((m) => ({ default: m.SelectionPage })));

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status !== 'signedIn') return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function LibraryGate({ children }: { children: ReactNode }) {
  const { loading, error, reload, library } = useLibrary();
  if (loading && !library) return <Splash message="Ouverture de la bibliothèque…" />;
  if (error && !library) {
    return (
      <div className="splash">
        <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
          <div className="notice notice--danger">{error}</div>
          <button type="button" className="btn" onClick={() => void reload()}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Shell() {
  return (
    <RequireAuth>
      <LibraryProvider>
        <LibraryGate>
          <SelectionProvider>
            <Layout />
          </SelectionProvider>
        </LibraryGate>
      </LibraryProvider>
    </RequireAuth>
  );
}

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter basename={basename}>
        <AuthProvider fallback={<Splash />}>
          <Routes>
            <Route path="/connexion" element={<LoginPage />} />
            <Route element={<Shell />}>
              <Route index element={<Navigate to="/exercices" replace />} />
              <Route path="/exercices" element={<ExercisesPage />} />
              <Route path="/exercices/nouveau" element={<ExerciseFormPage />} />
              <Route path="/exercices/:id" element={<ExerciseDetailPage />} />
              <Route path="/exercices/:id/modifier" element={<ExerciseFormPage />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route
                path="/selection"
                element={
                  <Suspense fallback={<p className="muted small">Chargement de la sélection…</p>}>
                    <SelectionPage />
                  </Suspense>
                }
              />
              <Route path="/reglages" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/exercices" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}
