import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Logo from '../components/Logo';
import IconGear from '../components/icons/Gear';
import IconMessage from '../components/icons/Message';
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
  const tgUser = getTelegramUser();

  useEffect(() => {
    api
      .getProfile()
      .then((data) => setUser(data.user))
      .catch(() => setError('Не удалось загрузить профиль. Откройте приложение из Telegram-бота.'));
  }, []);

  function handleContactManager() {
    toast('Открываем чат с менеджером…');
    setTimeout(() => {
      window.Telegram?.WebApp?.close?.();
    }, 900);
  }

  return (
    <div className="screen">
      <Header title="Профиль" />

      {error && <div className="center-state">{error}</div>}
      {!error && !user && <div className="center-state">Загрузка…</div>}

      {user && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
              <div className="serif" style={{ fontSize: 19, color: 'var(--text)' }}>
                {user.firstName || 'Участник'}
              </div>
              <div className="muted">Участник клуба</div>
            </div>
          </div>

          <div
            className="member-card member-card-light"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="member-card-code">Карта участника</span>
              <span className="serif" style={{ fontSize: 34, lineHeight: 1, color: 'var(--text)' }}>
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
              <div style={{ textTransform: 'capitalize', color: 'var(--text)' }}>{user.status}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
                Действует до
              </div>
              <div style={{ color: 'var(--text)' }}>{formatDate(user.statusUntil)}</div>
            </div>
          </div>

          <button className="list-item" style={{ width: '100%' }} onClick={() => toast('Настройки скоро появятся')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconGear size={22} color="var(--text)" />
              Настройки
            </span>
            <span className="muted">›</span>
          </button>

          <button className="list-item" style={{ width: '100%' }} onClick={handleContactManager}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconMessage size={22} color="var(--text)" />
              Связаться с менеджером
            </span>
            <span className="muted">›</span>
          </button>
        </>
      )}
    </div>
  );
}
