export default function IconMenu({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <line x1="4" y1="7" x2="20" y2="7" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="4" y1="17" x2="20" y2="17" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
