import React from 'react';

/** Embedded Vite app — use trailing `/` so React Router pathname is `/`, not `/index.html` (which hits the Ships NotFound). */
const SHIPS_INDEX = `${process.env.PUBLIC_URL || ''}/zippyyy-ships-app/`;

export default function ZippyyyShips() {
  return (
    <div className="zippyyy-ships-embed">
      <iframe title="Zippyyy Ships" src={SHIPS_INDEX} className="zippyyy-ships-embed__frame" />
    </div>
  );
}
