import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireRole } from './auth/RequireRole';
import AppShell from './components/AppShell';
import ReleaseFooter from './components/ReleaseFooter';
import BookingDetailPage from './pages/BookingDetailPage';
import BookSlotPage from './pages/BookSlotPage';
import AccountsPage from './pages/AccountsPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import MyBookingsPage from './pages/MyBookingsPage';
import MySlotsPage from './pages/MySlotsPage';
import ReschedulePage from './pages/ReschedulePage';
import SchedulePage from './pages/SchedulePage';
import TemplatesPage from './pages/TemplatesPage';
import SearchPage from './pages/SearchPage';
import ServicesPage from './pages/ServicesPage';
import StaffBookingPage from './pages/StaffBookingPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireRole role="CUSTOMER"><AppShell /></RequireRole>}>
          <Route path="/book" element={<BookSlotPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/bookings" element={<MyBookingsPage />} />
          <Route path="/bookings/:reference" element={<BookingDetailPage />} />
          <Route path="/bookings/:reference/reschedule" element={<ReschedulePage />} />
        </Route>
        <Route element={<RequireRole role="STAFF"><AppShell /></RequireRole>}>
          <Route path="/staff/slots" element={<MySlotsPage />} />
          <Route path="/staff/schedule" element={<SchedulePage />} />
          <Route path="/staff/bookings/:reference" element={<StaffBookingPage />} />
          <Route path="/staff/services" element={<ServicesPage />} />
          <Route path="/staff/dashboard" element={<DashboardPage />} />
          <Route path="/staff/users" element={<AccountsPage />} />
          <Route path="/staff/templates" element={<TemplatesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <ReleaseFooter />
    </AuthProvider>
  );
}
