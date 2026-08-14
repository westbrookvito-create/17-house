import { useNavigate } from 'react-router-dom';
import BottleMark from './BottleMark';

export default function Header({ title, showBack, showLogo }) {
  const navigate = useNavigate();

  return (
    <div className="topbar">
      {showBack ? (
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
      ) : showLogo ? (
        <BottleMark size={24} color="var(--text)" />
      ) : (
        <div style={{ width: 36 }} />
      )}
      <h1 className="topbar-title serif">{title}</h1>
      <div style={{ width: 36 }} />
    </div>
  );
}
