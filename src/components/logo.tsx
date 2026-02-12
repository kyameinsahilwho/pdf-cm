export function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
      fill="none"
    >
      <text x="1" y="22" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="18" fill="currentColor">pdf</text>
      <rect x="27" y="8" width="2" height="18" fill="currentColor">
         <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}
