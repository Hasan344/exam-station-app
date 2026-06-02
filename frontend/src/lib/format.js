// src/lib/format.js
// Format və göstərmə köməkçiləri.
//
// Vahidlər:
//   second  → saniyə (onluq, məs. 12.35 sn) — qısa qaçışlar
//   min_sec → dəqiqə:saniyə (operator "2.24" yazır = 2 dəq 24 san) — 400m və yuxarı
//             ⚠ DB-də HƏMİŞƏ saniyə kimi saxlanılır (məs. 144). Yalnız giriş/göstərim
//               dəqiqə.saniyə formatındadır.
//   cm      → santimetr
//   count   → dəfə
//   score   → bal

export const UNIT_LABELS = {
  second:  "saniyə",
  min_sec: "dəqiqə:saniyə",
  cm:      "sm",
  count:   "dəfə",
  score:   "bal",
};

export function unitLabel(unit) {
  return UNIT_LABELS[unit] || unit || "";
}

export function unitShort(unit) {
  switch (unit) {
    case "second":  return "sn";
    case "min_sec": return "dəq:san";
    case "cm":      return "sm";
    case "count":   return "dəfə";
    case "score":   return "bal";
    default:        return unit || "";
  }
}

export function unitPlaceholder(unit) {
  switch (unit) {
    case "second":  return "məs. 12.35";
    case "min_sec": return "məs. 2.24 (2 dəq 24 san)";
    case "cm":      return "məs. 220";
    case "count":   return "məs. 15";
    case "score":   return "məs. 8";
    default:        return "dəyər";
  }
}

// ───────── min_sec çevirmələri ─────────
//
// parseMinSec("2.24")  → 144   (2*60 + 24)
// parseMinSec("2.05")  → 125
// parseMinSec("2")     → 120
// parseMinSec("0.45")  → 45
// parseMinSec(95)      → 95    (artıq saniyədirsə olduğu kimi)
// Yanlış format (san ≥ 60) → null

export function parseMinSec(input) {
  if (input === null || input === undefined || input === "") return null;
  const str = String(input).trim().replace(",", ".");   // "2,24" da qəbul olunur
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return null;

  const [minPart, secPartRaw] = str.split(".");
  const minutes = Number(minPart);
  // ".5" → 50 san DEYİL, "05" → 5 san. Operator iki rəqəm yazır: ".5" = 50 san sayılır.
  // Daha təhlükəsiz: saniyəni mətndən 2 rəqəmə tamamla (".2" → "20", ".24" → "24").
  let seconds = 0;
  if (secPartRaw !== undefined) {
    seconds = Number(secPartRaw.padEnd(2, "0"));
  }
  if (seconds >= 60) return null;       // mm.ss formatında san 0–59 olmalıdır
  return minutes * 60 + seconds;
}

// secondsToMinSec(144)  → "2:24"
// secondsToMinSec(125)  → "2:05"
// secondsToMinSec(45)   → "0:45"
export function secondsToMinSec(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds === "") return "";
  const n = Number(totalSeconds);
  if (Number.isNaN(n)) return "";
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Operator inputu üçün: saniyə → "m.ss" (input sahəsində göstərmək üçün)
// 144 → "2.24"
export function secondsToMinSecInput(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds === "") return "";
  const n = Number(totalSeconds);
  if (Number.isNaN(n)) return "";
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}.${String(s).padStart(2, "0")}`;
}

export function fullName(student) {
  if (!student) return "";
  return [student.surname, student.name, student.father_name].filter(Boolean).join(" ");
}

export function genderLabel(g) {
  if (g === 1) return "Kişi";
  if (g === 2) return "Qadın";
  return "—";
}

export function formatRaw(value, unit) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  if (unit === "second")  return `${n.toFixed(2)} sn`;
  if (unit === "min_sec") return secondsToMinSec(n);     // 144 → "2:24"
  if (unit === "cm")      return `${n} sm`;
  if (unit === "count")   return `${n} dəfə`;
  if (unit === "score")   return `${n} bal`;
  return String(n);
}

export function formatDate(s) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("az-AZ");
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildQuery(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") qs.set(k, v);
  }
  return qs.toString() ? "?" + qs.toString() : "";
}
