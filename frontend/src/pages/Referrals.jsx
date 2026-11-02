import { useEffect, useState, useMemo } from "react";
import { Link, NavLink, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, clearSession, currentUser, enqueue, flushQueue, getQueue, getToken, newIdempotencyKey, setSession } from "../api";
import { GeoSelect } from "../geo";
import { useI18n, ICONS, Icon, initials, tone, Pill, toUploadable, AI_LABELS, URGENCY_KIND, URGENCY_TEXT, BulletList, AiFeedback, Empty, Loading, toast, Toasts, PageHead, slotLabel, localToSlot, slotToLocalInput, defaultSlotInput, weekdayLabel, isPast, DateTimePick } from "../common";

export default function Referrals() {
  const { t } = useI18n();
  const user = currentUser();
  const isSpecialist = user?.role === "specialist";
  const [rows, setRows] = useState([]);
  const [slot, setSlot] = useState(defaultSlotInput());
  const [mode, setMode] = useState("schedule"); // "schedule" | "now" (specialist only)
  const [meetUrl, setMeetUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    api("/referrals").then(setRows);
  }, []);

  // Hospital picker: district -> mandal -> hospital -> specialist (the patient's choice, recorded by the booking team)
  const [specialists, setSpecialists] = useState([]);
  const [panel, setPanel] = useState("");
  const [pick, setPick] = useState({ district: "", mandal: "", hospital_id: "", specialist_id: "", cross_reason: "" });
  const [hospitals, setHospitals] = useState([]);
  useEffect(() => {
    if (!panel || !pick.hospital_id) { setSpecialists([]); return; }
    api(`/specialists?hospital_id=${pick.hospital_id}`).then(setSpecialists).catch(() => setSpecialists([]));
  }, [panel, pick.hospital_id]);
  useEffect(() => {
    if (!panel || !pick.district || !pick.mandal) { setHospitals([]); return; }
    api(`/hospitals?district=${encodeURIComponent(pick.district)}&mandal=${encodeURIComponent(pick.mandal)}`).then(setHospitals).catch(() => setHospitals([]));
  }, [panel, pick.district, pick.mandal]);
  function openPanel(r) {
    setErr(""); setMsg("");
    setPanel(panel === r.id ? "" : r.id);
    // starts from the hospital / specialist the medical officer chose when referring
    setPick({ district: r.hospital_district || r.district || "", mandal: r.hospital_mandal || r.mandal || "", hospital_id: r.hospital_id || "", specialist_id: r.specialist_id || "", cross_reason: "" });
  }
  const panelRow = rows.find((r) => r.id === panel);
  const isCross = !!(panelRow && panelRow.mandal && (pick.mandal !== panelRow.mandal || (panelRow.district && pick.district !== panelRow.district)));

  async function book(id, kind) {
    setErr("");
    setMsg("");
    const startNow = kind === "video" && mode === "now";
    if (kind === "video" && !meetUrl.trim()) {
      setErr("Paste a Google Meet link first (use 'Create a Meet link' to get one).");
      return;
    }
    if (kind === "physical" && !pick.hospital_id) {
      setErr("Select the hospital the patient chose.");
      return;
    }
    if (kind === "physical" && isCross && pick.cross_reason.trim().length < 5) {
      setErr("This hospital is outside the patient's mandal. Write the special reason for the medical officer.");
      return;
    }
    if (!startNow && (!slot || isPast(slot))) {
      setErr("Pick a date and time that is in the future.");
      return;
    }
    // open the tab inside the click so the browser does not block it
    const tab = startNow ? window.open("", "_blank") : null;
    setBusy(id);
    try {
      const a = await api("/appointments", {
        method: "POST",
        body: JSON.stringify({ referral_id: id, kind, slot: localToSlot(slot), status: "CONFIRMED", meet_url: kind === "video" ? meetUrl.trim() : null, start_now: startNow,
          hospital_id: kind === "physical" ? pick.hospital_id : null, specialist_id: pick.specialist_id || null, cross_reason: kind === "physical" && isCross ? pick.cross_reason.trim() : null }),
      });
      if (startNow) {
        if (tab) { tab.opener = null; tab.location.href = meetUrl.trim(); }
        setMsg("Call started. The health worker, medical officer and navigators were notified to join. If the Meet tab did not open, use Appointments → Join call.");
        toast("Call started and team notified");
      } else if (a.approval_status === "PENDING") {
        setMsg("Sent to the medical officer. This hospital is outside the patient's mandal, so the visit is confirmed only after the officer accepts it. You will be notified.");
        toast("Cross-mandal request sent");
        setPanel("");
      } else {
        if (kind === "physical") setPanel("");
        setMsg(`Booked ${a.kind === "video" ? "Google Meet video consultation" : "hospital slot"} for ${weekdayLabel(slot)} at ${slot.split("T")[1]}. The health worker, medical officer and navigators were notified.`);
        toast("Booked and notified");
      }
    } catch (e) {
      if (tab) tab.close();
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHead title="Referrals" sub={isSpecialist ? "Patients the medical officer referred to you or your hospital." : "Schedule a Google Meet consultation or a hospital slot."} />
      <div className="card">
        {isSpecialist && (
          <>
            <label>Video consultation timing</label>
            <div className="tabs" role="radiogroup" aria-label="Timing">
              <button type="button" role="radio" aria-checked={mode === "schedule"} className={mode === "schedule" ? "on" : ""} onClick={() => setMode("schedule")}>Schedule for later</button>
              <button type="button" role="radio" aria-checked={mode === "now"} className={mode === "now" ? "on" : ""} onClick={() => setMode("now")}>Start now</button>
            </div>
          </>
        )}
        {mode === "schedule" && <DateTimePick value={slot} onChange={setSlot} label="Exact date and time (your local time)" />}
        {mode === "now" && <p className="okmsg">The call starts immediately when you press Video consult. Only specialists can do this.</p>}

        <label>Google Meet link (for video consults)</label>
        <div className="row" style={{ margin: 0 }}>
          <input value={meetUrl} onChange={(e) => setMeetUrl(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" inputMode="url" />
          <button type="button" className="secondary" onClick={() => window.open("https://meet.new", "_blank", "noopener")}>Create a Meet link</button>
        </div>
        <p className="small">Create the meeting in Google Meet, copy its link and paste it here. Everyone involved is notified and gets a Join button.</p>

        {rows.length === 0 ? <Empty icon="file" text="No referrals yet" /> : (
          <ul className="list" style={{ marginTop: 14 }}>
            {rows.map((r) => (
              <li key={r.id}>
                <div className="item-top">
                  <div className="item-main">
                    <span className="avatar">{initials(r.patient_name || "R")}</span>
                    <div>
                      <b><Link to={`/patients/${r.patient_id}`}>{r.patient_name || r.id.slice(0, 8)}</Link></b>
                      <span>{r.village} · {r.hospital_name || r.facility}{r.specialist_name ? ` · ${r.specialist_name}` : " · any available specialist"}</span>
                    </div>
                  </div>
                  <Pill>{r.priority}</Pill>
                </div>
                <p className="small">{r.slip?.en}</p>
                <p className="small">{r.slip?.te}</p>
                <div className="row">
                  <button disabled={busy === r.id} onClick={() => book(r.id, "video")}>
                    <Icon n="video" s={16} /> {mode === "now" ? "Start video consult now" : "Schedule video consult"}
                  </button>
                  <button className="secondary" disabled={busy === r.id || mode === "now"} onClick={() => openPanel(r)}>Hospital slot</button>
                  <button className="secondary" onClick={() => window.print()}>{t.printSlip}</button>
                </div>
                {panel === r.id && (
                  <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>
                    <b>Hospital chosen by the patient</b>
                    <p className="small">Pick the district and mandal, then one of its hospitals. It starts with the patient's own mandal.</p>
                    <GeoSelect district={pick.district} mandal={pick.mandal} onChange={(g) => setPick({ ...pick, ...g, hospital_id: "", specialist_id: "" })} />
                    <label>Hospital</label>
                    <select value={pick.hospital_id} onChange={(e) => setPick({ ...pick, hospital_id: e.target.value, specialist_id: "" })} disabled={!pick.mandal}>
                      <option value="">{!pick.mandal ? "Select a mandal first" : hospitals.length ? "Select hospital" : "No hospitals listed in this mandal"}</option>
                      {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}{h.address ? ` — ${h.address}` : ""}</option>)}
                    </select>
                    <label>Specialist (optional)</label>
                    <select value={pick.specialist_id} onChange={(e) => setPick({ ...pick, specialist_id: e.target.value })}>
                      <option value="">Any available specialist at this hospital</option>
                      {specialists.map((sp) => <option key={sp.id} value={sp.id}>{sp.full_name}</option>)}
                    </select>
                    {isCross && (
                      <>
                        <p className="warn">This hospital is outside the patient's mandal ({r.mandal}). The medical officer must accept it first.</p>
                        <label>Special reason for the medical officer</label>
                        <textarea rows={2} value={pick.cross_reason} onChange={(e) => setPick({ ...pick, cross_reason: e.target.value })} placeholder="e.g. Only oral surgery unit within reach; patient lives near the mandal border" />
                      </>
                    )}
                    <div className="row">
                      <button disabled={busy === r.id || !pick.hospital_id} onClick={() => book(r.id, "physical")}>{isCross ? "Send request to medical officer" : "Book hospital slot"}</button>
                      <button className="secondary" onClick={() => setPanel("")}>Cancel</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {err && <p className="err">{err}</p>}
        {msg && <p className="warn">{msg}</p>}
      </div>
    </>
  );
}
