import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { Icon, Pill, Empty, Loading, PageHead } from "../common";
import { GeoFilter, scopeQuery, scopeTitle } from "../geo";

const nice = (k) => String(k).replace(/_/g, " ").toLowerCase();

function Bars({ data, color = "var(--indigo)" }) {
  const rows = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <p className="small">No data yet.</p>;
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return rows.map(([k, v]) => (
    <div className="bar-row" key={k} style={{ margin: "10px 0" }}>
      <div className="bar-top"><span style={{ textTransform: "capitalize" }}>{nice(k)}</span><b>{v}</b></div>
      <div className="bar"><span style={{ width: `${Math.round((v / max) * 100)}%`, background: color }} /></div>
    </div>
  ));
}

function Panel({ title, children }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  );
}

function Trend({ points }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
      {points.map((p) => (
        <div key={p.date} title={`${p.date}: ${p.count}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
          <span className="small" style={{ fontSize: 10 }}>{p.count || ""}</span>
          <div style={{ width: "100%", height: `${Math.max(3, (p.count / max) * 90)}%`, background: p.count ? "var(--indigo)" : "#dfe3f1", borderRadius: 3 }} />
        </div>
      ))}
    </div>
  );
}

function AreaTable({ rows, label, onPick }) {
  if (!rows.length) return <Empty text="No area data yet" />;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>{label}</th><th>Patients</th><th>Screenings</th><th>Referrals</th></tr></thead>
        <tbody>
          {rows.map((a) => {
            const open = onPick && a.area !== "Unspecified";
            return (
              <tr key={a.area} className={open ? "pick" : ""} onClick={open ? () => onPick(a.area) : undefined}>
                <td>{a.area}</td><td>{a.patients}</td><td>{a.screenings}</td><td>{a.referrals}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminMonitoring() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState({ district: "", mandal: "" });

  const load = useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      setD(await api(`/admin/monitoring${scopeQuery(scope)}`));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [scope.district, scope.mandal]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  if (err && !d) return <><PageHead title="District monitoring" /><p className="err">{err}</p></>;
  if (!d) return <Loading />;

  const fmax = Math.max(1, ...d.funnel.map((f) => f.value));
  const roles = Object.entries(d.staff.by_role);

  return (
    <>
      <PageHead title={scopeTitle(d.scope, "Monitoring")} sub={d.note}>
        <button className="secondary" onClick={load} disabled={busy}>Refresh</button>
      </PageHead>
      <GeoFilter value={scope} onChange={setScope} />
      {err && <p className="err">{err}</p>}

      <div className="kpis">
        {d.funnel.map((f) => (
          <div className="kpi" key={f.stage}>
            <i><Icon n="chart" s={18} /></i>
            <b>{f.value}</b>
            {f.stage}
            <div className="bar"><span style={{ width: `${Math.round((f.value / fmax) * 100)}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginTop: 16 }}>
        <Panel title="Needs attention">
          {d.alerts.map((a) => (
            <div key={a.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
              <span>{a.label}</span>
              <Pill kind={a.value === 0 ? "ok" : a.kind}>{a.value}</Pill>
            </div>
          ))}
        </Panel>
        <Panel title="Screenings — last 14 days"><Trend points={d.trend} /></Panel>
        <Panel title="Staff (active)">
          {roles.length ? roles.map(([r, n]) => (
            <div key={r} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
              <span style={{ textTransform: "capitalize" }}>{nice(r)}</span><b>{n}</b>
            </div>
          )) : <p className="small">No active staff.</p>}
          <p className="small" style={{ marginTop: 8 }}>Pending approvals: <b>{d.staff.pending}</b> · Suspended: <b>{d.staff.suspended}</b></p>
        </Panel>
      </div>

      {!scope.district && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>District-wise activity</h3>
          <p className="small">Select a row to open that district's dashboard.</p>
          <AreaTable rows={d.by_district} label="District" onPick={(name) => setScope({ district: name, mandal: "" })} />
        </div>
      )}

      {!scope.mandal && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Mandal-wise activity{scope.district ? ` — ${scope.district}` : ""}</h3>
          {scope.district && <p className="small">Select a row to open that mandal's dashboard.</p>}
          <AreaTable rows={d.by_area} label="Mandal" onPick={scope.district ? (name) => setScope({ district: scope.district, mandal: name }) : null} />
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, marginTop: 16 }}>
        <Panel title="Screening status"><Bars data={d.screening_status} /></Panel>
        <Panel title="Referral status"><Bars data={d.referral_status} color="#1f8a70" /></Panel>
        <Panel title="Referral priority"><Bars data={d.referral_priority} color="var(--madder)" /></Panel>
        <Panel title="Appointments"><Bars data={d.appointment_status} color="var(--turmeric)" /></Panel>
        <Panel title="Investigations"><Bars data={d.investigation_state} /></Panel>
        <Panel title="Patient navigation"><Bars data={d.navigation_status} color="#1f8a70" /></Panel>
        <Panel title="AI screening labels (research only)"><Bars data={d.ai_labels} color="var(--madder)" /></Panel>
      </div>
      <p className="small" style={{ marginTop: 12 }}>Updated {new Date(d.generated_at).toLocaleString()} · auto-refreshes every minute</p>
    </>
  );
}
