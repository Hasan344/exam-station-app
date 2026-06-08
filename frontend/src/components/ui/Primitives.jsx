// src/components/ui/Primitives.jsx
//
// Kiçik UI primitivləri — yığcam tək faylda saxlayırıq.

export function PageHeader({ title, subtitle, right }) {
  // Birbaşa gradient fon üzərində render olunur → ağ mətn
  return (
    <div className="flex items-end justify-between mb-6 pb-4 border-b border-white/20">
      <div>
        <h1 className="font-display text-3xl text-white leading-tight drop-shadow-sm">{title}</h1>
        {subtitle && <p className="text-sm text-white/70 mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ title, subtitle, children, footer, className = "" }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      {(title || subtitle) && (
        <div className="px-5 py-4 border-b border-ink-200/70 bg-white/40">
          {title    && <h2 className="font-display text-lg text-ink-800">{title}</h2>}
          {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-ink-200/70 bg-white/40">{footer}</div>
      )}
    </div>
  );
}

export function EmptyState({ icon = "∅", title, hint }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="font-display text-5xl text-ink-200 mb-3">{icon}</div>
      <div className="font-medium text-ink-700">{title}</div>
      {hint && <div className="text-sm text-ink-500 mt-1">{hint}</div>}
    </div>
  );
}

export function Spinner({ label = "Yüklənir..." }) {
  return (
    <div className="flex items-center gap-3 text-sm text-white/80 py-8 justify-center">
      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function Chip({ children, onClick, active = false, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-soft text-sm
        border transition-colors
        ${active
          ? "bg-moss-500 text-paper border-moss-600"
          : "bg-paper text-ink-700 border-ink-200 hover:border-moss-300 hover:bg-moss-50"}
        ${className}
      `}
    >{children}</button>
  );
}

export function FieldRow({ label, children, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Toolbar({ children }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white/70 backdrop-blur-sm border border-white/60 rounded-soft">
      {children}
    </div>
  );
}