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

      {card && (
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
              При покупке футболки вы получаете визитку с уникальным кодом для доступа в закрытый канал клуба.
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

            {card.hasPurchased ? (
              <>
                <p className="muted">
                  Отсканируйте код или введите его в Telegram, чтобы получить доступ в закрытый канал клуба.
                </p>
                <button className="btn btn-primary" onClick={handleCopy}>
                  Скопировать код
                </button>
                {card.channelUrl && (
                  <a className="btn btn-outline" href={card.channelUrl} target="_blank" rel="noreferrer">
                    Открыть канал клуба
                  </a>
                )}
              </>
            ) : (
              <>
                <p className="muted">
                  Доступ в закрытый канал открывается после первой покупки в клубе. Оформите и оплатите заказ —
                  и мы пришлём приглашение в этот чат.
                </p>
                <button className="btn btn-primary" onClick={() => navigate('/shirts')}>
                  Перейти к футболкам
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
