# Exam Station — Stansiya nəticə yığım sistemi

Oflayn işləyən Electron desktop tətbiqi. İmtahan stansiyalarında bir komissiyaya
aid bütün hərəkətlərin xam nəticələrini (raw value) yığır və əsas (mərkəzi) bal
hesablama sisteminə yükləmək üçün xlsx/json/csv formatlarında ixrac edir.

**Mühüm:** Bu alt-layihə **bal hesablamır**. Yalnız raw value toplayır.
Bal hesablama əsas layihənin scoring qaydaları ilə aparılır.

---

## Memarlıq

```
┌────────────────────────────────────────────────┐
│            Electron (main process)              │
│  ┌───────────────────────┐  ┌────────────────┐ │
│  │  Express backend       │  │  React UI      │ │
│  │  (child process)       │←→│  (Vite build)  │ │
│  │   :5000                │  │                │ │
│  └────────┬──────────────┘  └────────────────┘ │
│           │                                     │
│    ┌──────┴───────┐                             │
│    │  SQLite DB   │  (userData/database.db)     │
│    └──────────────┘                             │
└────────────────────────────────────────────────┘
```

**Stack:**
- Electron 33 (paketləmə)
- Express 4 + sqlite3 + bcryptjs (backend, child process kimi fork olunur)
- React 18 + Vite 5 + Tailwind 3 (frontend, dev-də HMR, prod-da static)
- xlsx (Excel idxal/ixrac)

---

## Verilənlər bazası sxeması

```
sections (1) ────< commissions (N) ────< commission_exercises (N) >──── exercises (1)
                          │                                                      │
                          ↓                                                      │
                       students ────< student_exam_results >──────────────────────┘
                          ↑
                        exams ────< exam_commissions >──── commissions
```

**Mühüm cədvəllər:**
- `commission_exercises` — hansı hərəkət hansı komissiyada keçirilir
  (stansiya operatoru yalnız bu siyahıdan seçə bilər)
- `exam_commissions` — hansı komissiya hansı imtahanda iştirak edir
  (SetupPage Step 3-də yalnız bu pivot oxunur)
- `student_exam_results` — UNIQUE(student_id, exercise_id) ilə UPSERT mantiqi
- `students.photo_path` — şəkil yolu (ixtiyari; əslində backend faylı
  birbaşa `backend/photos/{exam_id}/{is_n}.jpg`-dən serve edir)

Tam sxema: `backend/migrations/001_initial.sql` + `002_*.sql`

---

## İlk dəfə qurmaq (development)

### Tələblər
- Node.js 18+ (16+ də işləyə bilər)
- npm 9+
- Windows / macOS / Linux

### Quraşdırma

```bash
# 1) Kök paketlər (Electron + electron-builder)
npm install

# 2) Backend paketləri
cd backend
npm install
cd ..

# 3) Frontend paketləri
cd frontend
npm install
cd ..

# 4) DB sxemasını qur və ilkin data yarat
npm run migrate
npm run seed
# (admin/admin123 yaradılır + 3 bölmə + 6 hərəkət + 2 demo komissiya)

# 5) sqlite3 native binary-ni Electron versiyasına uyğunlaşdır
npm run rebuild:sqlite
```

### Dev rejimdə işlət

Üç prosesi paralel başladır (backend + Vite + Electron):

```bash
npm run dev
```

Backend `http://localhost:5000`, frontend `http://localhost:5173`, və Electron pəncərəsi
açılır. Vite HMR aktivdir — `frontend/src/` dəyişiklikləri canlı təzələnir.

Yalnız brauzerdə test üçün:
```bash
npm run dev:backend     # tab 1
npm run dev:frontend    # tab 2 — http://localhost:5173 brauzerdə
```

---

## İstifadə axını

1. **Daxil ol** — default: `admin` / `admin123` (admin panelindən dərhal dəyiş!)
2. **Quraşdırma** — 4 mərhələ:
   1. Bölmə seç
   2. İmtahan seç
   3. Komissiya seç
   4. Bu stansiyada keçiriləcək hərəkətləri multi-select et
      (yalnız bu komissiyaya icazə verilən hərəkətlər siyahıda görünür)
3. **Stansiya səhifəsi** — operator sıra № daxil edir → Enter →
   tələbə tapılır → bütün seçilmiş hərəkətlər üçün dəyər daxil olunur →
   "Hamısını saxla" → avtomatik növbəti sıra №-yə keçir
4. **Nəticələr** — komissiya × hərəkət matrisi (axtarış + filter)
5. **Admin** — Excel idxalı / İmtahan CRUD / Eksport / Parol dəyişmə

---

## Excel idxal formatları

Hər idxal endpointi multipart/form-data ilə `file` sahəsində Excel/CSV gözləyir.
Sütun adları **case-insensitive**-dir.

### 1) Bölmələr (`/imports/sections`)
| id | name | sect_code |
|----|------|-----------|
| 1  | Bölmə 1 — Bədən tərbiyəsi | BT |

