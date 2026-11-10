import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireRole } from './auth/RequireRole';
import AppShell from './components/AppShell';
import BookingDetailPage from './pages/BookingDetailPage';
import BookSlotPage from './pages/BookSlotPage';
import LoginPage from './pages/LoginPage';
import MyBookingsPage from './pages/MyBookingsPage';
import MySlotsPage from './pages/MySlotsPage';
import SchedulePage from './pages/SchedulePage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireRole role="CUSTOMER"><AppShell /></RequireRole>}>
          <Route path="/book" element={<BookSlotPage />} />
          <Route path="/bookings" element={<MyBookingsPage />} />
          <Route path="/bookings/:reference" element={<BookingDetailPage />} />
        </Route>
        <Route element={<RequireRole role="STAFF"><AppShell /></RequireRole>}>
          <Route path="/staff/slots" element={<MySlotsPage />} />
          <Route path="/staff/schedule" element={<SchedulePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
