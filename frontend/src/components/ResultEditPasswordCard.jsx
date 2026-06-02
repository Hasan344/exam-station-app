// src/components/ResultEditPasswordCard.jsx
//
// Nəticə "redaktə parolu"nu təyin etmək / dəyişmək üçün kart.
// AdminPage-də istənilən tab-a əlavə edilə bilər, məs.:
//
//   import ResultEditPasswordCard from "../components/ResultEditPasswordCard.jsx";
//   ...
//   <ResultEditPasswordCard />
//
// Bu parol stansiyada kilidli nəticələri dəyişmək üçün tələb olunur.
// Bazada app_settings.result_edit_password açarı altında bcrypt hash kimi saxlanılır.

import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { Card } from "./ui/Primitives.jsx";

export default function ResultEditPasswordCard() {
  const toast = useToast();
  const [isSet, setIsSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try {
      const s = await api.get("/results/edit-password/status");
      setIsSet(!!s.isSet);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const submit = async () => {
    if (next.length < 4) return toast.warn("Yeni parol ən azı 4 simvol olmalıdır");
    if (next !== confirm) return toast.warn("Parollar uyğun gəlmir");
    if (isSet && !current) return toast.warn("Cari redaktə parolunu daxil edin");

    setBusy(true);
    try {
      await api.post("/results/edit-password", {
        newPassword: next,
        currentPassword: isSet ? current : undefined,
      });
      toast.success(isSet ? "Redaktə parolu yeniləndi" : "Redaktə parolu təyin edildi");
      setCurrent(""); setNext(""); setConfirm("");
      setIsSet(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Nəticə redaktə parolu"
      subtitle={loading
        ? "Yoxlanılır..."
        : isSet
          ? "Parol təyin olunub. Kilidli nəticələri dəyişmək üçün istifadə olunur."
          : "Hələ təyin olunmayıb. Kilidli nəticələri dəyişmək üçün bir parol təyin edin."}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl">
        {isSet && (
          <div className="md:col-span-3">
            <label className="label">Cari redaktə parolu</label>
            <input type="password" className="field" value={current}
                   onChange={(e) => setCurrent(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label">Yeni parol</label>
          <input type="password" className="field" value={next}
                 onChange={(e) => setNext(e.target.value)} />
        </div>
        <div>
          <label className="label">Yeni parol (təkrar)</label>
          <input type="password" className="field" value={confirm}
                 onChange={(e) => setConfirm(e.target.value)} />
        </div>
      </div>
      <button className="btn-primary mt-4" onClick={submit} disabled={busy || loading}>
        {busy ? "Yadda saxlanılır..." : isSet ? "Parolu dəyiş" : "Parolu təyin et"}
      </button>
    </Card>
  );
}
