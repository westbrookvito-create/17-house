export default function IconBag({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7.5 8.5V7a4.5 4.5 0 0 1 9 0v1.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="4.5" y="8.5" width="15" height="11" rx="2" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}
