import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottleMark from '../components/BottleMark';

export default function Home({ onMenu }) {
  const navigate = useNavigate();

  return (
    <div className="screen">
      <Header title="17 House" onMenu={onMenu} showLogo />

      <div className="hero">
        <div style={{ position: 'relative', zIndex: 1, opacity: 0.85, margin: '0 auto' }}>
          <BottleMark size={40} />
        </div>
      </div>

      <div className="card" style={{ gap: 14, display: 'flex', flexDirection: 'column' }}>
        <h2 className="serif" style={{ fontSize: 22 }}>
          Добро пожаловать в 17 House
        </h2>
        <p className="muted">
          Закрытый клуб по интересам. Привилегии в ресторанах. Мерч. Жизнь в стиле.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/card')}>
          Войти в клуб
        </button>
      </div>
    </div>
  );
}
