import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Home from './screens/Home';
import Bonus from './screens/Bonus';
import Profile from './screens/Profile';

export default function App() {
  return (
    <ToastProvider>
      <div className="app-shell">
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/bonus" element={<Bonus />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
      </div>
    </ToastProvider>
  );
}
