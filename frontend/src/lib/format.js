// src/lib/format.js
// Format və göstərmə köməkçiləri.

export const UNIT_LABELS = {
  second: "saniyə",
  cm:     "sm",
  count:  "dəfə",
  score:  "bal",
};

export function unitLabel(unit) {
  return UNIT_LABELS[unit] || unit || "";
}

export function unitShort(unit) {
  switch (unit) {
    case "second": return "sn";
    case "cm":     return "sm";
    case "count":  return "dəfə";
    case "score":  return "bal";
    default:       return unit || "";
  }
}

export function unitPlaceholder(unit) {
  switch (unit) {
    case "second": return "məs. 12.35";
    case "cm":     return "məs. 220";
    case "count":  return "məs. 15";
    case "score":  return "məs. 8";
    default:       return "dəyər";
  }
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
  if (unit === "second") return `${n.toFixed(2)} sn`;
  if (unit === "cm")     return `${n} sm`;
  if (unit === "count")  return `${n} dəfə`;
  if (unit === "score")  return `${n} bal`;
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
