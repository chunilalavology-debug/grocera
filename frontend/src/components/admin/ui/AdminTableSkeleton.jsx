import React from 'react';

export function AdminTableSkeleton({ rows = 8, cols = 7 }) {
  return (
    <tbody aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-100">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-3">
              <div
                className="h-4 rounded-md bg-slate-100 animate-pulse"
                style={{ width: c === 0 ? '1rem' : c === 1 ? '2.5rem' : `${60 + ((r + c) % 5) * 12}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export default AdminTableSkeleton;