### 2) Hərəkətlər (`/imports/exercises`)
| code | name | unit | direction | display_order | notes |
|------|------|------|-----------|---------------|-------|
| sprint_100m | 100 metr qaçış | second | 1 | 1 | |
| long_jump | Uzunluğa tullanma | cm | 2 | 3 | |

- `unit`: `second`, `cm`, `count`, `score`
- `direction`: `1` = az = yaxşı (məs. qaçış), `2` = çox = yaxşı (məs. tullanma)

### 3) Komissiyalar (`/imports/commissions`)
| commission_no | name | section_id |
|---------------|------|-----------|
| 62 | Komissiya 62 | 1 |

### 4) Komissiya ↔ Hərəkət (`/imports/commission-exercises`)
| commission_no | exercise_code | display_order |
|---------------|---------------|---------------|
| 62 | sprint_100m | 1 |
| 62 | long_jump   | 2 |

### 5) İmtahanlar (`/imports/exams`)
| name | exam_date | section_id | notes | commission_nos |
|------|-----------|-----------|-------|----------------|
| Yay 2025 | 2025-06-15 | 1 | | 62,63,6401 |

- `commission_nos` (ixtiyari) — vergüllə/boşluqla ayrılmış komissiya nömrələri.
  Doludursa, imtahan yarananda `exam_commissions` pivot cədvəlinə avtomatik
  bağlantı yazılır.

### 5b) İmtahan ↔ Komissiya (`/imports/exam-commissions`)
Komissiyaları imtahana ayrıca bağlamaq lazım olsa:

| exam_id | commission_no |
|---------|---------------|
| 1 | 62 |
| 1 | 63 |
| 1 | 6401 |

### 6) Tələbələr (`/imports/students`)
| exam_id | s_nomer | is_n | surname | name | father_name | birth_date | gender | qrup_num | kodixtisas | ixtisas_name | alt_nov | commission_no |

- `gender`: `1` = kişi, `2` = qadın
- `birth_date`: `YYYY-MM-DD` (digər formatlar da qəbul olunur)
- Tələbə idxalı zamanı tələbənin `commission_no`-su həmin imtahana hələ
  təyin olunmayıbsa, **avtomatik** `exam_commissions`-a yazılır.
  Yəni `commission_nos` sütununu unutsanız belə, students idxalından sonra
  komissiyalar yerli-yerinə oturur.

---

## Tələbə şəkilləri

Şəkillər DB-də saxlanılmır — fayl sistemində qalır. Backend bunları birbaşa
disk-dən oxuyur və `GET /students/:id/photo` endpoint-i ilə serve edir.

**Yer (dev rejimdə):**
```
backend/photos/
  {exam_id}/
    {is_n}.jpg      ← məs. backend/photos/1/ABT12345.jpg
    {is_n}.png
```

**Yer (production / .exe quraşdırıldıqdan sonra):**
```
%APPDATA%\ExamStation\photos\{exam_id}\{is_n}.jpg     (Windows)
~/Library/Application Support/ExamStation/photos/...  (macOS)
~/.config/ExamStation/photos/...                      (Linux)
```

**Alternativ struktur** — `exam_id` qovluğu olmadan:
```
backend/photos/{is_n}.jpg
```
Backend əvvəl exam-id-li yolu axtarır, tapmazsa flat yola baxır.

**Necə qoymalı:** Stansiya kompüterinə şəkilləri əvvəlcədən kopyalayın. Şəkil
yoxdursa stansiya səhifəsində "Şəkil yoxdur" göstərilir — bal yığımı dayanmır.

Şəkillər **stansiyada operator tərəfindən tələbə açılanda dərhal görünür**
(kimliyi təsdiq etmək üçün). Nəticələr səhifəsində foto göstərilmir.

---

## Production build (.exe yaratmaq)

```bash
# Windows üçün (NSIS installer + Portable .exe)
npm run dist:win

# macOS
npm run dist:mac

# Linux
npm run dist:linux

# Cari OS üçün
npm run dist
```

Çıxış: `release/` qovluğunda.

**Vacib:** `npm run dist:*` cmd-i avtomatik olaraq:
1. `frontend/dist` build-i yaradır
2. native sqlite3 binary-ni doğru Electron versiyasına yenidən qurur
3. asar paketi yaradır (sqlite3 binary-si asarUnpack ilə kənarda qalır)

---

## Production-da DB faylı harada?

İlk dəfə açılışda backend DB faylını `userData` qovluğunda yaradır:

| OS      | Yol                                                  |
|---------|------------------------------------------------------|
| Windows | `%APPDATA%\ExamStation\database.db`                  |
| macOS   | `~/Library/Application Support/ExamStation/database.db` |
| Linux   | `~/.config/ExamStation/database.db`                  |

DB faylını backup almaq üçün bu faylı kopyalayın.

---

## Parolu komandalar xəttindən dəyişmək

Frontend-ə girişiniz yoxdursa (parolu unutdunuz və s.):

```bash
node backend/scripts/hash-password.js admin yeniParol123
# yaxud: npm run hash -- admin yeniParol123
```

İstifadəçi yoxdursa yaradılır, varsa parol yenilənir.

