import { useEffect, useState } from "react";
import { api } from "../api";
import { Empty, Loading, Pill, toast, PageHead, slotLabel } from "../common";

// Medical officer: accept or decline hospital bookings that fall outside the patient's own mandal.
export default function CrossMandal() {
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState("PENDING");
  const [notes, setNotes] = useState({});
  const [err, setErr] = useState("");

  const load = () =>
    api(`/cross-mandal-requests?status=${tab === "PENDING" ? "PENDING" : "all"}`).then(setRows).catch((e) => { setErr(e.message); setRows([]); });
  useEffect(() => { setRows(null); load(); }, [tab]);

  async function decide(a, decision) {
    setErr("");
    try {
      await api(`/appointments/${a.id}/cross-mandal/decision`, { method: "POST", body: JSON.stringify({ decision, note: notes[a.id] || null }) });
      toast(decision === "approve" ? "Accepted. The booking team was told." : "Declined. The booking team was told.");
      window.dispatchEvent(new Event("notes-changed")); // the request alert is cleared once it is answered
      await load();
    } catch (e) { setErr(e.message); }
  }

  const list = tab === "PENDING" ? rows : (rows || []).filter((r) => r.approval_status !== "PENDING");
  return (
    <>
      <PageHead title="Cross-mandal requests" sub="Patients are normally booked into a hospital of their own mandal. In special cases the booking team asks you to accept a hospital in another mandal." />
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "PENDING"} className={tab === "PENDING" ? "on" : ""} onClick={() => setTab("PENDING")}>Waiting for you</button>
        <button type="button" role="tab" aria-selected={tab === "HISTORY"} className={tab === "HISTORY" ? "on" : ""} onClick={() => setTab("HISTORY")}>Decided</button>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card">
        {list === null ? <Loading /> : list.length === 0 ? <Empty icon="check" text={tab === "PENDING" ? "No requests waiting" : "No decided requests yet"} /> : (
          <ul className="list">
            {list.map((a) => (
              <li key={a.id}>
                <div className="item-top">
                  <span><b>{a.hospital_name}</b> · {a.hospital_mandal}, {a.hospital_district}</span>
                  <Pill>{a.approval_status}</Pill>
                </div>
                <p className="small">Patient's area: {a.patient_village ? `${a.patient_village}, ` : ""}{a.patient_mandal}, {a.patient_district || "—"} · {slotLabel(a.slot)}{a.priority ? ` · ${a.priority}` : ""}{a.specialty ? ` · ${a.specialty}` : ""}</p>
                <p className="small"><b>Special reason:</b> {a.cross_reason}</p>
                {a.approval_note && <p className="small"><b>Decision note:</b> {a.approval_note}</p>}
                {a.approval_status === "PENDING" && (
                  <>
                    <input value={notes[a.id] || ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} placeholder="Note for the booking team (required to decline)" />
                    <div className="row">
                      <button className="sm" onClick={() => decide(a, "approve")}>Accept</button>
                      <button className="secondary sm" disabled={!(notes[a.id] || "").trim()} onClick={() => decide(a, "reject")}>Decline</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
