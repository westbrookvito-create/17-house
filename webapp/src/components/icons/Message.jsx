export default function IconMessage({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H9l-4 3.5v-3.5H5.5C4.67 15 4 14.33 4 13.5v-8Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="9.5" r="1" fill={color} />
      <circle cx="12" cy="9.5" r="1" fill={color} />
      <circle cx="15.5" cy="9.5" r="1" fill={color} />
    </svg>
  );
}
