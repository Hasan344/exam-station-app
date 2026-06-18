// frontend/src/components/ExpertScoreInput.jsx
//
// Section 3 — ekspert balı inputu.
// Qaydalar:
//   • Yalnız 0–100 arası TAM ədəd (kəsr hissə YOXDUR)
//   • Scroll (mouse wheel) ilə dəyər dəyişməsi QADAĞANDIR
//   • Boş buraxıla bilər (hələ yazılmayıb deməkdir)
//
// Texniki qeyd: type="number" əvəzinə type="text" + inputMode="numeric"
// istifadə edirik — bu, wheel/spinner davranışını və "e", ".", ","
// simvollarını kökündən aradan qaldırır. Sanitizasiya onChange-də olur.

export default function ExpertScoreInput({
  value,            // string ("" | "0".."100")
  onChange,         // (newValue: string) => void
  disabled = false,
  placeholder = "0–100",
  inputRef = null,
  onEnter = null,   // Enter basılanda çağırılır (məs. saxla / növbəti input)
}) {
  const sanitize = (raw) => {
    // Yalnız rəqəmlər; aparıcı sıfırlar normallaşdırılır; 100-dən böyük kəsilir
    const digits = String(raw).replace(/[^0-9]/g, "").slice(0, 3);
    if (digits === "") return "";
    const n = Number(digits);
    if (n > 100) return "100";
    return String(n);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter?.();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className="field text-center text-lg font-semibold tabular-nums"
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={3}
      onChange={(e) => onChange(sanitize(e.target.value))}
      onKeyDown={handleKeyDown}
      onWheel={(e) => e.currentTarget.blur()}  // əlavə sığorta — text inputda onsuz da scroll təsiri yoxdur
      onPaste={(e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData("text");
        onChange(sanitize(text));
      }}
    />
  );
}
