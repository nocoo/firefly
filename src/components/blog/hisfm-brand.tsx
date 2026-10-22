// SVG paths copied from his.fm apps/web/src/brand/Brand.tsx (cfbefd2).

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <svg className={`podcast-brand-wordmark ${className}`} viewBox="0 0 600 170" aria-hidden="true" focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(20 16) scale(1.68 1.48)"
      >
        <path d="M10 8V83M10 54C10 28 61 27 61 55V83M85 44V83M143 42C129 31 108 38 109 50C110 62 146 56 146 72C146 86 123 88 111 78M197 83V31C197 13 209 10 223 12M184 43H224M248 83V42M248 59C248 32 287 33 287 60V83M287 60C287 33 327 33 327 60V83" />
        <circle fill="currentColor" stroke="none" cx="85" cy="15" r="7.5" />
        <circle fill="currentColor" stroke="none" cx="170" cy="80" r="7.5" />
      </g>
    </svg>
  );
}

export function BrandSymbol({ className = '' }: { className?: string }) {
  return (
    <svg className={`podcast-brand-symbol ${className}`} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="17" strokeLinecap="round">
        <path d="M48 16C7 27 7 101 48 112M80 16C121 27 121 101 80 112" />
      </g>
    </svg>
  );
}
