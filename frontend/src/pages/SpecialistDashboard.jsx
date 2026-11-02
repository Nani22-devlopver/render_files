import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Empty, Icon, Loading, PageHead, Pill, DateTimePick, defaultSlotInput, initials, isPast, localToSlot, slotLabel, slotToLocalInput, toast } from "../common";

const OUTCOMES = [
  ["follow_up", "Follow-up visit needed"],
  ["treatment_started", "Treatment started"],
  ["biopsy_advised", "Biopsy / investigation advised"],
  ["referred_higher", "Referred to a higher centre"],
  ["no_issue", "No issue found"],
];

// Doctor's dashboard: accept a referred patient (hospital visit or video consult), reschedule, and record the analysis after the visit.
export default function SpecialistDashboard() {
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState("new");
  const [open, setOpen] = useState(""); // `${referralId}:${accept|resched|analysis}`
  const [slot, setSlot] = useState(defaultSlotInput());
  const [kind, setKind] = useState("physical");
  const [meet, setMeet] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [outcome, setOutcome] = useState("follow_up");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api("/referrals").then(setRows).catch((e) => { setErr(e.message); setRows([]); });
  useEffect(() => { load(); }, []);

  const groups = useMemo(() => {
    const g = { new: [], accepted: [], done: [] };
    (rows || []).forEach((r) => (r.status === "ASSESSED" || r.status === "CARE_LINKED" ? g.done : r.appointment ? g.accepted : g.new).push(r));
    return g;
  }, [rows]);

  function toggle(r, what) {
    const key = `${r.id}:${what}`;
    setErr("");
    if (open === key) return setOpen("");
    setOpen(key);
    setSlot(what === "resched" && r.appointment ? slotToLocalInput(r.appointment.slot) : defaultSlotInput());
    setKind("physical"); setMeet("");
    setAnalysis(r.specialist_analysis || ""); setOutcome(r.analysis_outcome || "follow_up");
  }

  async function run(fn, ok) {
    setErr(""); setBusy(true);
    try { await fn(); toast(ok); setOpen(""); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const accept = (r) => {
    if (isPast(slot)) return setErr("Pick a date and time in the future.");
    if (kind === "video" && !meet.trim()) return setErr("Paste a Google Meet link for the video consult.");
    run(() => api("/appointments", { method: "POST", body: JSON.stringify({ referral_id: r.id, kind, slot: localToSlot(slot), status: "CONFIRMED", meet_url: kind === "video" ? meet.trim() : null }) }), "Patient accepted. Navigator and team notified");
  };
  const resched = (r) => {
    if (isPast(slot)) return setErr("Pick a date and time in the future.");
    run(() => api(`/appointments/${r.appointment.id}`, { method: "PATCH", body: JSON.stringify({ status: "RESCHEDULED", slot: localToSlot(slot) }) }), "Rescheduled. Everyone involved was notified");
  };
  const saveAnalysis = (r) => run(() => api(`/referrals/${r.id}/analysis`, { method: "POST", body: JSON.stringify({ analysis, outcome }) }), "Analysis saved");

  const list = groups[tab];
  const tabs = [["new", "New requests"], ["accepted", "Accepted"], ["done", "Completed"]];

  return (
    <>
      <PageHead title="My patients" sub="Patients the medical officer referred to you or your hospital. Accept, reschedule, and record your analysis after the visit." />
      <div className="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setOpen(""); setErr(""); }}>
            {label} ({groups[k].length})
          </button>
        ))}
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card">
        {rows === null ? <Loading /> : list.length === 0 ? <Empty icon="file" text={tab === "new" ? "No new patients waiting" : "Nothing here yet"} /> : (
          <ul className="list">
            {list.map((r) => {
              const a = r.appointment;
              return (
                <li key={r.id}>
                  <div className="item-top">
                    <div className="item-main">
                      <span className="avatar">{initials(r.patient_name || "P")}</span>
                      <div>
                        <b><Link to={`/patients/${r.patient_id}`}>{r.patient_name || r.id.slice(0, 8)}</Link></b>
                        <span>{[r.patient_age && `${r.patient_age} yrs`, r.patient_sex, r.village].filter(Boolean).join(" · ")} · {r.hospital_name || r.facility}</span>
                      </div>
                    </div>
                    <Pill>{r.priority}</Pill>
                  </div>
                  {r.reason && <p className="small"><b>Medical officer's finding:</b> {r.reason}</p>}
                  {a && (
                    <p className="small">
                      <b>{a.kind === "video" ? "Video consult" : "Hospital visit"}</b> · {slotLabel(a.slot)} · <Pill>{a.status}</Pill>
                      {a.kind === "video" && a.has_meet_link && <> · <Link to={`/video/${a.id}`}>Join call</Link></>}
                      {a.approval_status === "PENDING" && " · waiting for the medical officer's approval"}
                    </p>
                  )}
                  {r.specialist_analysis && (
                    <p className="small"><b>Your analysis ({(OUTCOMES.find((o) => o[0] === r.analysis_outcome) || [])[1] || "recorded"}):</b> {r.specialist_analysis}</p>
                  )}
                  <div className="row">
                    {tab === "new" && <button className="sm" onClick={() => toggle(r, "accept")}>Accept patient</button>}
                    {tab === "accepted" && a && a.approval_status !== "PENDING" && <button className="secondary sm" onClick={() => toggle(r, "resched")}>Reschedule</button>}
                    {tab === "accepted" && a && <button className="sm" onClick={() => toggle(r, "analysis")}>Update analysis</button>}
                    {tab === "done" && <button className="secondary sm" onClick={() => toggle(r, "analysis")}>Edit analysis</button>}
                  </div>

                  {open === `${r.id}:accept` && (
                    <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>
                      <b>Accept as</b>
                      <div className="tabs" role="radiogroup">
                        <button type="button" role="radio" aria-checked={kind === "physical"} className={kind === "physical" ? "on" : ""} onClick={() => setKind("physical")}>Direct visit at {r.hospital_name || "hospital"}</button>
                        <button type="button" role="radio" aria-checked={kind === "video"} className={kind === "video" ? "on" : ""} onClick={() => setKind("video")}><Icon n="video" s={14} /> Video consult</button>
                      </div>
                      <DateTimePick value={slot} onChange={setSlot} label="Date and time" />
                      {kind === "video" && (
                        <>
                          <label>Google Meet link</label>
                          <div className="row" style={{ margin: 0 }}>
                            <input value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" inputMode="url" />
                            <button type="button" className="secondary" onClick={() => window.open("https://meet.new", "_blank", "noopener")}>Create a Meet link</button>
                          </div>
                        </>
                      )}
                      <div className="row">
                        <button disabled={busy} onClick={() => accept(r)}>Confirm</button>
                        <button className="secondary" onClick={() => setOpen("")}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {open === `${r.id}:resched` && (
                    <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>
                      <DateTimePick value={slot} onChange={setSlot} label="Reschedule to" />
                      <div className="row">
                        <button disabled={busy} onClick={() => resched(r)}>Reschedule</button>
                        <button className="secondary" onClick={() => setOpen("")}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {open === `${r.id}:analysis` && (
                    <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>
                      <label>Your analysis after seeing the patient</label>
                      <textarea rows={4} value={analysis} onChange={(e) => setAnalysis(e.target.value)} placeholder="Findings, diagnosis, plan" />
                      <label>Outcome</label>
                      <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                        {OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <div className="row">
                        <button disabled={busy || analysis.trim().length < 5} onClick={() => saveAnalysis(r)}>Save analysis</button>
                        <button className="secondary" onClick={() => setOpen("")}>Cancel</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
