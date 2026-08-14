import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="screen home-screen">
      <div className="topbar" style={{ justifyContent: 'center', gap: 10 }}>
        <Logo height={36} />
        <h1 className="serif" style={{ fontSize: 30 }}>
          17 House
        </h1>
      </div>

      <div className="hero hero-full" style={{ backgroundImage: 'url(/hero.jpg)' }} />

      <div className="card card-fill">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 className="serif" style={{ fontSize: 23 }}>
            Добро пожаловать в 17 House
          </h2>
          <p className="muted" style={{ fontSize: 21, lineHeight: 1.8, whiteSpace: 'nowrap' }}>
            Закрытый клуб по интересам
            <br />
            Привилегии в ресторанах. Мерч
            <br />
            Жизнь в стиле
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/card')}>
          Войти в клуб
        </button>
      </div>
    </div>
  );
}