---

## Endpoint xəritəsi (API)

| Method | Path | Açıqlama |
|--------|------|----------|
| POST   | /auth/login | { name, password } → { success, name } |
| POST   | /auth/change-password | { name, oldPassword, newPassword } |
| GET    | /sections | bütün bölmələr |
| GET    | /sections/:id/commissions | bölməyə aid komissiyalar |
| GET    | /commissions?sectionId= | komissiyalar (filter ilə) |
| GET    | /commissions/:no/exercises | **stansiya seçimi üçün mənbə** |
| POST   | /commissions/:no/exercises | komissiyaya hərəkət təyin et |
| GET    | /exercises | bütün hərəkətlər |
| GET    | /exams?sectionId= | imtahanlar (filter ilə) |
| GET    | /exams/:id/commissions | **imtahana təyin olunmuş komissiyalar (SetupPage Step 3)** |
| POST   | /exams/:id/commissions | { commissionNos: [...] } — toplu yenilə |
| GET    | /students/lookup?examId=&commissionNo=&sNomer= | sıra № üzrə tələbə tap |
| GET    | /students/:id/results | tələbənin bütün nəticələri |
| GET    | /students/:id/photo | **tələbə şəklini binary qaytarır** |
| GET    | /students/:id/photo/exists | şəkil olub-olmamasını yoxlayır |
| POST   | /results/bulk | bir tələbə üçün N nəticə UPSERT (tək tranzaksiya) |
| GET    | /results?examId=&commissionNo= | nəticələr (filter ilə) |
| POST   | /imports/{sections,commissions,exam-commissions,...} | Excel/CSV idxal |
| GET    | /exports/results.{xlsx,json,csv} | nəticə eksport |

---

## Layihə strukturu

```
exam-station-app/
├── package.json              # Electron + electron-builder konfiqurasiyası
├── electron/
│   └── main.js               # Electron main: backend fork + BrowserWindow
├── backend/
│   ├── package.json
│   ├── server.js             # Express entry
│   ├── database.js           # SQLite wrapper + promise helpers
│   ├── migrations/
│   │   ├── 001_initial.sql   # sxema
│   │   ├── run.js            # migration runner
│   │   └── seed.js           # ilkin data
│   ├── scripts/
│   │   └── hash-password.js  # parol CLI
│   ├── services/
│   │   └── excel-helpers.js  # XLSX parse köməkçiləri
│   └── routes/
│       ├── auth.js
│       ├── sections.js
│       ├── commissions.js
│       ├── exercises.js
│       ├── exams.js
│       ├── students.js
│       ├── results.js        # bulk save endpoint
│       ├── imports.js        # Excel idxal
│       └── exports.js        # xlsx/json/csv eksport
├── frontend/
│   ├── package.json
│   ├── vite.config.js        # API proxy (dev)
│   ├── tailwind.config.js    # custom theme (ink/paper/moss/clay/rust/sun)
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # router + protected/setup guards
│       ├── index.css         # tailwind + custom utilities
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   ├── SetupContext.jsx
│       │   └── ToastContext.jsx
│       ├── components/
│       │   ├── TopBar.jsx
│       │   ├── ExerciseInput.jsx
│       │   └── ui/Primitives.jsx
│       ├── lib/
│       │   ├── api.js
│       │   └── format.js
│       └── pages/
│           ├── LoginPage.jsx
│           ├── SetupPage.jsx
│           ├── WorkstationPage.jsx
│           ├── ResultsListPage.jsx
│           └── AdminPage.jsx
└── build/
    └── README.txt            # ikonlar üçün placeholder
```

---

## Tez-tez yaranan problemlər

**"sqlite3 module did not self-register" və ya "NODE_MODULE_VERSION mismatch"**
→ `npm run rebuild:sqlite` icra edin. Bu native binary-ni cari Electron versiyasına
   uyğunlaşdırır.

**Frontend boş səhifə göstərir (prod build)**
→ `npm run build:frontend` icra edib `frontend/dist/index.html` mövcudluğunu yoxlayın.
   Eyni zamanda `package.json`-da `extraResources` sahəsi `frontend/dist`-i doğru
   göstərməlidir.

**"Port 5050 already in use"**
→ Başqa prosesi öldürün və ya `electron/main.js` + `backend/server.js`
   + `frontend/vite.config.js` + root `package.json`-da `5050` rəqəmini
   sərbəst bir portla əvəz edin.

**Windows-da `EACCES: permission denied 127.0.0.1:5050`**
→ Bu port Hyper-V və ya digər sistem servisi tərəfindən rezerv edilib.
   Sərbəst port siyahısını görmək üçün PowerShell-də:
   ```powershell
   netsh interface ipv4 show excludedportrange protocol=tcp
   ```
   Bu siyahıdan kənar bir port (məs. 7777, 8765) seçin və 4 faylda dəyişin.

**Excel idxalında "section_id mövcud deyil" xətası**
→ Əvvəlcə bölmələri, sonra komissiyaları, sonra tələbələri idxal edin (sıra önəmlidir).

---

## Lisenziya

ISC.
