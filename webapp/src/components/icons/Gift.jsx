export default function IconGift({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="9.5" width="16" height="10" rx="1.5" stroke={color} strokeWidth="1.6" />
      <path d="M4 13h16M12 9.5v10" stroke={color} strokeWidth="1.6" />
      <path
        d="M12 9.5c0-2.2-1.57-4-3.5-4C6.85 5.5 6 6.36 6 7.4c0 1.16.95 2.1 2.3 2.1H12Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 9.5c0-2.2 1.57-4 3.5-4 1.65 0 2.5.86 2.5 1.9 0 1.16-.95 2.1-2.3 2.1H12Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
