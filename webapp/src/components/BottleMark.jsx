export default function BottleMark({ size = 40, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke={color}
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="40" height="40" rx="6" opacity="0.35" />
      <path d="M21 6h6v5.5c0 1-0.4 1.6-1 2.2l-1 1v3h-2v-3l-1-1c-0.6-0.6-1-1.2-1-2.2V6Z" />
      <path d="M19.5 14.5h9c1.4 0 2.5 1.1 2.5 2.5v18c0 3-2.2 5-5 5h-4c-2.8 0-5-2-5-5V17c0-1.4 1.1-2.5 2.5-2.5Z" />
      <path d="M17 24c1.6-1 2.5-1 4 0s2.4 1 4 0 2.4-1 4 0" opacity="0.6" />
      <circle cx="24" cy="9.5" r="0.9" fill={color} stroke="none" />
    </svg>
  );
}
