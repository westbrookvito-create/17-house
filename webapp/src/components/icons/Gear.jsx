export default function IconGear({ size = 22, color = 'currentColor' }) {
  const teeth = Array.from({ length: 8 });
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {teeth.map((_, i) => (
        <rect
          key={i}
          x="10.8"
          y="1"
          width="2.4"
          height="4.4"
          rx="1.1"
          fill={color}
          transform={`rotate(${i * 45} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="6.6" stroke={color} strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.3" fill={color} />
    </svg>
  );
}
