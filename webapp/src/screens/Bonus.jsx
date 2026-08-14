import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { api } from '../api';

export default function Bonus() {
  const [bonus, setBonus] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getBonus()
      .then(setBonus)
      .catch(() => setError('Не удалось загрузить бонусы. Откройте приложение из Telegram-бота.'));
  }, []);

  const progress = bonus ? Math.min(100, (bonus.shirtsPurchased / bonus.threshold) * 100) : 0;

  return (
    <div className="screen">
      <Header title="Бонусы" />

      {error && <div className="center-state">{error}</div>}
      {!error && !bonus && <div className="center-state">Загрузка…</div>}

      {bonus && (
        <>
          <div className="hero" style={{ minHeight: '40vh', backgroundImage: 'url(/bonus.jpg)' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 className="serif" style={{ fontSize: 20 }}>
              Бонусы от 17 House
            </h2>

            {bonus.unlocked ? (
              <p style={{ color: 'var(--success)', fontSize: 14 }}>
                🎉 Скидка {bonus.percent}% разблокирована и уже применяется ко всем новым заказам.
              </p>
            ) : (
              <>
                <p className="muted">
                  При покупке {bonus.threshold} футболок вы получите скидку {bonus.percent}% на всю стоимость заказа.
                  А также эксклюзивные подарки, мерч и специальные предложения от ресторанов и бренд-партнёров.
                </p>
                <div>
                  <div className="row-between muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
                    <span>Куплено футболок</span>
                    <span>
                      {bonus.shirtsPurchased} / {bonus.threshold}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </>
            )}

            <button className="btn btn-primary" onClick={() => navigate('/shirts')}>
              Подробнее
            </button>
          </div>
        </>
      )}
    </div>
  );
}
