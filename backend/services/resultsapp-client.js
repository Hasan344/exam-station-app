// backend/services/resultsapp-client.js
//
// ResultsApp API-si ilə danışmaq üçün köməkçilər.
// Node 18+ daxili `fetch` istifadə edir.

const DEFAULT_BASE_URL = "http://localhost:5000/api";

/**
 * ResultsApp baza URL-i:
 *   1) Environment dəyişəni RESULTSAPP_BASE_URL
 *   2) Parametr (UI-dan göndərilirsə)
 *   3) Default localhost:5000
 */
function resolveBaseUrl(explicit) {
  return (
    explicit ||
    process.env.RESULTSAPP_BASE_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
}

/**
 * Snapshot-i çək. Filter parametrləri istəyə bağlıdır.
 *   filters: { examId, sectionId, from, to, commissionNo, baseUrl }
 */
async function fetchSnapshot(filters = {}) {
  const baseUrl = resolveBaseUrl(filters.baseUrl);
  const params = new URLSearchParams();
  if (filters.examId)       params.set("examId", filters.examId);
  if (filters.sectionId)    params.set("sectionId", filters.sectionId);
  if (filters.from)         params.set("from", filters.from);
  if (filters.to)           params.set("to", filters.to);
  if (filters.commissionNo) params.set("commissionNo", filters.commissionNo);

  const qs = params.toString();
  const url = `${baseUrl}/export/snapshot${qs ? `?${qs}` : ""}`;

  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    const e = new Error(`ResultsApp-a qoşulmaq alınmadı: ${err.message}`);
    e.status = 503;
    throw e;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const e = new Error(
      `ResultsApp HTTP ${res.status}: ${body.slice(0, 200) || res.statusText}`
    );
    e.status = 502;
    throw e;
  }

  return await res.json();
}

module.exports = { fetchSnapshot, resolveBaseUrl };
