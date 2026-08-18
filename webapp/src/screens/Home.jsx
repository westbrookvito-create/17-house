import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import IconMenu from '../components/icons/Menu';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { hapticSuccess, hapticError, hapticSelect, copyToClipboard } from '../telegram';

const DELIVERY_OPTIONS = [
  { value: 'yandex', label: 'Яндекс Доставка' },
  { value: 'cdek', label: 'СДЭК' },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [products, setProducts] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();
  const navigate = useNavigate();
  const catalogRef = useRef(null);

  useEffect(() => {
    Promise.all([api.getProducts(), api.getProfile()])
      .then(([p, me]) => {
        setProducts(p.products);
        setProfile(me.user);
      })
      .catch(() => setError('Не удалось загрузить каталог. Откройте приложение из Telegram-бота.'));
  }, []);

  function scrollToCatalog() {
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goTo(path) {
    setMenuOpen(false);
    navigate(path);
  }

  return (
    <div className="home-scroll">
      <section className="home-section">
        <div className="topbar" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo height={32} />
            <h1 className="serif" style={{ fontSize: 24, margin: 0 }}>
              17 House
            </h1>
          </div>
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Меню">
            <IconMenu size={20} />
          </button>
        </div>

        <div className="hero hero-lg" style={{ backgroundImage: 'url(/hero.jpg)' }} />

        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 className="serif" style={{ fontSize: 24 }}>
              Добро пожаловать в 17 House
            </h2>
            <p className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>
              Закрытый клуб по интересам. Привилегии, события и люди на одной волне.
            </p>
          </div>
          <button className="btn btn-primary" onClick={scrollToCatalog}>
            Купить футболку
          </button>
        </div>
      </section>

      <section className="home-section" ref={catalogRef}>
        <h3 className="serif" style={{ fontSize: 18, margin: 0 }}>
          Каталог
        </h3>

        {error && <div className="center-state">{error}</div>}
        {!error && products === null && <div className="center-state">Загрузка…</div>}
        {!error && products?.length === 0 && (
          <div className="center-state">Пока нет товаров в каталоге. Загляните позже.</div>
        )}

        {products?.map((p) => (
          <ProductBlock key={p.id} product={p} bonusUnlocked={profile?.bonusUnlocked} toast={toast} />
        ))}
      </section>

      {menuOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="menu-panel">
            <button className="menu-item" onClick={() => goTo('/profile')}>
              Профиль
            </button>
            <button className="menu-item" onClick={() => goTo('/bonus')}>
              Бонусы
            </button>
            <button className="menu-item" onClick={() => goTo('/card')}>
              Визитка клуба
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ProductBlock({ product, bonusUnlocked, toast }) {
  const [size, setSize] = useState(null);
  const [stage, setStage] = useState('select'); // select -> form -> payment
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null);
  const [form, setForm] = useState({ deliveryMethod: '', recipientName: '', phone: '', pvzAddress: '' });

  const finalPrice = bonusUnlocked ? Math.round(product.price * 0.9) : product.price;
  const formValid =
    form.deliveryMethod && form.recipientName.trim() && form.phone.trim() && form.pvzAddress.trim();

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmitOrder() {
    if (!formValid) return;
    setSubmitting(true);
    try {
      const res = await api.createOrder({
        productId: product.id,
        size,
        deliveryMethod: form.deliveryMethod,
        recipientName: form.recipientName.trim(),
        phone: form.phone.trim(),
        pvzAddress: form.pvzAddress.trim(),
      });
      setOrder(res.order);
      setStage('payment');
      hapticSuccess();
    } catch {
      hapticError();
      toast('Не получилось оформить заказ. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyPhone() {
    if (!order) return;
    await copyToClipboard(order.payment.phone);
    hapticSuccess();
    toast('Номер скопирован');
  }

  const galleryImages = product.imageUrls || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 className="serif" style={{ fontSize: 18, margin: 0, padding: '0 2px' }}>
        {product.name}
      </h3>

      {galleryImages.length > 0 && <ProductGallery images={galleryImages} alt={product.name} />}

      {product.sizes.length > 0 && (
        <div className="size-row" style={{ justifyContent: 'center' }}>
          {product.sizes.map((s) => (
            <button
              key={s}
              className={`size-chip${s === size ? ' selected' : ''}`}
              disabled={stage !== 'select'}
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

      {stage === 'select' && (
        <button className="btn btn-primary" disabled={!size} onClick={() => setStage('form')}>
          Купить футболку
        </button>
      )}

      {stage === 'form' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 className="serif" style={{ fontSize: 16 }}>
            Доставка и получатель
          </h3>

          <div className="size-row">
            {DELIVERY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`size-chip${form.deliveryMethod === opt.value ? ' selected' : ''}`}
                style={{ minWidth: 'auto', flex: 1 }}
                onClick={() => updateForm('deliveryMethod', opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <input
            className="input"
            placeholder="ФИО (как в переводе, которым будете платить)"
            value={form.recipientName}
            onChange={(e) => updateForm('recipientName', e.target.value)}
          />
          <input
            className="input"
            placeholder="Номер телефона"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => updateForm('phone', e.target.value)}
          />
          <input
            className="input"
            placeholder="Адрес ПВЗ"
            value={form.pvzAddress}
            onChange={(e) => updateForm('pvzAddress', e.target.value)}
          />

          <button className="btn btn-primary" disabled={!formValid || submitting} onClick={handleSubmitOrder}>
            {submitting ? 'Оформляем…' : 'Оформить заказ'}
          </button>
          <button className="btn btn-outline" disabled={submitting} onClick={() => setStage('select')}>
            Отмена
          </button>
        </div>
      )}

      {stage === 'payment' && order && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 className="serif" style={{ fontSize: 16 }}>
            Заказ #{order.id} оформлен ✓
          </h3>
          <p className="muted">
            Переведите {order.price} ₽ по номеру телефона на реквизиты ниже. После поступления оплаты мы напишем в
            этот чат.
          </p>
          <div className="row-between">
            <span className="muted">Телефон</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{order.payment.phone}</span>
          </div>
          <div className="row-between">
            <span className="muted">Получатель</span>
            <span style={{ color: 'var(--text)' }}>{order.payment.name}</span>
          </div>
          <div className="row-between">
            <span className="muted">Банк</span>
            <span style={{ color: 'var(--text)' }}>{order.payment.bank}</span>
          </div>
          <button className="btn btn-primary" onClick={handleCopyPhone}>
            Скопировать номер
          </button>
        </div>
      )}
    </div>
  );
}

function ProductGallery({ images, alt }) {
  const [index, setIndex] = useState(0);

  function handleScroll(e) {
    const el = e.target;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="product-gallery">
      <div className="product-gallery-track" onScroll={handleScroll}>
        {images.map((url, i) => (
          <div className="product-gallery-item" key={i}>
            <img src={buildImageUrl(url)} alt={alt} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="product-gallery-dots">
          {images.map((_, i) => (
            <span key={i} className={`product-gallery-dot${i === index ? ' active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function buildImageUrl(path) {
  if (path.startsWith('http')) return path;
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return `${apiUrl}${path}`;
}
