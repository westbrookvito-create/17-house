export default function IconCard({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke={color} strokeWidth="1.6" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" stroke={color} strokeWidth="1.6" />
      <line x1="6.5" y1="14.5" x2="11.5" y2="14.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
