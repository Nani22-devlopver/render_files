import { useEffect, useState, useMemo } from "react";
import { Link, NavLink, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, clearSession, currentUser, enqueue, flushQueue, getQueue, getToken, newIdempotencyKey, setSession } from "../api";
import { GeoFilter, scopeQuery, scopeTitle } from "../geo";
import { useI18n, ICONS, Icon, initials, tone, Pill, toUploadable, AI_LABELS, URGENCY_KIND, URGENCY_TEXT, BulletList, AiFeedback, Empty, Loading, toast, Toasts, PageHead, slotLabel, localToSlot, slotToLocalInput, defaultSlotInput, weekdayLabel, isPast, DateTimePick } from "../common";

export default function Dashboard() {
  const isAdmin = ["admin", "super_admin"].includes(currentUser()?.role);
  const [d, setD] = useState(null);
  const [scope, setScope] = useState({ district: "", mandal: "" });
  useEffect(() => {
    api(`/dashboard/summary${isAdmin ? scopeQuery(scope) : ""}`).then(setD).catch((e) => toast(e.message));
  }, [scope.district, scope.mandal]);
  if (!d) return <Loading />;
  const nums = Object.entries(d).filter(([, v]) => typeof v === "number");
  const max = Math.max(1, ...nums.map(([, v]) => v));
  return (
    <>
      <PageHead title={isAdmin ? scopeTitle(d.scope, "Dashboard") : "District dashboard"} sub={d.note} />
      {isAdmin && <GeoFilter value={scope} onChange={setScope} />}
      <div className="kpis">
        {nums.map(([k, v]) => (
          <div className="kpi" key={k}>
            <i><Icon n="chart" s={18} /></i>
            <b>{v}</b>
            {k.replace(/_/g, " ")}
            <div className="bar"><span style={{ width: `${Math.round((v / max) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
      {isAdmin && (
        <div className="card" style={{ marginTop: 16 }}>
          <button
            className="secondary"
            onClick={async () => {
              if (!window.confirm("Reset ALL synthetic demo data (patients, screenings, referrals…)? User accounts and districts are kept.")) return;
              await api("/admin/reset-demo", { method: "POST" });
              setD(await api(`/dashboard/summary${scopeQuery(scope)}`));
              toast("Synthetic demo data reset");
            }}
          >
            Reset synthetic demo data
          </button>
        </div>
      )}
    </>
  );
}
