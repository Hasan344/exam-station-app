// src/components/ExerciseInput.jsx
//
// Bir hərəkət üçün böyük input + imtina toggle + qeyd + AYRI SAXLA düyməsi.
// Rejimlər: Nəticə (yaşıl) / Apellyasiya (narıncı).
//
// min_sec vahidi:
//   • input type="text" olur (number "2.24"-ü onluq sayır, biz mm.ss istəyirik)
//   • operator "2.24" yazır → altında canlı "= 2:24" göstərilir
//   • valideyn komponent saxlayanda parseMinSec ilə saniyəyə çevirir

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
}) {
  const inputRef = useRef(null);
  const readOnly = locked && !unlocked;
  const isMinSec = exercise.unit === "min_sec";

  useEffect(() => {
    if (autoFocus && !readOnly) setTimeout(() => inputRef.current?.focus(), 50);
  }, [autoFocus, readOnly]);

  const handleKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (!readOnly) onSave?.(); }
  };

  const directionLabel = exercise.direction === 1 ? "az = yaxşı" : "çox = yaxşı";
  const inputDisabled = readOnly || isRefused;

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
            <span>·</span>
            <span>{directionLabel}</span>
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
          ${readOnly ? "opacity-50 pointer-events-none" : ""}
          ${isRefused
            ? "bg-rust-500 text-paper border-rust-600"
            : "bg-paper text-ink-700 border-ink-200 hover:border-rust-400"}
        `}>
          <input
            type="checkbox"
            checked={isRefused}
            disabled={readOnly}
            onChange={(e) => onRefuseChange(e.target.checked)}
            className="sr-only"
          />
          {isRefused ? "İmtina" : "İmtina deyil"}
        </label>
      </div>

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
              step={isMinSec ? undefined : "0.01"}
              inputMode="decimal"
              disabled={inputDisabled}
              value={isRefused ? "" : (value ?? "")}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKey}
              placeholder={unitPlaceholder(exercise.unit)}
              className={`huge-input field flex-1 disabled:bg-ink-100 disabled:text-ink-400 ${minSecInvalid ? "border-rust-500 focus:ring-rust-300" : ""}`}
            />
            <span className="text-ink-500 font-medium text-lg min-w-[60px]">
              {unitShort(exercise.unit)}
            </span>
          </div>

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
          <button type="button" className={saveBtnCls} onClick={() => onSave?.()} disabled={saving}>
            {saving ? "Saxlanılır..." : saved ? "Yenilə" : "Saxla"}
          </button>
        )}
      </div>
    </div>
  );
}
