import { useEffect, useState } from "react";
import { api } from "../api";
import { initials, Pill, Empty, PageHead, slotLabel } from "../common";

// Navigator: sees who the patient is, who the specialist is and where the hospital is, so the patient can be guided there.
export default function NavigatorPage() {
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState("Contacted family; transport arranged (synthetic).");
  const [err, setErr] = useState("");
  useEffect(() => {
    api("/navigation").then(setRows).catch((e) => setErr(e.message));
  }, []);
  async function update(id, status) {
    await api(`/navigation/${id}`, { method: "PATCH", body: JSON.stringify({ status, contact_log: note }) });
    setRows(await api("/navigation"));
  }
  return (
    <>
      <PageHead title="Patient navigation" sub="Guide each patient to the hospital and specialist chosen for them, until they reach care." />
      {err && <p className="err">{err}</p>}
      <div className="card">
        <label>Contact log note</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        {rows.length === 0 ? <Empty icon="compass" text="No tasks" /> : (
          <ul className="list" style={{ marginTop: 14 }}>
            {rows.map((t) => (
              <li key={t.id}>
                <div className="item-top">
                  <div className="item-main">
                    <span className="avatar">{initials(t.patient_name || "N")}</span>
                    <div>
                      <b>{t.patient_name || t.id.slice(0, 8)}</b>
                      <span>{[t.patient_age && `${t.patient_age} yrs`, t.patient_sex].filter(Boolean).join(" · ")} · due {t.due}</span>
                    </div>
                  </div>
                  <Pill>{t.status}</Pill>
                </div>
                <div className="grid" style={{ marginTop: 10 }}>
                  <div>
                    <b>Patient</b>
                    <p className="small" style={{ margin: "4px 0" }}>
                      {t.patient_phone ? <>Phone: <a href={`tel:${t.patient_phone}`}>{t.patient_phone}</a></> : "No phone on record"}<br />
                      {t.patient_address || t.village || "No address on record"}
                    </p>
                  </div>
                  <div>
                    <b>Specialist &amp; hospital</b>
                    <p className="small" style={{ margin: "4px 0" }}>
                      {t.nav_specialist_name ? <>{t.nav_specialist_name}{t.nav_specialist_specialty ? ` (${t.nav_specialist_specialty})` : ""}{t.nav_specialist_phone && <> · <a href={`tel:${t.nav_specialist_phone}`}>{t.nav_specialist_phone}</a></>}</> : "Any available specialist at the hospital"}<br />
                      <b>{t.nav_hospital_name || t.facility}</b>{t.nav_hospital_place ? `, ${t.nav_hospital_place}` : ""}<br />
                      {[t.nav_hospital_address, t.nav_hospital_phone].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <p className="small">
                  {t.appointment_slot ? <>Appointment ({t.appointment_kind}): {slotLabel(t.appointment_slot)} · {t.appointment_status}</> : "No appointment booked yet"}
                  {t.priority && <> · priority {t.priority}</>}
                </p>
                {t.contact_log && <pre className="small">{t.contact_log}</pre>}
                <div className="row">
                  <button className="sm" onClick={() => update(t.id, "IN_PROGRESS")}>Accept</button>
                  <button className="secondary sm" onClick={() => update(t.id, "OVERDUE")}>Escalate</button>
                  <button className="secondary sm" onClick={() => update(t.id, "CLOSED")}>Close after linkage</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
