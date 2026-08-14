import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { hapticSuccess, hapticError, hapticSelect } from '../telegram';

export default function Shirts() {
  const [products, setProducts] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.getProducts(), api.getProfile()])
      .then(([p, me]) => {
        setProducts(p.products);
        setProfile(me.user);
      })
      .catch(() => setError('Не удалось загрузить каталог. Откройте приложение из Telegram-бота.'));
  }, []);

  return (
    <div className="screen">
      <Header title="Каталог" />
      <p className="muted" style={{ marginTop: -8 }}>
        Два цвета. Один вайб.
      </p>

      {error && <div className="center-state">{error}</div>}
      {!error && products === null && <div className="center-state">Загрузка…</div>}
      {!error && products?.length === 0 && (
        <div className="center-state">Пока нет товаров в каталоге. Загляните позже.</div>
      )}

      {products?.map((p) => (
        <ProductBlock key={p.id} product={p} bonusUnlocked={profile?.bonusUnlocked} toast={toast} />
      ))}
    </div>
  );
}

function ProductBlock({ product, bonusUnlocked, toast }) {
  const [color, setColor] = useState(product.colors[0]?.name || null);
  const [size, setSize] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState(false);

  const finalPrice = bonusUnlocked ? Math.round(product.price * 0.9) : product.price;

  async function handleBuy() {
    if (!size) return;
    setSubmitting(true);
    try {
      await api.createOrder({ productId: product.id, color, size });
      setOrdered(true);
      hapticSuccess();
      toast('Заказ отправлен! Мы напишем в этот чат после подтверждения оплаты.');
    } catch {
      hapticError();
      toast('Не получилось оформить заказ. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {product.colors.map((c) => (
        <button
          key={c.name}
          className="color-plate"
          onClick={() => {
            setColor(c.name);
            hapticSelect();
          }}
        >
          <div className={`color-plate-image${c.name === color ? ' selected' : ''}`}>
            {c.imageUrl ? (
              <img src={buildImageUrl(c.imageUrl)} alt={c.name} />
            ) : (
              <span className="serif" style={{ opacity: 0.55, fontSize: 15 }}>
                {product.name}
              </span>
            )}
          </div>
          <span className="color-plate-label serif">{c.name}</span>
        </button>
      ))}

      {product.sizes.length > 0 && (
        <div className="size-row" style={{ justifyContent: 'center' }}>
          {product.sizes.map((s) => (
            <button
              key={s}
              className={`size-chip${s === size ? ' selected' : ''}`}
              onClick={() => {
                setSize(s);
                hapticSelect();
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="row-between" style={{ padding: '0 2px' }}>
        <span className="muted">Цена</span>
        <span style={{ fontWeight: 600 }}>
          {bonusUnlocked && (
            <span className="muted" style={{ textDecoration: 'line-through', marginRight: 8, fontWeight: 400 }}>
              {product.price} ₽
            </span>
          )}
          {finalPrice} ₽
        </span>
      </div>

      <button className="btn btn-primary" disabled={!size || submitting || ordered} onClick={handleBuy}>
        {ordered ? 'Заказ отправлен ✓' : submitting ? 'Отправляем…' : 'Купить футболку'}
      </button>
    </div>
  );
}

function buildImageUrl(path) {
  if (path.startsWith('http')) return path;
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return `${apiUrl}${path}`;
}
