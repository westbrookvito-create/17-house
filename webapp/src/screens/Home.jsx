import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="screen">
      <Header title="17 House" showLogo />

      <div className="hero hero-lg" style={{ backgroundImage: 'url(/hero.jpg)' }} />

      <div className="card" style={{ gap: 14, display: 'flex', flexDirection: 'column' }}>
        <h2 className="serif" style={{ fontSize: 23 }}>
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
