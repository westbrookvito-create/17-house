import { useNavigate, useLocation } from 'react-router-dom';

const ITEMS = [
  { path: '/', label: 'Главная', icon: '🏛' },
  { path: '/shirts', label: 'Футболки', icon: '👕' },
  { path: '/card', label: 'Визитка клуба', icon: '🪪' },
  { path: '/bonus', label: 'Бонусы', icon: '🎁' },
  { path: '/profile', label: 'Профиль', icon: '👤' },
];

export default function NavDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!open) return null;

  return (
    <>
      <div className="nav-drawer-backdrop" onClick={onClose} />
      <nav className="nav-drawer">
        {ITEMS.map((item) => (
          <button
            key={item.path}
            className={`nav-drawer-item${location.pathname === item.path ? ' active' : ''}`}
            onClick={() => {
              navigate(item.path);
              onClose();
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
