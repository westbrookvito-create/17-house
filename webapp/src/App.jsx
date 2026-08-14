import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import NavDrawer from './components/NavDrawer';
import { ToastProvider } from './components/Toast';
import Home from './screens/Home';
import Shirts from './screens/Shirts';
import ClubCard from './screens/ClubCard';
import Bonus from './screens/Bonus';
import Profile from './screens/Profile';

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<Home onMenu={() => setMenuOpen(true)} />} />
          <Route path="/shirts" element={<Shirts />} />
          <Route path="/card" element={<ClubCard />} />
          <Route path="/bonus" element={<Bonus />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
        <NavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
    </ToastProvider>
  );
}
