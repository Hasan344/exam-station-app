// src/components/ExerciseInput.jsx
//
// Bir hərəkət üçün böyük input + imtina toggle + qeyd + AYRI SAXLA düyməsi.
// Rejimlər: Nəticə (yaşıl) / Apellyasiya (narıncı).
//
// Apellyasiya rejimində əlavə "Dəyişdi / Dəyişmədi" seçimi:
//   • Dəyişmədi → input bağlıdır, köhnə (əsas) nəticə apellyasiya kimi saxlanılır.
//   • Dəyişdi   → input açılır, valideyn komponent saxlamadan əvvəl admin parolu istəyir.
//
// min_sec vahidi:
//   • input type="text" olur (number "2.24"-ü onluq sayır, biz mm.ss istəyirik)
//   • operator "2.24" yazır → altında canlı "= 2:24" göstərilir
//   • valideyn komponent saxlayanda parseMinSec ilə saniyəyə çevirir
//
// score vahidi:
//   • yalnız TAM ədəd (kəsr hissə yoxdur) — step="1", "." "," "e" simvolları bloklanır.
//
// Bütün number inputlar:
//   • mouse təkəri ilə fokuslandıqda dəyər təsadüfən dəyişməsin deyə wheel bloklanır.

import { useEffect, useRef } from "react";
import { unitShort, unitPlaceholder, parseMinSec, secondsToMinSec } from "../lib/format.js";

