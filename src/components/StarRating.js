import React from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ rating = 0, count = 0, size = 14, className = '' }) {
  const safeRating = Number.isFinite(Number(rating)) ? Math.max(0, Math.min(5, Number(rating))) : 0;
  const filled = Math.round(safeRating);
  const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`} aria-label={`Rating ${safeRating} out of 5`}>
      <span className="inline-flex items-center gap-[1px]" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => {
          const isOn = i <= filled;
          return (
            <Star
              key={i}
              size={size}
              fill={isOn ? 'currentColor' : 'none'}
              strokeWidth={2}
              className={isOn ? 'text-[#f5c542]' : 'text-slate-200'}
            />
          );
        })}
      </span>
      <span className="text-xs font-semibold text-slate-400 tabular-nums">{safeCount}</span>
    </div>
  );
}

