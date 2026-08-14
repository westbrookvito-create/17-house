import { Routes, Route } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import { ToastProvider } from './components/Toast';
import Home from './screens/Home';
import Shirts from './screens/Shirts';
import ClubCard from './screens/ClubCard';
import Bonus from './screens/Bonus';
import Profile from './screens/Profile';

export default function App() {
  return (
    <ToastProvider>
      <div className="app-shell">
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shirts" element={<Shirts />} />
            <Route path="/card" element={<ClubCard />} />
            <Route path="/bonus" element={<Bonus />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
