export default function IconGift({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="9.5" width="17" height="10" rx="1.5" stroke={color} strokeWidth="1.6" />
      <line x1="3.5" y1="13.5" x2="20.5" y2="13.5" stroke={color} strokeWidth="1.6" />
      <line x1="12" y1="9.5" x2="12" y2="19.5" stroke={color} strokeWidth="1.6" />
      <path
        d="M12 9.5c0-2.2-1.6-4-3.5-4S6 6.8 6 8.3c0 .8.9 1.2 2 1.2h4Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 9.5c0-2.2 1.6-4 3.5-4S18 6.8 18 8.3c0 .8-.9 1.2-2 1.2h-4Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
