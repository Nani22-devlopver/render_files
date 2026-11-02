> **Stage 6 edition: DB + images on Supabase. Start with SUPABASE_SETUP.md.**

# Aarogya Drishti

Synthetic-data oral screening demo for **AAROHAN Hackathon 2026** (ITDA Paderu).
**NOT FOR CLINICAL USE.** AI output is research-only and never a diagnosis.

Bilingual (EN/TE) PWA + FastAPI workflow API + **Ollama Cloud vision analysis** (with an offline mock fallback), image-quality checks, role isolation, audit trail, offline retry, Google Meet video consultations and a district dashboard. Database: **PostgreSQL**.

## Folder structure

```
aarogya-drishti/   (stage14)
├── backend/                         FastAPI + SQLAlchemy + PostgreSQL
│   ├── app/
│   │   ├── main.py  db.py  config.py  models.py  security.py  access.py
│   │   ├── routers.py               patients, screenings, AI, reviews, referrals, appointments, navigation, notifications
│   │   ├── hospital_routes.py       hospitals + specialists (district admin) and cross-mandal decisions (medical officer)
│   │   ├── admin_routes.py          districts / mandals, super-admin user + data manager
│   │   ├── geo.py  seed.py  supabase_storage.py
│   │   └── ai/                      image-quality check, Ollama Cloud adapter, mock adapter
│   ├── scripts/test_ollama.py
│   ├── tests/test_api.py
│   ├── requirements.txt  Dockerfile  supabase_schema.sql  migrate_local_images.py  .env.example
├── frontend/                        React + Vite PWA
│   ├── src/
│   │   ├── App.jsx                  routes only
│   │   ├── Layout.jsx               sidebar shell + role guard
│   │   ├── common.jsx  geo.jsx  api.js  i18n.js  styles.css  main.jsx
│   │   └── pages/                   SpecialistDashboard, Login, Register, Patients, PatientProfile, Reviews, Referrals, Appointments, Video,
│   │                                Investigations, NavigatorPage, Hospitals, Specialists, CrossMandal, Dashboard,
│   │                                AuditPage, Admin*, Super*, Notes, OfflinePage, Home
│   ├── public/ (sw.js, manifest.json)  index.html  package.json  vite.config.js
│   └── Dockerfile  nginx.conf
├── docs/DEMO_WALKTHROUGH.md
├── SUPABASE_SETUP.md  render.yaml  docker-compose.yml
└── README.md
```

### Stage 14b — specialist self-registration with district-admin approval

- The **Register** form offers *Specialist (doctor)*. After choosing district and mandal the applicant picks **their hospital from the list the district admin maintains** (`GET /public/hospitals`, no login needed), plus optional specialty and phone. The account is `pending` and cannot sign in.
- The district admin approves or declines it under **Pending approvals** (the hospital shows there), or still adds specialists manually on the **Specialists** page (pending applicants also appear there as *Awaiting approval*, with an **Approve** button).

### Stage 14 — specialist (doctor) dashboard

The specialist now has a focused dashboard instead of the booking tools. Sidebar: **My patients** and **Notifications** only (Patients, Appointments and Investigations were removed from it).

- **New requests**: patients the medical officer referred to this doctor (or to their hospital). **Accept patient** as a *direct visit* or a *video consult* (date/time, plus a Google Meet link for video). Accepting a hospital-level referral claims it, so colleagues no longer see it.
- **Accepted**: **Reschedule** (everyone involved is notified), **Join call** for video, and **Update analysis**.
- **Completed**: the saved analysis can be edited.
- **Analysis after the visit**: `POST /referrals/{id}/analysis` (`analysis`, `outcome`: follow_up / treatment_started / biopsy_advised / referred_higher / no_issue). It marks the appointment completed and the referral `ASSESSED`, and tells the navigator, medical officer and health worker (no clinical text in the alert).
- New columns (auto-added on start): `referrals.specialist_analysis`, `analysis_outcome`, `analysed_at`.
- Navigators and medical officers keep the previous Referrals / Appointments pages.

