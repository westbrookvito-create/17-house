import { useEffect, useState } from 'react';
import Header from '../components/Header';
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
      <Header title="Профиль" showBack />

      {error && <div className="center-state">{error}</div>}
      {!error && !user && <div className="center-state">Загрузка…</div>}

      {user && (
        <>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="avatar">{(user.firstName || 'U')[0].toUpperCase()}</div>
            <div>
              <div className="serif" style={{ fontSize: 19 }}>
                {user.firstName || 'Участник'}
              </div>
              <div className="muted">Участник клуба</div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row-between">
              <span className="muted">Карта участника</span>
              <span className="serif" style={{ fontSize: 16 }}>
                #{user.memberCode}
              </span>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row-between">
              <span className="muted">Статус</span>
              <span style={{ textTransform: 'capitalize' }}>{user.status}</span>
            </div>
            <div className="row-between">
              <span className="muted">Действует до</span>
              <span>{formatDate(user.statusUntil)}</span>
            </div>
            <div className="row-between">
              <span className="muted">Куплено футболок</span>
              <span>{user.shirtsPurchased}</span>
            </div>
          </div>

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
