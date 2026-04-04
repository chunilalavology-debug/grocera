import { createRequire } from "module";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);

let db = null;

/**
 * Open SQLite on first use only so /api/health and /api/quotes can run without
 * loading better-sqlite3 until checkout routes need persistence.
 * On Vercel, only /tmp is writable — use that for the DB file.
 */
function getDb() {
  if (db) return db;
  const Database = require("better-sqlite3");
  const onVercel = Boolean(process.env.VERCEL);
  const dataDir = onVercel
    ? path.join("/tmp", "zippyyy-ships-data")
    : path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "zippyyy.sqlite");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
  CREATE TABLE IF NOT EXISTS shipments (
    checkout_session_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,

    draft_json TEXT NOT NULL,
    selected_rate_json TEXT,

    easyship_shipment_id TEXT,
    easyship_label_id TEXT,
    tracking_number TEXT,
    label_url TEXT,
    label_pdf_base64 TEXT,

    last_error TEXT
  );
`);

  return db;
}

export function upsertDraft({ checkoutSessionId, draft, selectedRate }) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO shipments (
      checkout_session_id, status, created_at, draft_json, selected_rate_json
    ) VALUES (
      @checkout_session_id, @status, @created_at, @draft_json, @selected_rate_json
    )
    ON CONFLICT(checkout_session_id) DO UPDATE SET
      draft_json=excluded.draft_json,
      selected_rate_json=excluded.selected_rate_json
  `);

  stmt.run({
    checkout_session_id: checkoutSessionId,
    status: "created",
    created_at: Date.now(),
    draft_json: JSON.stringify(draft),
    selected_rate_json: selectedRate ? JSON.stringify(selectedRate) : null,
  });
}

export function getShipmentBySessionId(checkoutSessionId) {
  const d = getDb();
  const row = d
    .prepare(`SELECT * FROM shipments WHERE checkout_session_id = ?`)
    .get(checkoutSessionId);
  if (!row) return null;
  return {
    checkoutSessionId: row.checkout_session_id,
    status: row.status,
    createdAt: row.created_at,
    draft: safeJson(row.draft_json),
    selectedRate: safeJson(row.selected_rate_json),
    easyshipShipmentId: row.easyship_shipment_id,
    easyshipLabelId: row.easyship_label_id,
    trackingNumber: row.tracking_number,
    labelUrl: row.label_url,
    labelPdfBase64: row.label_pdf_base64,
    lastError: row.last_error,
  };
}

export function setShipmentStatus(checkoutSessionId, status, patch = {}) {
  const d = getDb();
  const fields = {
    status,
    easyship_shipment_id: patch.easyshipShipmentId ?? null,
    easyship_label_id: patch.easyshipLabelId ?? null,
    tracking_number: patch.trackingNumber ?? null,
    label_url: patch.labelUrl ?? null,
    label_pdf_base64: patch.labelPdfBase64 ?? null,
    last_error: patch.lastError ?? null,
  };

  const stmt = d.prepare(`
    UPDATE shipments SET
      status=@status,
      easyship_shipment_id=COALESCE(@easyship_shipment_id, easyship_shipment_id),
      easyship_label_id=COALESCE(@easyship_label_id, easyship_label_id),
      tracking_number=COALESCE(@tracking_number, tracking_number),
      label_url=COALESCE(@label_url, label_url),
      label_pdf_base64=COALESCE(@label_pdf_base64, label_pdf_base64),
      last_error=COALESCE(@last_error, last_error)
    WHERE checkout_session_id=@checkout_session_id
  `);

  stmt.run({ checkout_session_id: checkoutSessionId, ...fields });
}

function safeJson(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
