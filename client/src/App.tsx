import { Navigate, Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      {/* ponytail: placeholder until F-01 (Issue #3) adds the login form and role routes. */}
      <Route path="/login" element={<main><h1>SlotBook</h1><p>Log in arrives with Issue #3.</p></main>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
