import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { copyToClipboard, hapticSuccess } from '../telegram';

export default function ClubCard() {
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getClubCard()
      .then((data) => setCard(data))
      .catch(() => setError('Не удалось загрузить визитку. Откройте приложение из Telegram-бота.'));
  }, []);

  async function handleCopy() {
    if (!card) return;
    await copyToClipboard(card.memberCode);
    hapticSuccess();
    toast('Код скопирован');
  }

  return (
    <div className="screen">
      <Header title="Визитка клуба" showBack />

      {error && <div className="center-state">{error}</div>}
      {!error && !card && <div className="center-state">Загрузка…</div>}

      {card && !card.hasPurchased && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
          <h3 className="serif" style={{ fontSize: 18 }}>
            Визитка клуба закрыта
          </h3>
          <p className="muted">Вам нужно приобрести футболку, чтобы вступить в клуб.</p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/')}>
            Перейти к футболкам
          </button>
        </div>
      )}

      {card && card.hasPurchased && (
        <>
          <div className="member-card-photo" style={{ backgroundImage: 'url(/card.jpg)' }} />

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="row-between">
              <span className="muted">Карта участника</span>
              <span className="serif" style={{ fontSize: 20, color: 'var(--text)' }}>
                #{card.memberCode}
              </span>
            </div>

            <h3 className="serif" style={{ fontSize: 17 }}>
              Это ваша личная визитка 17 House.
            </h3>
            <p className="muted">
              Ваш персональный код открывает доступ в закрытый канал клуба.
            </p>

            <div>
              <p style={{ fontSize: 14, marginBottom: 8 }}>Внутри канала:</p>
              <ul className="muted" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>Анонсы закрытых событий</li>
                <li>Подборки заведений</li>
                <li>Специальные предложения</li>
                <li>Общение внутри комьюнити</li>
              </ul>
            </div>

            <p className="muted">Отсканируйте код или введите его в Telegram, чтобы получить доступ.</p>
            <button className="btn btn-outline" onClick={handleCopy}>
              Скопировать код
            </button>
            {card.channelUrl && (
              <a className="btn btn-primary" href={card.channelUrl} target="_blank" rel="noreferrer">
                Вступить в чат
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