export default function ExerciseInput({
  exercise,
  index,
  total,
  value,                 // min_sec üçün operatorun gördüyü mətn ("2.24"); digər vahidlər üçün rəqəm
  isRefused,
  notes,
  onChange,
  onRefuseChange,
  onNotesChange,
  onSave,
  onRequestEdit,
  saved,
  locked,
  unlocked,
  saving,
  autoFocus,
  appeal = false,
  referenceText = null,
  appealDecision = null,            // null | "unchanged" | "changed"
  onAppealDecisionChange,
}) {
  const inputRef = useRef(null);
  const readOnly = locked && !unlocked;
  const isMinSec = exercise.unit === "min_sec";
  const isScore  = exercise.unit === "score";   // yalnız tam ədəd

  useEffect(() => {
    if (autoFocus && !readOnly) setTimeout(() => inputRef.current?.focus(), 50);
  }, [autoFocus, readOnly]);

  // Mouse təkəri ilə number input-un dəyərini dəyişməsini blokla.
  // React-in onWheel-ı passiv listener kimi qeydiyyatdan keçir → preventDefault işləmir,
  // ona görə native listener-i { passive: false } ilə qoşuruq. Fokus itmir.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const stopWheel = (e) => {
      if (document.activeElement === el) e.preventDefault();
    };
    el.addEventListener("wheel", stopWheel, { passive: false });
    return () => el.removeEventListener("wheel", stopWheel);
  }, []);

  const handleKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!readOnly && !saveDisabled) onSave?.();
      return;
    }
    // score: yalnız tam ədəd — onluq ayırıcı və elmi format simvollarını blokla
    if (isScore && ["e", "E", "+", "-", ".", ","].includes(e.key)) {
      e.preventDefault();
    }
  };

  // score üçün yapışdırma/daxiletmədə rəqəm olmayan simvolları at
  const handleChange = (raw) => {
    if (isScore) raw = raw.replace(/[^\d]/g, "");
    onChange(raw);
  };


  // Apellyasiyada dəyər/imtina yalnız "Dəyişdi" seçimində aktivdir.
  const appealLocksInputs = appeal && appealDecision !== "changed";
  const refuseDisabled = readOnly || appealLocksInputs;
  const inputDisabled  = readOnly || isRefused || appealLocksInputs;
  const saveDisabled   = saving || (appeal && !appealDecision);

  // min_sec canlı önizləmə / xəta
  const minSecParsed = isMinSec && !isRefused && value !== "" && value != null
    ? parseMinSec(value)
    : null;
  const minSecInvalid = isMinSec && !isRefused && value !== "" && value != null && minSecParsed === null;

  const lockBadgeCls = appeal
    ? "bg-orange-100 text-orange-700 border-orange-300"
    : "bg-moss-400/20 text-moss-700 border-moss-400/40";
  const saveBtnCls = appeal
    ? "btn bg-orange-500 text-paper hover:bg-orange-600 px-6"
    : "btn-primary px-6";
  const cardAccent = appeal
    ? (readOnly ? "bg-orange-50 border-orange-200" : "border-orange-200")
    : (readOnly ? "bg-ink-100/60 border-ink-300" : "");

  return (
    <div className={`card p-5 transition-colors ${cardAccent} ${isRefused && !readOnly && !appeal ? "bg-rust-400/5 border-rust-400/30" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-500 uppercase tracking-wider">
            <span>{index + 1}/{total}</span>
            <span>·</span>
            <span>{exercise.code}</span>
          </div>
          <h3 className="font-display text-xl text-ink-900 mt-1 flex items-center gap-2">
            {exercise.name}
            {appeal && (
              <span className="text-xs font-sans px-2 py-0.5 rounded-soft bg-orange-100 text-orange-700 border border-orange-300">
                Apellyasiya
              </span>
            )}
            {locked && (
              <span className={`text-xs font-sans px-2 py-0.5 rounded-soft border ${lockBadgeCls}`}>
                {readOnly ? "🔒 Kilidli" : "🔓 Açıq"}
              </span>
            )}
          </h3>
        </div>

        <label className={`
          flex items-center gap-2 px-3 py-1.5 rounded-soft cursor-pointer
          text-sm border transition-colors select-none
          ${refuseDisabled ? "opacity-50 pointer-events-none" : ""}
          ${isRefused
            ? "bg-rust-500 text-paper border-rust-600"
            : "bg-paper text-ink-700 border-ink-200 hover:border-rust-400"}
        `}>
          <input
            type="checkbox"
            checked={isRefused}
            disabled={refuseDisabled}
            onChange={(e) => onRefuseChange(e.target.checked)}
            className="sr-only"
          />
          {isRefused ? "İmtina" : "İmtina deyil"}
        </label>
      </div>

      {/* Apellyasiya: Dəyişdi / Dəyişmədi seçimi */}
      {appeal && !readOnly && (
        <div className="mb-3 inline-flex rounded-soft border border-orange-300 overflow-hidden">
          <button
            type="button"
            onClick={() => onAppealDecisionChange?.("unchanged")}
            className={`px-4 py-2 text-sm transition-colors ${
              appealDecision === "unchanged"
                ? "bg-orange-500 text-paper"
                : "bg-paper text-ink-600 hover:bg-orange-50"
            }`}
          >
            Dəyişmədi
          </button>
          <button
            type="button"
            onClick={() => onAppealDecisionChange?.("changed")}
            className={`px-4 py-2 text-sm border-l border-orange-300 transition-colors ${
              appealDecision === "changed"
                ? "bg-orange-500 text-paper"
                : "bg-paper text-ink-600 hover:bg-orange-50"
            }`}
          >
            Dəyişdi
          </button>
        </div>
      )}

      {appeal && referenceText != null && (
        <div className="mb-3 text-sm text-ink-500">
          Əsas nəticə: <span className="font-mono text-ink-700">{referenceText}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="label">
            {appeal ? "Apellyasiya dəyəri" : "Dəyər"}
            {isMinSec && <span className="ml-2 normal-case tracking-normal text-ink-400">(dəqiqə.saniyə — məs. 2.24)</span>}
          </label>
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type={isMinSec ? "text" : "number"}
              step={isMinSec ? undefined : isScore ? "1" : "0.01"}
              inputMode={isScore ? "numeric" : "decimal"}
              disabled={inputDisabled}
              value={isRefused ? "" : (value ?? "")}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKey}
              placeholder={unitPlaceholder(exercise.unit)}
              className={`huge-input field flex-1 disabled:bg-ink-100 disabled:text-ink-400 ${minSecInvalid ? "border-rust-500 focus:ring-rust-300" : ""}`}
            />
            <span className="text-ink-500 font-medium text-lg min-w-[60px]">
              {unitShort(exercise.unit)}
            </span>
          </div>

          {/* Apellyasiya seçim ipuçları */}
          {appeal && appealDecision === "unchanged" && (
            <div className="text-xs text-ink-500 mt-1">
              Nəticə dəyişmir — köhnə nəticə (<span className="font-mono text-ink-700">{referenceText}</span>) apellyasiya kimi saxlanılacaq.
            </div>
          )}
          {appeal && appealDecision === "changed" && (
            <div className="text-xs text-orange-600 mt-1">
              Yeni dəyər admin parolu ilə qeyd ediləcək.
            </div>
          )}
          {appeal && !appealDecision && (
            <div className="text-xs text-ink-400 mt-1">
              Saxlamaq üçün əvvəlcə «Dəyişdi» və ya «Dəyişmədi» seçin.
            </div>
          )}

          {/* min_sec canlı önizləmə / xəta */}
          {isMinSec && !isRefused && (
            minSecInvalid ? (
              <div className="text-xs text-rust-600 mt-1">
                Format yanlışdır. Düzgün: dəqiqə.saniyə (saniyə 0–59), məs. 2.24
              </div>
            ) : minSecParsed != null ? (
              <div className="text-xs text-ink-500 mt-1">
                = <span className="font-mono text-ink-700">{secondsToMinSec(minSecParsed)}</span>
                <span className="text-ink-400"> ({minSecParsed} san)</span>
              </div>
            ) : null
          )}
        </div>

        <div>
          <label className="label">Qeyd (ixtiyari)</label>
          <textarea
            rows={3}
            disabled={readOnly}
            value={notes ?? ""}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={appeal ? "apellyasiya səbəbi..." : "məs. külək, yağış..."}
            className="field resize-none disabled:bg-ink-100 disabled:text-ink-400"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {readOnly ? (
          <>
            <span className="text-sm text-ink-500">
              {appeal ? "Bu apellyasiya kilidlidir." : "Bu nəticə kilidlidir."}
            </span>
            <button type="button" className="btn-ghost" onClick={() => onRequestEdit?.()}>
              Redaktə et
            </button>
          </>
        ) : (
          <button type="button" className={saveBtnCls} onClick={() => onSave?.()} disabled={saveDisabled}>
            {saving ? "Saxlanılır..." : saved ? "Yenilə" : "Saxla"}
          </button>
        )}
      </div>
    </div>
  );
}