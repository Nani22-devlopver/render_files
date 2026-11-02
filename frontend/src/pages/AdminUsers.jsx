import { useEffect, useState, useMemo } from "react";
import { Link, NavLink, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, clearSession, currentUser, enqueue, flushQueue, getQueue, getToken, newIdempotencyKey, setSession } from "../api";
import { useI18n, ICONS, Icon, initials, tone, Pill, toUploadable, AI_LABELS, URGENCY_KIND, URGENCY_TEXT, BulletList, AiFeedback, Empty, Loading, toast, Toasts, PageHead, slotLabel, localToSlot, slotToLocalInput, defaultSlotInput, weekdayLabel, isPast, DateTimePick } from "../common";

const ROLE_TABS = [
  ["", "All"],
  ["health_worker", "Health workers"],
  ["navigator", "Navigators"],
  ["medical_officer", "Medical officers"],
  ["specialist", "Specialists"],
];
const METRIC_LABEL = {
  patients_registered: "Patients registered",
  screenings_done: "Screenings done",
  photos_uploaded: "Photos uploaded",
  awaiting_clinician: "Awaiting clinician",
  reviews_signed: "Reviews signed",
  referrals_created: "Referrals created",
  cases_waiting_review: "Cases waiting review",
  referrals_in_system: "Referrals in system",
  appointments_completed: "Appointments completed",
  appointments_open: "Appointments open",
  investigations_reviewed: "Investigations reviewed",
  investigations_pending: "Investigations pending",
  tasks_assigned: "Tasks assigned",
  tasks_open: "Tasks open",
  tasks_closed: "Tasks closed",
  unassigned_tasks: "Unassigned tasks",
  audit_events: "Recorded actions",
};
const ADMIN_TABS = [
  ["admin", "District admins"],
  ["super_admin", "Super admins"],
];
const STATUS_TABS = [
  ["", "Any status"],
  ["active", "Active"],
  ["pending", "Pending"],
  ["suspended", "Suspended"],
  ["rejected", "Declined"],
];
const ROLE_NAME = { admin: "district admin", super_admin: "super admin" };
const roleName = (r) => ROLE_NAME[r] || String(r).replace("_", " ");
const STATUS_KIND = { active: "ok", pending: "warn", rejected: "bad", suspended: "bad" };