### Stage 13 — new privileges: hospital & specialist directory, targeted referrals, navigator hand-over

| Role | What changed |
|---|---|
| **District admin** (`admin`, also super admin) | Adds, edits, hides and removes **hospitals** (*Hospitals* page) and registers / updates / deactivates the **specialists** of each hospital (*Specialists* page). A district admin tied to a district manages that district only. |
| **Medical officer** | When signing a review with outcome *refer*, picks district → mandal → **hospital** (required) and optionally a **specialist** of that hospital. Leaving the specialist empty means any available specialist of that hospital can take the case. The MO no longer edits hospitals; he still decides cross-mandal requests. |
| **Specialist** | A doctor registered in one hospital by the admin (no self-registration any more). Sees only patients promoted **to them** or **to their hospital with no named specialist**: referrals, patients, screenings, appointments, investigations and notifications are all filtered this way. |
| **Navigator** | Each task / appointment now shows the **patient** (name, age, sex, phone, address) and the **specialist** (name, specialty, phone) plus the **hospital** (name, address, phone, mandal) and the appointment slot, so the patient can be guided and followed up. |

- New columns (added automatically on start-up): `users.hospital_id / specialty / phone`, `referrals.hospital_id / specialist_id`.
- New endpoints: `POST/PATCH/DELETE /specialists`, `GET /specialists?hospital_id=&district=&mandal=&include_inactive=`. `POST /referrals` now requires `hospital_id` (optional `specialist_id`). `POST/PATCH/DELETE /hospitals` are admin-only (the medical officer can list them).
- Appointments booked from a referral default to the referral's hospital and specialist; a specialist must belong to the hospital chosen.
- Demo data: `spec@demo.local` is registered at *Area Hospital Paderu*, a second specialist `spec2@demo.local` at *CHC G. Madugula*; existing referrals are linked to their hospital on start-up. Demo district admin: `admin@demo.local`.
- Upgrading from stage 12: nothing to run by hand. Existing `specialist` accounts without a hospital only see referrals addressed to them personally until the admin assigns a hospital.

## Demo accounts (password `Demo@123`)

| Role | Email |
| --- | --- |
| Health worker | `hw@demo.local` |
| Medical Officer | `mo@demo.local` |
| Specialist (Area Hospital Paderu) | `spec@demo.local` |
| Specialist (CHC G. Madugula) | `spec2@demo.local` |
| Navigator | `nav@demo.local` |
| District admin | `admin@demo.local` |
| Super admin | `superadmin@demo.local` |

New users can also register from the login page (they pick their **district** and **mandal** from the lists maintained by the admins); a district admin approves them under **Pending approvals**.

### Stage 12 — hospitals, patient's hospital choice, cross-mandal approval, self-clearing notifications

| Role | Responsibility |
|---|---|
| **Medical officer** (`medical_officer`, demo `mo@demo.local` / `Demo@123`) | Chooses the hospital / specialist when referring; accepts or declines cross-mandal bookings (hospitals are now managed by the district admin, see stage 13) |
| **Patient** | Chooses district → mandal → hospital → specialist when booked. Patients have no login, so the booking team (navigator / medical officer / specialist) records the patient's choice |
| **Specialist** | Treats the patient at the chosen hospital; never picks the hospital |
| **Navigator** | Guides the patient to the hospital / department |

