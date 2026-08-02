import React from 'react';

export function Logo({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 3D Pixel Heart - Shadow base layer */}
      <g opacity="0.3" transform="translate(1, 2)">
        <path d="M6 6H12V10H6V6Z" fill="#7F1D1D" />
        <path d="M20 6H26V10H20V6Z" fill="#7F1D1D" />
        <path d="M4 10H28V16H4V10Z" fill="#7F1D1D" />
        <path d="M6 16H26V20H6V16Z" fill="#7F1D1D" />
        <path d="M8 20H24V24H8V20Z" fill="#7F1D1D" />
        <path d="M11 24H21V27H11V24Z" fill="#7F1D1D" />
        <path d="M14 27H18V30H14V27Z" fill="#7F1D1D" />
      </g>

      {/* 3D Side depth / extrusion faces (Dark Crimson #991B1B) */}
      <g>
        {/* Left top block shadow */}
        <rect x="5" y="6" width="6" height="4" rx="0.5" fill="#991B1B" />
        {/* Right top block shadow */}
        <rect x="19" y="6" width="6" height="4" rx="0.5" fill="#991B1B" />
        {/* Main upper band shadow */}
        <rect x="3" y="10" width="24" height="6" rx="0.5" fill="#991B1B" />
        {/* Middle taper band shadow */}
        <rect x="5" y="16" width="20" height="4" rx="0.5" fill="#991B1B" />
        {/* Lower taper band shadow */}
        <rect x="7" y="20" width="16" height="4" rx="0.5" fill="#991B1B" />
        {/* Tip upper shadow */}
        <rect x="10" y="24" width="10" height="3" rx="0.5" fill="#991B1B" />
        {/* Tip bottom shadow */}
        <rect x="13" y="27" width="4" height="3" rx="0.5" fill="#991B1B" />
      </g>

      {/* 3D Front pixel faces (Vibrant Red-Rose #F43F5E to #E11D48) */}
      <g>
        {/* Top left lob */}
        <rect x="5" y="5" width="6" height="4" fill="#F43F5E" />
        {/* Top right lob */}
        <rect x="19" y="5" width="6" height="4" fill="#F43F5E" />
        {/* Upper main row */}
        <rect x="3" y="9" width="24" height="6" fill="#E11D48" />
        {/* Middle row */}
        <rect x="5" y="15" width="20" height="4" fill="#E11D48" />
        {/* Lower row */}
        <rect x="7" y="19" width="16" height="4" fill="#BE123C" />
        {/* Bottom tip 1 */}
        <rect x="10" y="23" width="10" height="3" fill="#BE123C" />
        {/* Bottom tip 2 */}
        <rect x="13" y="26" width="4" height="3" fill="#9F1239" />
      </g>

      {/* 3D Highlights (Pink/White Pixel Accents #FFE4E6 & #FB7185) */}
      <g>
        {/* Highlighting top left block */}
        <rect x="6" y="5" width="3" height="1.5" fill="#FFE4E6" opacity="0.9" />
        {/* Highlighting top right block */}
        <rect x="20" y="5" width="3" height="1.5" fill="#FFE4E6" opacity="0.9" />
        {/* Highlighting upper main block border */}
        <rect x="4" y="9" width="4" height="1.5" fill="#FFE4E6" opacity="0.9" />
        <rect x="4" y="10.5" width="1.5" height="3" fill="#FB7185" />
        {/* Center sheen block */}
        <rect x="7" y="11" width="2" height="2" fill="#FFFFFF" opacity="0.8" />
      </g>

      {/* 3D Pixel Grid Overlay Lines for Authentic Retro Pixel Feel */}
      <path d="M5 5V9M11 5V9M19 5V9M25 5V9" stroke="#9F1239" strokeWidth="0.5" opacity="0.4" />
      <path d="M3 9V15M27 9V15" stroke="#9F1239" strokeWidth="0.5" opacity="0.4" />
    </svg>
  );
}
