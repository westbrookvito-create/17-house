import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Logo from '../components/Logo';
import { api } from '../api';
import { useToast } from '../components/Toast';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getProfile()
      .then((data) => setUser(data.user))
      .catch(() => setError('Не удалось загрузить профиль. Откройте приложение из Telegram-бота.'));
  }, []);

  function handleExit() {
    window.Telegram?.WebApp?.close ? window.Telegram.WebApp.close() : toast('Можно закрыть приложение');
  }

  return (
    <div className="screen">
      <Header title="Профиль" />

      {error && <div className="center-state">{error}</div>}
      {!error && !user && <div className="center-state">Загрузка…</div>}

      {user && (
        <>
          <div
            className="member-card member-card-light"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="member-card-code">Карта участника</span>
              <span className="serif" style={{ fontSize: 34, lineHeight: 1 }}>
                #{user.memberCode}
              </span>
            </div>
            <Logo height={60} />
          </div>

          <div className="card" style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
                Статус
              </div>
              <div style={{ textTransform: 'capitalize' }}>{user.status}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
                Действует до
              </div>
              <div>{formatDate(user.statusUntil)}</div>
            </div>
          </div>

          <button className="list-item" style={{ width: '100%' }} onClick={() => navigate('/card')}>
            <span>🪪 Визитка клуба</span>
            <span className="muted">›</span>
          </button>

          <button className="list-item" style={{ width: '100%' }} onClick={() => toast('Настройки скоро появятся')}>
            <span>⚙️ Настройки</span>
            <span className="muted">›</span>
          </button>

          <button className="list-item" style={{ width: '100%' }} onClick={handleExit}>
            <span>🚪 Выход</span>
            <span className="muted">›</span>
          </button>
        </>
      )}
    </div>
  );
}
