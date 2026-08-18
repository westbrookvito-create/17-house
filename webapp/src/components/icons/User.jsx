export default function IconUser({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.2" r="3.6" stroke={color} strokeWidth="1.6" />
      <path
        d="M4.8 19.5c1.1-3.4 3.8-5.4 7.2-5.4s6.1 2 7.2 5.4"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
