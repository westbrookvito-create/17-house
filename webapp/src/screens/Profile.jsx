import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Logo from '../components/Logo';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { getTelegramUser } from '../telegram';

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
  const tgUser = getTelegramUser();

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
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {tgUser?.photo_url ? (
              <img
                src={tgUser.photo_url}
                alt=""
                className="avatar"
                style={{ objectFit: 'cover', fontSize: 0 }}
              />
            ) : (
              <div className="avatar">{(user.firstName || 'U')[0].toUpperCase()}</div>
            )}
            <div>
              <div className="serif" style={{ fontSize: 19 }}>
                {user.firstName || 'Участник'}
              </div>
              <div className="muted">Участник клуба</div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="muted">Карта участника</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="serif" style={{ fontSize: 16 }}>
                #{user.memberCode}
              </span>
              <Logo height={20} style={{ opacity: 0.75 }} />
            </div>
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
