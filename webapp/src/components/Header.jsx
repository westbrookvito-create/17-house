import { useNavigate } from 'react-router-dom';

export default function Header({ title, onMenu, showBack }) {
  const navigate = useNavigate();

  return (
    <div className="topbar">
      {showBack ? (
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
      ) : (
        <div style={{ width: 36 }} />
      )}
      <h1 className="topbar-title serif">{title}</h1>
      {onMenu ? (
        <button className="icon-btn" onClick={onMenu} aria-label="Меню">
          ☰
        </button>
      ) : (
        <div style={{ width: 36 }} />
      )}
    </div>
  );
}
