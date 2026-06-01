// src/components/ExerciseInput.jsx
//
// Bir hərəkət üçün böyük input + imtina toggle + qeydlər.
// Stansiyada operator hər tələbə üçün bu komponentlərdən birini istifadə edir.

import { useEffect, useRef } from "react";
import { unitShort, unitPlaceholder } from "../lib/format.js";

export default function ExerciseInput({
  exercise,
  index,
  total,
  value,
  isRefused,
  notes,
  onChange,
  onRefuseChange,
  onNotesChange,
  onEnterNext,        // istifadəçi Enter basanda sonrakı input-a keçmək üçün
  autoFocus,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) {
      // Kiçik gecikmə ki, fokus düzgün otursun
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [autoFocus]);

  const handleKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnterNext?.();
    }
  };

  const directionLabel = exercise.direction === 1 ? "az = yaxşı" : "çox = yaxşı";

  return (
    <div className={`
      card p-5 transition-colors
      ${isRefused ? "bg-rust-400/5 border-rust-400/30" : ""}
    `}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-500 uppercase tracking-wider">
            <span>{index + 1}/{total}</span>
            <span>·</span>
            <span>{exercise.code}</span>
            <span>·</span>
            <span>{directionLabel}</span>
          </div>
          <h3 className="font-display text-xl text-ink-900 mt-1">{exercise.name}</h3>
        </div>
        <label className={`
          flex items-center gap-2 px-3 py-1.5 rounded-soft cursor-pointer
          text-sm border transition-colors select-none
          ${isRefused
            ? "bg-rust-500 text-paper border-rust-600"
            : "bg-paper text-ink-700 border-ink-200 hover:border-rust-400"}
        `}>
          <input
            type="checkbox"
            checked={isRefused}
            onChange={(e) => onRefuseChange(e.target.checked)}
            className="sr-only"
          />
          {isRefused ? "İmtina" : "İmtina deyil"}
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="label">Dəyər</label>
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="number"
              step="0.01"
              inputMode="decimal"
              disabled={isRefused}
              value={isRefused ? "" : (value ?? "")}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKey}
              placeholder={unitPlaceholder(exercise.unit)}
              className="huge-input field flex-1 disabled:bg-ink-100 disabled:text-ink-300"
            />
            <span className="text-ink-500 font-medium text-lg min-w-[60px]">
              {unitShort(exercise.unit)}
            </span>
          </div>
        </div>

        <div>
          <label className="label">Qeyd (ixtiyari)</label>
          <textarea
            rows={3}
            value={notes ?? ""}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="məs. külək, yağış, texniki problem..."
            className="field resize-none"
          />
        </div>
      </div>
    </div>
  );
}
