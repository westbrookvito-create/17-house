import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottleMark from '../components/BottleMark';

export default function Home({ onMenu }) {
  const navigate = useNavigate();

  return (
    <div className="screen">
      <Header title="17 House" onMenu={onMenu} />

      <div className="hero">
        <div style={{ position: 'relative', zIndex: 1, opacity: 0.85 }}>
          <BottleMark size={32} />
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <QuickLink icon="👕" title="Футболки" subtitle="Фирменные футболки 17 House в двух цветах" onClick={() => navigate('/shirts')} />
        <QuickLink icon="🎁" title="Бонусы" subtitle="Подарки, мерч и специальные предложения" onClick={() => navigate('/bonus')} />
        <QuickLink icon="👤" title="Профиль" subtitle="Ваша карта участника, статус и данные" onClick={() => navigate('/profile')} />
      </div>
    </div>
  );
}

function QuickLink({ icon, title, subtitle, onClick }) {
  return (
    <button className="list-item" onClick={onClick} style={{ width: '100%', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 15 }}>{title}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
      </div>
      <span className="muted">›</span>
    </button>
  );
}
