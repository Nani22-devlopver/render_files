import { useEffect, useMemo, useState } from "react";
import { api, currentUser } from "../api";
import { Empty, Loading, Pill, toast, PageHead } from "../common";
import { GeoSelect } from "../geo";

const EMPTY = { name: "", district: "", mandal: "", address: "", contact_phone: "", contact_email: "" };

// District admin: add and manage the hospitals that patients can be referred to, grouped by district and mandal.
export default function Hospitals() {
  const me = currentUser();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ ...EMPTY, district: me?.role === "admin" ? me.district || "" : "" });
  const [editId, setEditId] = useState("");
  const [edit, setEdit] = useState({});
  const [filter, setFilter] = useState({ district: "", mandal: "" });
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const load = () =>
    api("/hospitals?include_unavailable=true").then(setRows).catch((e) => { setErr(e.message); setRows([]); });
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (rows || []).filter((h) =>
    (!filter.district || h.district === filter.district) &&
    (!filter.mandal || h.mandal === filter.mandal) &&
    (!q || `${h.name} ${h.address || ""}`.toLowerCase().includes(q.toLowerCase()))
  ), [rows, filter, q]);

  async function add(e) {
    e.preventDefault();
    setErr("");
    try {
      await api("/hospitals", { method: "POST", body: JSON.stringify(form) });
      toast("Hospital added");
      setForm({ ...EMPTY, district: form.district, mandal: form.mandal });
      await load();
    } catch (x) { setErr(x.message); }
  }

  async function save(id) {
    setErr("");
    try {
      await api(`/hospitals/${id}`, { method: "PATCH", body: JSON.stringify(edit) });
      toast("Hospital updated");
      setEditId("");
      await load();
    } catch (x) { setErr(x.message); }
  }

  async function toggle(h) {
    setErr("");
    try {
      await api(`/hospitals/${h.id}`, { method: "PATCH", body: JSON.stringify({ available: !h.available }) });
      toast(h.available ? "Hidden from booking" : "Available for booking");
      await load();
    } catch (x) { setErr(x.message); }
  }

  async function remove(h) {
    if (!window.confirm(`Remove ${h.name}? This cannot be undone.`)) return;
    setErr("");
    try {
      await api(`/hospitals/${h.id}`, { method: "DELETE" });
      toast("Hospital removed");
      await load();
    } catch (x) { setErr(x.message); }
  }

  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setE = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  return (
    <>
      <PageHead title="Hospitals" sub="Add and update the hospitals of each mandal. Medical officers choose from this list when they refer a patient." />
      {err && <p className="err">{err}</p>}
      <form className="card" onSubmit={add}>
        <h3 style={{ marginTop: 0 }}>Add a hospital</h3>
        <label>Hospital name</label>
        <input value={form.name} onChange={setF("name")} required minLength={3} placeholder="e.g. Area Hospital Paderu" />
        <GeoSelect district={form.district} mandal={form.mandal} onChange={(g) => setForm({ ...form, ...g })} />
        <label>Address</label>
        <input value={form.address} onChange={setF("address")} placeholder="Street, village" />
        <div className="row">
          <input value={form.contact_phone} onChange={setF("contact_phone")} placeholder="Contact phone" inputMode="tel" />
          <input type="email" value={form.contact_email} onChange={setF("contact_email")} placeholder="Contact email (optional)" />
        </div>
        <button type="submit">Add hospital</button>
      </form>

      <div className="card">
        <div className="row" style={{ marginTop: 0 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hospitals" aria-label="Search hospitals" />
        </div>
        <div className="row"><GeoSelect required={false} district={filter.district} mandal={filter.mandal} districtLabel="Show district" mandalLabel="Show mandal" onChange={setFilter} /></div>
        {rows === null ? <Loading /> : shown.length === 0 ? <Empty icon="inbox" text="No hospitals found" /> : (
          <ul className="list">
            {shown.map((h) => (
              <li key={h.id}>
                {editId === h.id ? (
                  <>
                    <input value={edit.name ?? h.name} onChange={setE("name")} aria-label="Hospital name" />
                    <GeoSelect district={edit.district ?? h.district} mandal={edit.mandal ?? h.mandal} onChange={(g) => setEdit({ ...edit, ...g })} />
                    <input value={edit.address ?? h.address ?? ""} onChange={setE("address")} placeholder="Address" />
                    <div className="row">
                      <input value={edit.contact_phone ?? h.contact_phone ?? ""} onChange={setE("contact_phone")} placeholder="Contact phone" />
                      <input value={edit.contact_email ?? h.contact_email ?? ""} onChange={setE("contact_email")} placeholder="Contact email" />
                    </div>
                    <div className="row">
                      <button className="sm" onClick={() => save(h.id)}>Save</button>
                      <button className="secondary sm" onClick={() => setEditId("")}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="item-top">
                      <span><b>{h.name}</b> · {h.mandal}, {h.district}</span>
                      <Pill kind={h.available ? "ok" : "bad"}>{h.available ? "Available" : "Hidden"}</Pill>
                    </div>
                    <p className="small">{[h.address, h.contact_phone, h.contact_email].filter(Boolean).join(" · ") || "No contact details yet"}</p>
                    <div className="row">
                      <button className="secondary sm" onClick={() => { setEditId(h.id); setEdit({}); }}>Edit</button>
                      <button className="secondary sm" onClick={() => toggle(h)}>{h.available ? "Mark unavailable" : "Mark available"}</button>
                      <button className="secondary sm" onClick={() => remove(h)}>Remove</button>
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
