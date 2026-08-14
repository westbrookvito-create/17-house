export default function Logo({ height = 24, style }) {
  return (
    <img
      src="/logo.png"
      alt="17 House"
      style={{ height, width: 'auto', display: 'block', objectFit: 'contain', ...style }}
    />
  );
}
