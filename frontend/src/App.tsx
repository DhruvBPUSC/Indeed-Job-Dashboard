import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router';

import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/layout/AppLayout';
import { APP_NAME } from './config/brand';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { DashboardPage } from './pages/DashboardPage';

const COMING_SOON: { path: string; title: string }[] = [
  { path: 'applications/:id', title: 'Application Details' },
  { path: 'saved', title: 'Saved Jobs' },
  { path: 'messages', title: 'Messages' },
  { path: 'resources', title: 'Career Resources' },
  { path: 'jobs', title: 'Job Search' },
  { path: 'notifications', title: 'Notifications' },
  { path: 'profile', title: 'Your Profile' },
];

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = APP_NAME;
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          {COMING_SOON.map(({ path, title }) => (
            <Route key={path} path={path} element={<ComingSoonPage title={title} />} />
          ))}
          <Route path="*" element={<ComingSoonPage title="Page not found" />} />
        </Route>
      </Route>
    </Routes>
  );
}
