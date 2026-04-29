'use client';

import { useState } from 'react';

interface GridSelectorProps {
  initialRows?: number;
  initialCols?: number;
  maxRows?: number;
  maxCols?: number;
  onChange: (rows: number, cols: number) => void;
}

export function GridSelector({
  initialRows = 1,
  initialCols = 1,
  maxRows = 8,
  maxCols = 8,
  onChange,
}: GridSelectorProps) {
  const [hoveredRows, setHoveredRows] = useState(initialRows);
  const [hoveredCols, setHoveredCols] = useState(initialCols);
  const [selectedRows, setSelectedRows] = useState(initialRows);
  const [selectedCols, setSelectedCols] = useState(initialCols);

  const handleMouseLeave = () => {
    setHoveredRows(selectedRows);
    setHoveredCols(selectedCols);
  };

  const handleClick = (r: number, c: number) => {
    setSelectedRows(r);
    setSelectedCols(c);
    onChange(r, c);
  };

  return (
    <div
      className="inline-grid gap-1 p-2 rounded-xl bg-secondary/50 border border-border cursor-pointer"
      style={{
        gridTemplateColumns: `repeat(${maxCols}, 1.25rem)`,
        gridTemplateRows: `repeat(${maxRows}, 1.25rem)`,
      }}
      onMouseLeave={handleMouseLeave}
    >
      {Array.from({ length: maxRows }).map((_, r) =>
        Array.from({ length: maxCols }).map((_, c) => {
          const ri = r + 1, ci = c + 1;
          const isHovered = ri <= hoveredRows && ci <= hoveredCols;
          const isSelected = ri <= selectedRows && ci <= selectedCols;

          return (
            <div
              key={`${ri}-${ci}`}
              className={`w-full h-full rounded-sm transition-all duration-100 ${
                isSelected
                  ? 'bg-primary border border-primary/60'
                  : isHovered
                  ? 'bg-primary/50 border border-primary/40'
                  : 'bg-muted/30 border border-border/50'
              }`}
              onMouseEnter={() => { setHoveredRows(ri); setHoveredCols(ci); }}
              onClick={() => handleClick(ri, ci)}
              role="button"
              aria-label={`Select ${ri} rows and ${ci} columns`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleClick(ri, ci);
              }}
            />
          );
        })
      )}
    </div>
  );
}
