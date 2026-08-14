import { NavLink } from 'react-router-dom';

const TABS = [
  { path: '/', label: 'Добро пожаловать', icon: '🏛' },
  { path: '/shirts', label: 'Каталог', icon: '🛍' },
  { path: '/bonus', label: 'Бонусы', icon: '🎁' },
  { path: '/profile', label: 'Профиль', icon: '👤' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.path === '/'}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span className="bottom-nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
