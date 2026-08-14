export default function IconUser({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.2" stroke={color} strokeWidth="1.6" />
      <path d="M5 19c0-3.3 3.13-6 7-6s7 2.7 7 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