export default function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState("");
  const [statusF, setStatusF] = useState("");
  const [busy, setBusy] = useState(false);
  const me = currentUser();
  const isSuper = me?.role === "super_admin";
  const roleTabs = isSuper ? [...ROLE_TABS, ...ADMIN_TABS] : ROLE_TABS;

  useEffect(() => {
    api("/admin/users").then(setUsers).catch((e) => { setErr(e.message); setUsers([]); });
  }, []);

  async function open(u) {
    setSel(u.id);
    setDetail(null);
    try {
      setDetail(await api(`/admin/users/${u.id}`));
    } catch (e) {
      setErr(e.message);
    }
  }

  function applyUpdated(u) {
    setUsers((rows) => rows.map((r) => (r.id === u.id ? u : r)));
    setDetail((d) => (d && d.user.id === u.id ? { ...d, user: u } : d));
  }

  async function suspend(u) {
    const reason = window.prompt(`Suspend ${u.full_name}?\n\nThey will be signed out and unable to log in. Their account and all records stay saved.\n\nReason (optional):`, "");
    if (reason === null) return;
    setBusy(true);
    setErr("");
    try {
      applyUpdated(await api(`/admin/users/${u.id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) }));
      toast(`${u.full_name} suspended`);
      window.dispatchEvent(new Event("pending-changed"));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reactivate(u) {
    setBusy(true);
    setErr("");
    try {
      applyUpdated(await api(`/admin/users/${u.id}/reactivate`, { method: "POST" }));
      toast(`${u.full_name} reactivated`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const counts = (users || []).reduce((m, u) => ({ ...m, [u.role]: (m[u.role] || 0) + 1 }), {});
  const list = (users || []).filter((u) => (!role || u.role === role) && (!statusF || u.status === statusF) && `${u.full_name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <PageHead title="Users" sub={isSuper ? "Every account, including district admins. Select one to see their work status, or to suspend / reactivate them." : "All health workers, navigators, medical officers and specialists. Select one to see their work status, or to suspend / reactivate them."} />
      {err && <p className="err">{err}</p>}
      <div className="demo-chips" style={{ marginBottom: 12 }}>
        {roleTabs.map(([k, l]) => (
          <button type="button" key={k || "all"} className={`chip ${role === k ? "on" : ""}`} onClick={() => setRole(k)}>
            {l} {users ? `(${k ? counts[k] || 0 : users.length})` : ""}
          </button>
        ))}
      </div>
      <div className="demo-chips" style={{ marginBottom: 12 }}>
        {STATUS_TABS.map(([k, l]) => (
          <button type="button" key={k || "any"} className={`chip ${statusF === k ? "on" : ""}`} onClick={() => setStatusF(k)}>
            {l} {users ? `(${k ? users.filter((u) => u.status === k).length : users.length})` : ""}
          </button>
        ))}
      </div>
      <div className="split">
        <aside className="split-list card">
          <div className="searchbox">
            <Icon n="search" s={16} />
            <input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
          </div>
          {users === null ? <Loading /> : list.length === 0 ? <Empty icon="users" text="No users found" /> : (
            <ul className="rec-list" style={{ marginTop: 10 }}>
              {list.map((u) => (
                <li key={u.id}>
                  <button type="button" className={`rec ${sel === u.id ? "on" : ""}`} onClick={() => open(u)}>
                    <span className="avatar">{initials(u.full_name)}</span>
                    <span className="rec-body"><b>{u.full_name}</b><span>{roleName(u.role)}</span></span>
                    <Pill kind={STATUS_KIND[u.status]}>{u.status}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="split-detail">
          {!sel ? (
            <div className="card"><Empty icon="users" text="Select a user to see their details and work status" /></div>
          ) : !detail ? <Loading /> : (
            <>
              <div className="card">
                <div className="item-top">
                  <div className="item-main">
                    <span className="avatar">{initials(detail.user.full_name)}</span>
                    <div><b style={{ fontSize: "1.1rem" }}>{detail.user.full_name}</b><span>{detail.user.email}</span></div>
                  </div>
                  <Pill kind={STATUS_KIND[detail.user.status]}>{detail.user.status}</Pill>
                </div>
                <dl className="facts">
                  <dt>Designation</dt><dd style={{ textTransform: "capitalize" }}>{roleName(detail.user.role)}</dd>
                  <dt>Facility</dt><dd>{detail.user.assigned_facility}</dd>
                  <dt>District</dt><dd>{detail.user.district || "—"}</dd>
                  <dt>Mandal</dt><dd>{detail.user.mandal || "—"}</dd>
                  <dt>Registered</dt><dd>{detail.user.created_at ? new Date(detail.user.created_at).toLocaleString() : "—"}</dd>
                  <dt>Last activity</dt><dd>{detail.work.last_activity ? new Date(detail.work.last_activity).toLocaleString() : "No activity yet"}</dd>
                </dl>
                {detail.user.status === "suspended" && (
                  <div className="suspend-note">
                    Suspended {detail.user.suspended_at ? new Date(detail.user.suspended_at).toLocaleString() : ""}
                    {detail.user.suspension_reason ? ` — ${detail.user.suspension_reason}` : ""}. Their data is kept; they cannot sign in.
                  </div>
                )}
                {detail.user.id !== me?.id && (
                  <div className="row" style={{ marginTop: 14 }}>
                    {detail.user.status === "active" && (
                      <button type="button" className="danger sm" disabled={busy} onClick={() => suspend(detail.user)}>Suspend user</button>
                    )}
                    {detail.user.status === "suspended" && (
                      <button type="button" className="sm" disabled={busy} onClick={() => reactivate(detail.user)}>Reactivate user</button>
                    )}
                  </div>
                )}
              </div>
              <div className="card">
                <h3>Work status</h3>
                <div className="kpis">
                  {Object.entries(detail.work.metrics).map(([k, v]) => (
                    <div className="kpi" key={k}><b>{v}</b>{METRIC_LABEL[k] || k.replace(/_/g, " ")}</div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h3>Recent activity</h3>
                {detail.work.recent_activity.length === 0 ? <p className="small">No recorded actions yet.</p> : (
                  <ul className="timeline">
                    {detail.work.recent_activity.map((a, i) => (
                      <li key={i}><b>{a.event}</b><span>{new Date(a.created_at).toLocaleString()}</span>{a.resource}</li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
