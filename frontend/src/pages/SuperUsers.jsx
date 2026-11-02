import { useEffect, useState, useMemo } from "react";
import { api, currentUser } from "../api";
import { Icon, initials, Pill, Empty, Loading, toast, PageHead } from "../common";
import { GeoSelect, useGeo } from "../geo";

const ROLES = [
  ["health_worker", "Health worker"],
  ["navigator", "Navigator"],
  ["medical_officer", "Medical officer"],
  ["specialist", "Specialist"],
  ["admin", "District admin"],
  ["super_admin", "Super admin"],
];
const roleLabel = Object.fromEntries(ROLES);
const STATUS_KIND = { active: "ok", pending: "warn", rejected: "bad", suspended: "bad" };
const STAFF = new Set(["health_worker", "navigator", "medical_officer", "specialist"]);
const EMPTY = { full_name: "", email: "", password: "", role: "admin", assigned_facility: "", district: "", mandal: "" };

export default function SuperUsers() {
  const me = currentUser();
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState("");
  const [edit, setEdit] = useState({});
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const load = () => api("/admin/users").then(setUsers).catch((e) => { setErr(e.message); setUsers([]); });
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create(e) {
    e.preventDefault();
    setErr(""); setOk("");
    try {
      const u = await api("/super/users", { method: "POST", body: JSON.stringify(form) });
      setOk(`${u.full_name} added as ${roleLabel[u.role]}. They can sign in right away.`);
      setForm(EMPTY);
      load();
    } catch (ex) { setErr(ex.message); }
  }

  function startEdit(u) {
    setEditId(u.id);
    setEdit({ full_name: u.full_name, email: u.email, role: u.role, status: u.status, assigned_facility: u.assigned_facility, district: u.district || "", mandal: u.mandal || "", password: "" });
    setErr(""); setOk("");
  }

  async function saveEdit(u) {
    setErr(""); setOk("");
    const body = { ...edit };
    if (!body.password) delete body.password;
    try {
      await api(`/super/users/${u.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setOk("Saved");
      setEditId("");
      load();
    } catch (ex) { setErr(ex.message); }
  }

  async function setStatus(u, action) {
    setErr(""); setOk("");
    let reason = "";
    if (action === "suspend") {
      reason = window.prompt(`Suspend ${u.full_name}? Their data stays saved.\n\nReason (optional):`, "");
      if (reason === null) return;
    }
    try {
      await api(`/admin/users/${u.id}/${action}`, { method: "POST", body: JSON.stringify({ reason }) });
      load();
    } catch (ex) { setErr(ex.message); }
  }

  async function remove(u) {
    if (!window.confirm(`Permanently delete ${u.full_name} (${u.email})? This cannot be undone.\n\nTip: Suspend keeps their history; delete removes the account.`)) return;
    setErr(""); setOk("");
    try {
      await api(`/super/users/${u.id}`, { method: "DELETE" });
      toast(`${u.full_name} deleted`);
      load();
    } catch (ex) {
      if (ex.status === 409 && !/super admin must remain/.test(ex.message) && window.confirm(`${ex.message}\n\nDelete the account AND the records that depend on it (their screenings, reviews, …)? Patients they registered are kept.`)) {
        try { await api(`/super/users/${u.id}?cascade=true`, { method: "DELETE" }); toast(`${u.full_name} deleted`); load(); } catch (e2) { setErr(e2.message); }
      } else setErr(ex.message);
    }
  }

  const list = (users || []).filter((u) => (!role || u.role === role) && `${u.full_name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <PageHead title="Users & admins" sub="Add district admins or any other account directly (no approval needed), edit details, reset passwords, suspend or delete." />
      {err && <p className="err">{err}</p>}
      {ok && <p className="okmsg">{ok}</p>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add an account</h3>
        <form onSubmit={create}>
          <div className="grid">
            <div><label>Full name</label><input value={form.full_name} onChange={set("full_name")} required minLength={2} /></div>
            <div><label>Email</label><input type="email" value={form.email} onChange={set("email")} required /></div>
            <div><label>Password (min 8 characters)</label><input type="password" value={form.password} onChange={set("password")} required minLength={8} autoComplete="new-password" /></div>
            <div>
              <label>Role</label>
              <select value={form.role} onChange={set("role")}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            {STAFF.has(form.role) && <GeoSelect district={form.district} mandal={form.mandal} onChange={(g) => setForm({ ...form, ...g })} />}
            <div><label>Facility (optional)</label><input value={form.assigned_facility} onChange={set("assigned_facility")} placeholder="PHC G. Madugula" /></div>
          </div>
          <button type="submit">Add account</button>
        </form>
      </div>

      <div className="card">
        <div className="row" style={{ marginTop: 0 }}>
          <div className="searchbox"><Icon n="search" s={16} /><input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search accounts" /></div>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
            <option value="">All roles</option>
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {users === null ? <Loading /> : list.length === 0 ? <Empty icon="users" text="No accounts found" /> : (
          <ul className="list">
            {list.map((u) => (
              <li key={u.id}>
                <div className="item-top">
                  <div className="item-main">
                    <span className="avatar">{initials(u.full_name)}</span>
                    <div><b>{u.full_name}</b><span>{u.email}{u.district ? ` · ${u.mandal || "—"}, ${u.district}` : ""}</span></div>
                  </div>
                  <span className="role-chip">{roleLabel[u.role] || u.role}</span>
                  <Pill kind={STATUS_KIND[u.status]}>{u.status}</Pill>
                  <div className="row" style={{ margin: 0 }}>
                    <button type="button" className="secondary sm" onClick={() => (editId === u.id ? setEditId("") : startEdit(u))}>{editId === u.id ? "Close" : "Edit"}</button>
                    {u.id !== me.id && u.status === "active" && <button type="button" className="secondary sm" onClick={() => setStatus(u, "suspend")}>Suspend</button>}
                    {u.id !== me.id && u.status === "suspended" && <button type="button" className="sm" onClick={() => setStatus(u, "reactivate")}>Reactivate</button>}
                    {u.id !== me.id && <button type="button" className="danger sm" onClick={() => remove(u)}>Delete</button>}
                  </div>
                </div>
                {editId === u.id && (
                  <div style={{ marginTop: 10 }}>
                    <div className="grid">
                      <div><label>Full name</label><input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></div>
                      <div><label>Email</label><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
                      <div>
                        <label>Role</label>
                        <select value={edit.role} disabled={u.id === me.id} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                      </div>
                      <div>
                        <label>Status</label>
                        <select value={edit.status} disabled={u.id === me.id} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                          {["active", "pending", "rejected", "suspended"].map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      {STAFF.has(edit.role) && <GeoSelect district={edit.district} mandal={edit.mandal} onChange={(g) => setEdit({ ...edit, ...g })} />}
                      <div><label>Facility</label><input value={edit.assigned_facility} onChange={(e) => setEdit({ ...edit, assigned_facility: e.target.value })} /></div>
                      <div><label>New password (leave blank to keep)</label><input type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} autoComplete="new-password" /></div>
                    </div>
                    <button type="button" className="sm" style={{ marginTop: 12 }} onClick={() => saveEdit(u)}>Save changes</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
