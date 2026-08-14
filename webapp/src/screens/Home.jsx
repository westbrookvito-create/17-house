import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="screen home-screen">
      <div className="topbar">
        <h1 className="serif" style={{ fontSize: 32 }}>
          17 House
        </h1>
        <Logo height={50} />
      </div>

      <div className="hero hero-full" style={{ backgroundImage: 'url(/hero.jpg)' }} />

      <div className="card card-fill">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="serif" style={{ fontSize: 23 }}>
            Добро пожаловать в 17 House
          </h2>
          <p className="muted">
            Закрытый клуб по интересам. Привилегии в ресторанах. Мерч. Жизнь в стиле.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/card')}>
          Войти в клуб
        </button>
      </div>
    </div>
  );
}
