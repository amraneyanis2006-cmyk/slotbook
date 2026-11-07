import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireRole } from './auth/RequireRole';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import MySlotsPage from './pages/MySlotsPage';

// ponytail: placeholders until the feature Issues replace them (#5 Book, #6 My Bookings, #7 Schedule).
const ComingSoon = ({ title, issue }: { title: string; issue: number }) => (
  <><h1>{title}</h1><p className="muted">Coming in Issue #{issue}.</p></>
);

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireRole role="CUSTOMER"><AppShell /></RequireRole>}>
          <Route path="/book" element={<ComingSoon title="Book a Slot" issue={5} />} />
          <Route path="/bookings" element={<ComingSoon title="My Bookings" issue={6} />} />
        </Route>
        <Route element={<RequireRole role="STAFF"><AppShell /></RequireRole>}>
          <Route path="/staff/slots" element={<MySlotsPage />} />
          <Route path="/staff/schedule" element={<ComingSoon title="Schedule" issue={7} />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
