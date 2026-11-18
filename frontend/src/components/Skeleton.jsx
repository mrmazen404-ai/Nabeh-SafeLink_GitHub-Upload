import '../styles/theme.css';

export function Skeleton({ width = '100%', height = '20px', borderRadius = 'var(--radius-sm)', style = {} }) {
  return (
    <div
      className="skeleton-loader"
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--border-color)',
        opacity: 0.6,
        animation: 'skeleton-pulse 1.5s infinite ease-in-out',
        ...style
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ rows = 3 }) {
  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-3)'
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="40%" height="18px" />
        <Skeleton width="80px" height="24px" borderRadius="var(--radius-full)" />
      </div>
      <Skeleton width="80%" height="14px" />
      {rows > 2 && <Skeleton width="60%" height="14px" />}
    </div>
  );
}
