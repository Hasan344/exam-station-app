// backend/services/excel-helpers.js
//
// Excel/CSV faylları üçün ortaq köməkçilər.

const XLSX = require("xlsx");

/** Buffer → obyekt massivi (ilk vərəq) */
function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) throw new Error("Faylda iş vərəqi tapılmadı");
  const ws = wb.Sheets[firstSheet];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
}

/** Sütun adını case-insensitive və trim-li axtar */
function pickField(row, ...candidates) {
  const lookup = {};
  for (const k of Object.keys(row)) {
    lookup[String(k).trim().toLowerCase()] = k;
  }
  for (const c of candidates) {
    const key = lookup[String(c).trim().toLowerCase()];
    if (key !== undefined) {
      const val = row[key];
      if (val === null || val === undefined) return "";
      return String(val).trim();
    }
  }
  return "";
}

/** Tarixi YYYY-MM-DD formatına çevir */
function normalizeDate(raw) {
  if (!raw) return "";
  if (raw instanceof Date && !isNaN(raw)) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed)) {
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return s;
}

/** Sıralı Promise icrası, hər sətirdə xəta yığılır */
async function runSerial(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    try {
      results.push({ index: i, ok: true, data: await fn(items[i], i) });
    } catch (err) {
      results.push({
        index: i,
        ok: false,
        error: err?.message || String(err),
      });
    }
  }
  return results;
}

/** Standart cavab formatı */
function summarize(results, entityName = "qeyd") {
  const inserted = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  return {
    message: `${inserted} ${entityName} əlavə edildi${failed.length ? `, ${failed.length} xəta` : ""}`,
    inserted,
    failed: failed.length,
    errors: failed.map(f => `Sətir ${f.index + 2}: ${f.error}`),
  };
}

module.exports = { parseWorkbook, pickField, normalizeDate, runSerial, summarize };
