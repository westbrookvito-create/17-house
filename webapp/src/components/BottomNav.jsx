import { NavLink } from 'react-router-dom';
import IconHome from './icons/Home';
import IconShirt from './icons/Shirt';
import IconGift from './icons/Gift';
import IconUser from './icons/User';

const TABS = [
  { path: '/', label: 'Добро пожаловать', Icon: IconHome },
  { path: '/shirts', label: 'Каталог', Icon: IconShirt },
  { path: '/bonus', label: 'Бонусы', Icon: IconGift },
  { path: '/profile', label: 'Профиль', Icon: IconUser },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ path, label, Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          <span className="bottom-nav-icon">
            <Icon size={22} />
          </span>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