- **Hospitals** (`/hospitals`): new `hospitals` table. Since stage 13 the district admin manages their own district; super admin manages all. A hospital that already has appointments can only be marked unavailable, not deleted.
- **Booking** (Referrals → *Hospital slot*): pick district + mandal (starts at the patient's own mandal), then a hospital and optionally a specialist.
- **Cross-mandal**: if the hospital is outside the patient's mandal, a written special reason is required and the appointment waits as `PENDING_APPROVAL`. The medical officer sees it under *Cross-mandal requests* (no patient name or clinical details) and accepts or declines (a reason is required to decline). Everyone involved is notified of the outcome.
- **Notifications**: plain alerts clear once the action is taken (opening / *Done*, or when the request is answered: registration approved, cross-mandal decided, referral booked, appointment status changed). **Google Meet link alerts are never cleared by actions; they disappear after the scheduled day.** Ending or deleting a call still withdraws its alerts at once.
- **Upgrading from stage 11:** nothing to run by hand. On start-up the backend creates the `hospitals` table, adds the new appointment / notification columns, seeds three demo hospitals (existing `health_officer` accounts become medical officers) (two in G. Madugula, one in Paderu).

### Stage 11 — super admin, districts & mandals, suspension

**District admin (`admin`)**
- **District / mandal dashboards** — *Dashboard* and *District monitoring* have a district + mandal selector. Pick a district to see only its figures, then a mandal inside it. In monitoring, click a row of the district table (or mandal table) to drill down.
- **Districts & mandals** (sidebar) — add districts and mandals by hand (one per line or comma-separated), rename or remove them. These lists feed the dropdowns on the user sign-up form and on patient registration. Renaming carries through to existing patient/staff records; a district or mandal that is still in use cannot be removed.
- **Suspend users** — *Users* → select a person → **Suspend user** (with an optional reason). The person is signed out immediately and cannot log in, but the account and every record linked to it stay in the database unchanged. **Reactivate user** restores access.

**Super admin (`super_admin`)** — everything a district admin can do, plus:
- sees identifiable patient records (district admins only ever see aggregates);
- **Users & admins** — add district admins (or any role) directly, edit any account, reset passwords, suspend / reactivate, or delete;
- **Data manager** — view, add, edit and delete any row of any table (patients, screenings, referrals, districts, …) with search and paging; deleting a row that other records depend on asks for confirmation before a cascade delete. Every change is written to the audit trail;
- the last active super admin cannot be suspended, demoted or deleted, and nobody can delete or demote themselves.

The first super admin is created automatically on start-up (also on an existing database). Set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` and `SUPER_ADMIN_NAME` in `backend/.env` before going live — the default password is for the demo only.

**Upgrading from stage 10:** nothing to run by hand. On start-up the backend creates the `districts` / `mandals` tables, adds the new `district`, `mandal` and suspension columns, seeds one starter district (*Alluri Sitharama Raju* → *G. Madugula*) and tags existing G. Madugula patients and demo staff with it. Add the rest of your districts and mandals from the admin console.

## Option A: Docker (easiest)

```bash
docker compose up --build
```
- App: http://localhost:8080
- API docs: http://localhost:8000/docs

## Option B: Run locally

1. Install PostgreSQL 14+ and create the databases:
   ```bash
   psql -U postgres -f backend/init_db.sql
   ```
2. Backend (Python 3.11+):
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate        # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env             # set your postgres password in DATABASE_URL
   uvicorn app.main:app --reload --port 8000
   ```
   Tables are created and demo users are seeded automatically on first start.
3. Frontend (Node 20+), in a second terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open http://localhost:5173 (Vite proxies `/api` to port 8000).

## AI image analysis (Ollama Cloud)

The browser never talks to Ollama. The photo is uploaded to the backend, stored privately, and when the health worker taps **Analyse photo with AI** the backend reads the stored image, downsizes it (max 1024 px), and sends it with minimal context to Ollama Cloud with the official `ollama` Python client (`Client(host="https://ollama.com", headers={"Authorization": "Bearer <key>"}).chat(model=..., messages=[{..., "images": [image_bytes]}])`). The model's JSON reply is validated, stored with the analysis, and shown to each person in the form they need:

The model acts like a **junior doctor**: it does not describe the picture. It names the most likely condition (or says **"No disease detected"**), explains its reasoning using the patient's symptoms and habits, gives health suggestions, and always insists on a doctor's consultation. Patient wording is calm and never alarming.

| Audience | Where | What they get |
| --- | --- | --- |
| Health worker | Patient profile | Most likely condition, assessment, health suggestions, warning signs, doctor-consultation advice, next steps, and (if the photo is unusable) how to retake it |
| Patient | Patient profile | A short, gentle plain-language message in **English or Telugu** (follows the UI language) |
| Reviewing clinician | Review page | Working impression with other possibilities, summary of what to examine or test in person, suggested urgency |

Setup (in `backend/.env`):

```env
AI_PROVIDER=auto                       # auto | ollama | mock
LOCAL_QUALITY_CHECK=false              # false = the AI judges photo quality
OLLAMA_API_KEY=your_key_from_https://ollama.com/settings/keys
OLLAMA_MODEL=gemma4                    # must be vision-capable
OLLAMA_FALLBACK_MODEL=                 # optional second model, tried if the first errors or is not found
```

- `auto` uses Ollama Cloud when `OLLAMA_API_KEY` is set, otherwise the offline mock adapter, so the demo still works without internet.
- Test your key and model without the web app: `cd backend && python scripts/test_ollama.py photo.jpg` (prints the feedback or the exact error).
- Model ids come from https://ollama.com/api/tags. If you get "model not found", change `OLLAMA_MODEL` to a vision model listed there.
- **Photo quality is judged by the AI, not by a local gate.** `LOCAL_QUALITY_CHECK=false` (default) skips the blur/size/type rejection: every photo is stored as `pending_ai`, and the model's verdict (usable or not, why, how to retake) is shown and written back to the photo's status. Only empty files and files over 8 MB are refused. Set `LOCAL_QUALITY_CHECK=true` to bring back the old local check.
- Existing databases are upgraded automatically on start (one nullable `feedback` column on `ai_analyses`).
- Only age, sex, symptoms, duration, tobacco habits, exam notes and the photographed area are sent. Name, phone, address and village are never sent.
- If Ollama is unreachable, times out or rejects the key, the API returns HTTP 503, the screening moves to `AWAITING_CLINICIAN`, and the clinician reviews manually.
- Results stay advisory and provisional: `clinical_use: false`, `requires_clinician_review: true`. The prompt forbids medicine names and doses; suggestions are self-care and lifestyle only.

`POST /ai/analyze` response (Ollama path):

```json
{
  "analysis_id": "...", "status": "completed", "provider": "ollama", "model_version": "gemma4",
  "research_label": "condition_possible_example", "clinical_use": false, "requires_clinician_review": true,
  "feedback": {
    "image_assessment": {"is_oral_photo": true, "usable": true, "issues": []},
    "predicted_condition": {"disease_detected": true, "name": "Oral leukoplakia (most likely)", "likelihood": "medium", "other_possibilities": ["Oral lichen planus"]},
    "analysis": "...", "confidence": "medium", "suggested_urgency": "soon",
    "health_suggestions": ["..."], "warning_signs": ["..."], "consult_advice": "...",
    "health_worker_guidance": ["..."], "recapture_tips": [],
    "clinician_summary": "...", "patient_message": {"en": "...", "te": "..."}, "limitations": "..."
  }
}
```

Labels: `suspicious_example` (possible precancer/cancer, prompt attention), `condition_possible_example`, `no_suspicious_finding_example` ("No disease detected"), `inconclusive_example` (unusable photo). The server enforces consistency, e.g. "no disease" always means label `no_suspicious_finding_example` and routine urgency.

## Tests

Uses a separate database `aarogya_drishti_test` (tables are dropped and recreated). Override with `TEST_DATABASE_URL`.

```bash
cd backend
python -m pytest -q
```

## Latest changes (stage 3 MO UI + accounts)

**Pages are now separate files.** `App.jsx` only holds routes. Each page lives in `frontend/src/pages/<Name>.jsx`; shared pieces are in `common.jsx` and `Layout.jsx`.

**Medical Officer review page (`/reviews`)** is now a two-pane screen. The left pane lists every record awaiting review (with search); clicking one opens its report (symptoms, photos, AI feedback) and the signature form on the right. After signing, the record leaves the list.

**Admin audit page (`/audit`)** is now a dashboard: KPI cards (total events, today, active users, sign-ins), search, category filters, a table with the user's name and role, and a "most frequent events" panel. `GET /audit` now returns `actor_name` and `actor_role` and the latest 500 events.

**Self-registration with admin approval**
- The login page has a **Sign in / Register** switch. Registering asks for name, email, password, **designation** (health worker, navigator, medical officer, specialist; specialists choose their hospital and need district-admin approval) and an optional facility.
- New accounts are saved with `status = pending`. They cannot sign in (login returns 403 with a clear message) until an admin approves them. Declined accounts also cannot sign in.
- Every active admin gets a notification, and the **Pending approvals** page (sidebar badge shows the count) has Approve / Decline buttons. The user gets a notification of the decision.
- Admins can only approve or decline a request once (second attempt returns 409). Demo seed users stay `active`.

**Admin Users page (`/admin/users`)** lists all health workers, navigators, medical officers and specialists (filter by designation, search by name/email). Clicking a user shows profile, status, last activity, role-specific work status and recent activity:

| Designation | Work status shown |
| --- | --- |
| Health worker | patients registered, screenings done, photos uploaded, awaiting clinician |
| Medical officer | reviews signed, referrals created, cases waiting review |
| Navigator | tasks assigned / open / closed, unassigned tasks |
| Specialist | referrals, appointments completed / open, investigations reviewed / pending (programme-wide, since these records are not owned per specialist) |

Only counts are shown, never patient identities, so the admin's aggregate-only rule still holds.

New endpoints: `POST /auth/register`, `GET /admin/users`, `GET /admin/users/{id}`, `POST /admin/users/{id}/approve`, `POST /admin/users/{id}/reject`. No new database columns or packages, so no migration or extra install step is needed. Two new tests cover the approval flow (`python -m pytest -q`).

## Video consultations (Google Meet only)

Google Meet is the only video provider. Jitsi was removed.

- **Create the link:** on **Referrals**, click *Create a Meet link* (opens meet.new), copy the link and paste it in. It is checked to be a real `https://meet.google.com/...` address and stored with the appointment. Meet opens in a new tab (it cannot be embedded), from the **Open Google Meet** button on the join page.
- **Schedule:** pick the exact **date and time**; the page shows the **day of the week** (for example "Monday, 2 November 2026 · 10:00") before you book. Past times are refused. Slots keep your local UTC offset, so the weekday and hour stay exact in notifications.
- **Start now (specialists only):** a specialist can switch to *Start now*. The consult is created for the current moment, the Meet tab opens, and the team is told it is live. Navigators and medical officers can schedule but not start-now (the API returns 403).
- **Notified automatically** (title and time only, never patient names or clinical details): the health worker who screened/registered the patient, the medical officer who signed the review, all navigators, and specialists (whoever made the change is skipped).
  - when a consult is scheduled, confirmed, rescheduled, cancelled, missed or completed
  - "Video consultation is live" when a specialist starts now or opens the call (repeat alerts suppressed for 10 minutes)
  - when the health worker joins first, the specialist/MO are told the patient side is ready
  - a "starting soon" reminder when the slot is within 30 minutes (created when notifications are fetched)
- **Where users see it:** the Notifications link shows an unread count, new alerts pop up as a message (checked every 20 s), and each video alert has a *Join video call* link. The **Appointments** page is sorted by time, shows the weekday, has Join call, status buttons and a Reschedule picker (health workers can view and join, not change status). A video appointment without a link can have one pasted there.
- Automatic Meet link creation would need a Google Cloud OAuth setup (Calendar API `conferenceData`) and is not included, so no Google credentials are required.
- Existing databases upgrade automatically on start; any old appointment is marked Google Meet and needs a link added before it can be joined.

## Latest changes (retake fix, alert cap, DB-first data, Supabase-ready)

- **Retake analyses the new photo.** The profile page now remembers which uploaded photo is current. **Analyse** always sends that photo (the old code preferred the first "acceptable" photo, so an old image was re-sent). **Retake** clears the preview, disables Analyse until a new photo is uploaded, and hides the previous result. The same file name can be picked again. `GET /screenings/{id}` returns `image_id` per analysis, `POST /ai/analyze` returns the `image_id` it used and checks the stored file against its checksum.
- **At most 3 alerts, bottom-right.** Pop-up alerts are capped at 3 on screen, and a fresh login shows the 3 newest unread ones. The sidebar badge still shows the full unread count.
- **MO, specialist and navigator pages read the database directly.** `GET /screenings?awaiting_review=true` returns every screening without a signed review, whatever stage the health worker left it in (with patient name and village). On start, `SEED_DEMO_DATA=true` inserts synthetic cases at each stage (awaiting review, referred, appointment, investigation, closed) once per database, so those pages are never empty.
- **Supabase-ready.** Only `DATABASE_URL` changes. `postgres://` and `postgresql://` URLs are accepted, `sslmode=require` is added for `*.supabase.co` / `*.supabase.com`, and the pool recycles idle connections. Tables are created on start. Uploaded photos are still stored in `STORAGE_DIR` (not in the database).

## Latest changes (English + Telugu AI output, end/delete Meet)

- **Two AI outputs.** After the vision model returns the English assessment, a second text-only Ollama call produces the same assessment in Telugu, stored in `feedback.translations.te`. When the app language is Telugu, the AI card (condition, assessment, suggestions, warning signs, doctor advice, clinician summary, headings and pills) switches to the Telugu output instantly; English shows again when you switch back. If the Telugu call fails, the English result is kept and the card says Telugu is unavailable. No database change. Analysis can now take up to two model calls.
- **Host can stop or delete a Google Meet.** On **Appointments**, a specialist, medical officer or navigator can press **End call** (`POST /appointments/{id}/end`: link removed, booking cancelled) or **Delete** (`DELETE /appointments/{id}`). Both remove every alert about that appointment (scheduled, live, joined, reminder) from all users' notification lists, so badges and lists update on their next refresh (within 20 s). Cancelling with the status button also clears the earlier alerts before sending its single "cancelled" notice. Health workers cannot end or delete.

## Troubleshooting

- **Blank page or "something went wrong" on a role's page:** open the browser console (F12). After updating, run `npm install` once and restart `npm run dev`; hard-refresh (Ctrl+Shift+R) so the old service-worker cache is not served.

## Frontend UI refresh (changelog)

Only `frontend/src/App.jsx` and `frontend/src/styles.css` were changed. No backend, `.env`, API paths, route paths, state/variable names, i18n keys, localStorage keys or dependencies were touched, so **no new setup steps are required** (`npm install` and `npm run dev` work as before).

What changed visually:
- Sidebar navigation on desktop and a bottom tab bar on mobile, with icons and active-page highlight.
- New split-screen login with one-click demo role chips and a show/hide password toggle.
- Status pills (colour coded), avatars, empty states and loading skeletons across all pages.
- Patient profile shows a Consent, Details, Photo, AI check progress stepper and a vertical case timeline.
- Dashboard KPI cards with progress bars; audit trail as a timeline; toast messages for sync and reset.
- Responsive layout, keyboard focus styles, reduced-motion support, and a clean print view for referral slips.

Icons are inline SVG, and the font stack is system fonts (with Telugu fallbacks), so there are no new packages or external requests.

## Safety rules baked into the product

- AI output is a provisional impression with `clinical_use: false`; every result tells the patient to consult a doctor.
- A signed review cannot be silently overwritten (HTTP 409).
- Screening and photos require matching consent.
- Workflow continues if the AI adapter is forced down (`AI_FORCE_FAIL=true`).
- Images are stored in a private folder (`STORAGE_DIR`), not a public URL.

- Photos sent to a cloud model are a privacy trade-off. Use synthetic or consented images only, and keep `OLLAMA_API_KEY` out of version control (`.env` is git-ignored; use `.env.example` as the template).

Do not commit real credentials or real patient photographs.
