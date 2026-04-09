const PDFDocument = require("pdfkit");
const sharp = require("sharp");

async function fetchUrlBuffer(url) {
  const u = String(url || "").trim();
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15_000);
    const res = await fetch(u, {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "Zippyyy-Invoice/1.0",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = String(res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return null;
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

/**
 * PDFKit supports PNG/JPEG well; storefront logos are often WebP, SVG, or AVIF from Cloudinary.
 */
async function toPdfSafeImageBuffer(input) {
  if (!Buffer.isBuffer(input) || !input.length) return null;
  try {
    const meta = await sharp(input).metadata();
    const fmt = String(meta.format || "").toLowerCase();
    if (fmt === "svg" || fmt === "svg+xml") {
      return await sharp(input, { density: 144 }).png().toBuffer();
    }
    if (fmt === "jpeg" || fmt === "jpg" || fmt === "png") {
      return await sharp(input).rotate().png({ compressionLevel: 9 }).toBuffer();
    }
    return await sharp(input).rotate().png({ compressionLevel: 9 }).toBuffer();
  } catch {
    try {
      return await sharp(input).jpeg({ quality: 88 }).toBuffer();
    } catch {
      return null;
    }
  }
}

function mimeIsPdfKitNative(mime) {
  const m = String(mime || "").toLowerCase();
  return m.includes("png") || m.includes("jpeg") || m.includes("jpg");
}

/**
 * Try Mongo buffer first, then each URL. PNG/JPEG from Mongo → PDFKit embeds directly (no Sharp round-trip).
 * WebP/SVG/AVIF → Sharp → PNG.
 */
async function resolveLogoForPdf({ buffer, urls, mongoContentType }) {
  const tryMongoBuffer = async (b, mimeHint) => {
    if (!Buffer.isBuffer(b) || !b.length) return null;
    if (mimeIsPdfKitNative(mimeHint)) {
      return b;
    }
    const n = await toPdfSafeImageBuffer(b);
    return n || b;
  };

  const tryFetchedBuffer = async (b) => {
    if (!Buffer.isBuffer(b) || !b.length) return null;
    const n = await toPdfSafeImageBuffer(b);
    return n || b;
  };

  const first = await tryMongoBuffer(buffer, mongoContentType);
  if (first) return first;

  const urlList = Array.isArray(urls) ? [...new Set(urls.map((u) => String(u || "").trim()).filter(Boolean))] : [];
  for (const u of urlList) {
    const raw = await fetchUrlBuffer(u);
    const t = await tryFetchedBuffer(raw);
    if (t) return t;
  }
  return null;
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function safeText(s, max = 500) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * @param {object} order
 * @param {{
 *   websiteName?: string,
 *   logoBuffer?: Buffer | null,
 *   logoUrls?: string[],
 *   logoContentType?: string,
 * }} branding
 */
async function buildOrderInvoicePdfBuffer(order, branding = {}) {
  const storeName =
    String(branding.websiteName || process.env.STORE_NAME || "Zippyyy").trim() || "Zippyyy";

  const logoBuf = await resolveLogoForPdf({
    buffer: branding.logoBuffer,
    urls: branding.logoUrls,
    mongoContentType: branding.logoContentType,
  });

  const doc = new PDFDocument({ size: "LETTER", margin: 48, info: { Title: `Invoice ${order.orderNumber || ""}` } });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  const primary = "#0f766e";
  const muted = "#64748b";
  const border = "#e2e8f0";

  doc.save();
  doc.rect(0, 0, doc.page.width, 112).fill("#f8fafc");
  doc.restore();

  let x = 48;
  const topY = 40;
  if (logoBuf) {
    try {
      doc.image(logoBuf, x, topY, { width: 72, height: 72, fit: [72, 72] });
      x += 84;
    } catch {
      /* fall through to text-only header */
    }
  }

  doc.fillColor(primary).fontSize(logoBuf ? 14 : 20).font("Helvetica-Bold").text(storeName, x, topY + (logoBuf ? 10 : 8), {
    width: doc.page.width - x - 48,
  });
  doc.fillColor(muted).fontSize(10).font("Helvetica").text("Sales invoice", x, topY + (logoBuf ? 30 : 34));

  doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold").text("INVOICE", doc.page.width - 140, topY + 12, {
    width: 92,
    align: "right",
  });
  doc.font("Helvetica").fillColor(muted).fontSize(9).text(`Order #${order.orderNumber || order._id}`, doc.page.width - 200, topY + 30, {
    width: 152,
    align: "right",
  });

  const placed = order.createdAt ? new Date(order.createdAt).toLocaleString() : "—";
  doc.text(`Date: ${placed}`, doc.page.width - 200, topY + 44, { width: 152, align: "right" });

  let y = 128;
  const payMethod = String(order.paymentMethod || "—").toUpperCase();
  doc.fillColor(muted).fontSize(9).text(`Payment: ${payMethod}`, 48, y);
  y += 22;

  const addr = order.addressId;
  const user = order.userId;
  const guest = order.guestShipping;
  const custName = safeText(addr?.name || user?.name || guest?.name || "—", 120);
  const custEmail = safeText(order.customerEmail || user?.email || guest?.email || "—", 200);
  const custPhone = safeText(addr?.phone || guest?.phone || user?.phone || "—", 40);
  const line1 = safeText(addr?.fullAddress || guest?.fullAddress || "—", 200);
  const cityLine = [addr?.city || guest?.city, addr?.state || guest?.state, addr?.pincode || guest?.pincode]
    .filter(Boolean)
    .join(", ");

  doc.roundedRect(48, y, doc.page.width - 96, 108, 6).stroke(border);
  doc.fillColor(primary).font("Helvetica-Bold").fontSize(10).text("Bill to", 60, y + 12);
  doc.fillColor("#0f172a").font("Helvetica").fontSize(10);
  doc.text(custName, 60, y + 30);
  doc.fillColor(muted).fontSize(9).text(custEmail, 60, y + 46);
  doc.text(`Phone: ${custPhone}`, 60, y + 62);
  doc.text(line1, 60, y + 78, { width: doc.page.width - 120 });
  if (cityLine) doc.text(cityLine, 60, y + 92, { width: doc.page.width - 120 });

  y += 124;

  doc.fillColor("#f1f5f9").roundedRect(48, y, doc.page.width - 96, 22, 4).fill();
  doc.fillColor(primary).font("Helvetica-Bold").fontSize(9);
  doc.text("Product", 56, y + 7);
  doc.text("Qty", 320, y + 7, { width: 40, align: "right" });
  doc.text("Unit price", 370, y + 7, { width: 70, align: "right" });
  doc.text("Line total", doc.page.width - 120, y + 7, { width: 64, align: "right" });
  y += 28;

  const items = Array.isArray(order.items) ? order.items : [];
  doc.font("Helvetica").fillColor("#0f172a").fontSize(9);

  for (const item of items) {
    const name = safeText(item.product?.name || item.productName || "Product", 80);
    const qty = Number(item.quantity || 0);
    const unit = Number(item.price || 0);
    const line = qty * unit;

    if (y > doc.page.height - 160) {
      doc.addPage();
      y = 48;
    }

    doc.text(name, 56, y, { width: 250 });
    doc.text(String(qty), 320, y, { width: 40, align: "right" });
    doc.text(money(unit), 370, y, { width: 70, align: "right" });
    doc.text(money(line), doc.page.width - 120, y, { width: 64, align: "right" });
    y += 18;
  }

  if (!items.length) {
    doc.fillColor(muted).text("No line items on this order.", 56, y);
    y += 20;
  }

  y += 16;
  doc.moveTo(48, y).lineTo(doc.page.width - 48, y).stroke(border);
  y += 14;

  const subtotal = Number(order.subtotal || 0);
  const tax = Number(order.taxAmount || 0);
  const ship = Number(order.shippingAmount || 0);
  const disc = Number(order.discountAmount || 0);
  const total = Number(order.totalAmount || 0);
  const stripeAmt = Number(order.stripeAmount || 0);
  const otcAmt = Number(order.otcAmount || 0);

  const rightX = doc.page.width - 120;
  const label = (t, v) => {
    doc.fillColor(muted).fontSize(9).text(t, rightX - 160, y, { width: 100, align: "right" });
    doc.fillColor("#0f172a").font("Helvetica-Bold").text(v, rightX, y, { width: 64, align: "right" });
    y += 14;
  };

  doc.font("Helvetica");
  label("Subtotal", money(subtotal));
  doc.font("Helvetica");
  label("Tax & fees", money(tax));
  label("Shipping", money(ship));
  if (disc > 0) label("Discount", `-$${Number(disc).toFixed(2)}`);

  y += 4;
  doc.moveTo(rightX - 170, y).lineTo(doc.page.width - 48, y).stroke(border);
  y += 10;

  doc.font("Helvetica-Bold").fillColor(primary).fontSize(11);
  label("Total due", money(total));

  y += 6;
  doc.font("Helvetica").fillColor(muted).fontSize(9);
  if (stripeAmt > 0 || otcAmt > 0) {
    doc.text(`Paid via card: ${money(stripeAmt)}`, rightX - 170, y, { width: 220, align: "right" });
    y += 12;
    doc.text(`Paid via OTC: ${money(otcAmt)}`, rightX - 170, y, { width: 220, align: "right" });
    y += 12;
  }

  doc.moveTo(48, doc.page.height - 72).lineTo(doc.page.width - 48, doc.page.height - 72).stroke(border);
  doc.fillColor(muted).fontSize(9).font("Helvetica").text(`Thank you for shopping with ${storeName}.`, 48, doc.page.height - 58, {
    align: "center",
    width: doc.page.width - 96,
  });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

module.exports = { buildOrderInvoicePdfBuffer };
