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
      <Header title="Футболки" showBack />
      <p className="muted" style={{ marginTop: -8 }}>
        Два цвета. Один вайб.
      </p>

      {error && <div className="center-state">{error}</div>}
      {!error && products === null && <div className="center-state">Загрузка…</div>}
      {!error && products?.length === 0 && (
        <div className="center-state">Пока нет товаров в каталоге. Загляните позже.</div>
      )}

      {products?.map((p) => (
        <ProductCard key={p.id} product={p} bonusUnlocked={profile?.bonusUnlocked} toast={toast} />
      ))}
    </div>
  );
}

function ProductCard({ product, bonusUnlocked, toast }) {
  const [color, setColor] = useState(product.colors[0]?.name || null);
  const [size, setSize] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState(false);

  const activeColor = product.colors.find((c) => c.name === color) || product.colors[0];
  const finalPrice = bonusUnlocked ? Math.round(product.price * 0.9) : product.price;

  async function handleBuy() {
    if (!size) return;
    setSubmitting(true);
    try {
      await api.createOrder({ productId: product.id, color, size });
      setOrdered(true);
      hapticSuccess();
      toast('Заказ отправлен! Мы напишем в этот чат после подтверждения оплаты.');
    } catch (err) {
      hapticError();
      toast('Не получилось оформить заказ. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="product-card">
      <div className="product-image">
        {activeColor?.imageUrl ? (
          <img src={buildImageUrl(activeColor.imageUrl)} alt={activeColor.name} />
        ) : (
          <span>{product.name}</span>
        )}
      </div>
      <div className="product-body">
        <div className="row-between">
          <h3 className="serif" style={{ fontSize: 18 }}>
            {product.name}
          </h3>
          <div style={{ textAlign: 'right' }}>
            {bonusUnlocked && (
              <div className="muted" style={{ textDecoration: 'line-through', fontSize: 12 }}>
                {product.price} ₽
              </div>
            )}
            <div style={{ fontWeight: 600 }}>{finalPrice} ₽</div>
          </div>
        </div>
        {product.description && <p className="muted">{product.description}</p>}

        {product.colors.length > 0 && (
          <div className="color-dots">
            {product.colors.map((c) => (
              <button
                key={c.name}
                className={`color-chip${c.name === color ? ' selected' : ''}`}
                onClick={() => {
                  setColor(c.name);
                  hapticSelect();
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {product.sizes.length > 0 && (
          <div className="size-row">
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

        <button className="btn btn-primary" disabled={!size || submitting || ordered} onClick={handleBuy}>
          {ordered ? 'Заказ отправлен ✓' : submitting ? 'Отправляем…' : 'Купить футболку'}
        </button>
      </div>
    </div>
  );
}

function buildImageUrl(path) {
  if (path.startsWith('http')) return path;
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return `${apiUrl}${path}`;
}
