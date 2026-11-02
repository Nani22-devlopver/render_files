import { useEffect, useMemo, useState } from "react";
import { api, currentUser } from "../api";
import { Empty, Loading, Pill, toast, PageHead } from "../common";
import { GeoSelect } from "../geo";

const EMPTY = { full_name: "", email: "", password: "", phone: "", specialty: "", hospital_id: "" };

// District admin: register the doctors of each hospital. A specialist only receives patients the medical officer refers to them / their hospital.
export default function Specialists() {
  const me = currentUser();
  const [rows, setRows] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [geo, setGeo] = useState({ district: me?.role === "admin" ? me.district || "" : "", mandal: "" });
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState("");
  const [edit, setEdit] = useState({});
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const load = () =>
    Promise.all([api("/specialists?include_inactive=true"), api("/hospitals?include_unavailable=true")])
      .then(([s, h]) => { setRows(s); setHospitals(h); })
      .catch((e) => { setErr(e.message); setRows([]); });
  useEffect(() => { load(); }, []);

  const geoHospitals = useMemo(() => hospitals.filter((h) => (!geo.district || h.district === geo.district) && (!geo.mandal || h.mandal === geo.mandal)), [hospitals, geo]);
  const shown = useMemo(() => (rows || []).filter((u) => !q || `${u.full_name} ${u.email} ${u.hospital_name || ""} ${u.specialty || ""}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setE = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  async function run(fn, ok) {
    setErr("");
    try { await fn(); if (ok) toast(ok); await load(); } catch (x) { setErr(x.message); }
  }
  const add = (e) => { e.preventDefault(); run(async () => { await api("/specialists", { method: "POST", body: JSON.stringify(form) }); setForm({ ...EMPTY, hospital_id: form.hospital_id }); }, "Specialist registered"); };
  const save = (id) => run(async () => { await api(`/specialists/${id}`, { method: "PATCH", body: JSON.stringify(edit) }); setEditId(""); }, "Specialist updated");
  const toggle = (u) => run(() => api(`/specialists/${u.id}`, { method: "PATCH", body: JSON.stringify({ available: !u.available }) }), u.available ? "Marked unavailable" : "Marked available");
  const remove = (u) => { if (window.confirm(`Remove ${u.full_name}? This cannot be undone.`)) run(() => api(`/specialists/${u.id}`, { method: "DELETE" }), "Specialist removed"); };

  return (
    <>
      <PageHead title="Specialists" sub="Register the doctors of each hospital. They only receive patients that a medical officer refers to them or to their hospital." />
      {err && <p className="err">{err}</p>}
      <form className="card" onSubmit={add}>
        <h3 style={{ marginTop: 0 }}>Register a specialist</h3>
        <label>Name</label>
        <input value={form.full_name} onChange={setF("full_name")} required minLength={2} placeholder="Dr. Name" />
        <GeoSelect required={false} district={geo.district} mandal={geo.mandal} districtLabel="Hospital district" mandalLabel="Hospital mandal" onChange={(g) => { setGeo(g); setForm({ ...form, hospital_id: "" }); }} />
        <label>Hospital</label>
        <select value={form.hospital_id} onChange={setF("hospital_id")} required>
          <option value="">{geoHospitals.length ? "Select hospital" : "No hospitals here — add one under Hospitals"}</option>
          {geoHospitals.map((h) => <option key={h.id} value={h.id}>{h.name} — {h.mandal}</option>)}
        </select>
        <div className="row">
          <input value={form.specialty} onChange={setF("specialty")} placeholder="Specialty (e.g. Oral surgery / ENT)" />
          <input value={form.phone} onChange={setF("phone")} placeholder="Phone" inputMode="tel" />
        </div>
        <div className="row">
          <input type="email" value={form.email} onChange={setF("email")} placeholder="Login email" required />
          <input type="password" value={form.password} onChange={setF("password")} placeholder="Initial password (8+ characters)" required minLength={8} />
        </div>
        <button type="submit">Register specialist</button>
      </form>

      <div className="card">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search specialists" aria-label="Search specialists" />
        {rows === null ? <Loading /> : shown.length === 0 ? <Empty icon="users" text="No specialists registered" /> : (
          <ul className="list" style={{ marginTop: 12 }}>
            {shown.map((u) => (
              <li key={u.id}>
                {editId === u.id ? (
                  <>
                    <input value={edit.full_name ?? u.full_name} onChange={setE("full_name")} aria-label="Name" />
                    <select value={edit.hospital_id ?? u.hospital_id ?? ""} onChange={setE("hospital_id")} aria-label="Hospital">
                      <option value="">No hospital</option>
                      {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name} — {h.mandal}, {h.district}</option>)}
                    </select>
                    <div className="row">
                      <input value={edit.specialty ?? u.specialty ?? ""} onChange={setE("specialty")} placeholder="Specialty" />
                      <input value={edit.phone ?? u.phone ?? ""} onChange={setE("phone")} placeholder="Phone" />
                    </div>
                    <input type="password" value={edit.password || ""} onChange={setE("password")} placeholder="New password (leave empty to keep)" />
                    <div className="row">
                      <button className="sm" onClick={() => save(u.id)}>Save</button>
                      <button className="secondary sm" onClick={() => setEditId("")}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="item-top">
                      <span><b>{u.full_name}</b> · {u.hospital_name ? `${u.hospital_name}, ${u.hospital_mandal}` : "No hospital assigned"}</span>
                      <Pill kind={u.available ? "ok" : "bad"}>{u.status === "pending" ? "Awaiting approval" : u.available ? "Available" : "Unavailable"}</Pill>
                    </div>
                    <p className="small">{[u.specialty, u.phone, u.email].filter(Boolean).join(" · ")}</p>
                    <div className="row">
                      <button className="secondary sm" onClick={() => { setEditId(u.id); setEdit({}); }}>Edit</button>
                      <button className="secondary sm" onClick={() => toggle(u)}>{u.status === "pending" ? "Approve" : u.available ? "Mark unavailable" : "Mark available"}</button>
                      <button className="secondary sm" onClick={() => remove(u)}>Remove</button>
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
