export default function IconShirt({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M8.5 3.5 4 7l3 3v10q0 1 1 1h8q1 0 1-1V10l3-3-4.5-3.5q-.5 2.5-3.5 2.5t-3.5-2.5Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
