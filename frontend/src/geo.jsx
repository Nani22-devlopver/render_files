import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

const CACHE_KEY = "geoCache";

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "null")?.districts || null;
  } catch {
    return null;
  }
}

// District -> mandal master list. Cached so registration forms still work offline.
export function useGeo() {
  const [districts, setDistricts] = useState(() => readCache());
  const reload = useCallback(async () => {
    try {
      const r = await api("/geo");
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(r)); } catch { /* storage full/unavailable */ }
      setDistricts(r.districts);
    } catch {
      setDistricts((d) => d || []);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { districts: districts || [], ready: districts !== null, reload, setDistricts };
}

// Two linked dropdowns for registration forms (district first, then that district's mandals).
// Falls back to plain text boxes only while the admin has not created any district yet.
export function GeoSelect({ district, mandal, onChange, districtLabel = "District", mandalLabel = "Mandal", required = true }) {
  const { districts, ready } = useGeo();
  const current = districts.find((d) => d.name === district);
  if (ready && districts.length === 0) {
    return (
      <>
        <div>
          <label>{districtLabel}</label>
          <input value={district || ""} onChange={(e) => onChange({ district: e.target.value, mandal })} required={required} />
        </div>
        <div>
          <label>{mandalLabel}</label>
          <input value={mandal || ""} onChange={(e) => onChange({ district, mandal: e.target.value })} required={required} />
        </div>
      </>
    );
  }
  return (
    <>
      <div>
        <label>{districtLabel}</label>
        <select
          value={district || ""}
          required={required}
          onChange={(e) => {
            const next = districts.find((d) => d.name === e.target.value);
            const keep = next?.mandals.some((m) => m.name === mandal) ? mandal : "";
            onChange({ district: e.target.value, mandal: keep });
          }}
        >
          <option value="">Select district</option>
          {districts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label>{mandalLabel}</label>
        <select value={mandal || ""} required={required} disabled={!current} onChange={(e) => onChange({ district, mandal: e.target.value })}>
          <option value="">{current ? "Select mandal" : "Select a district first"}</option>
          {(current?.mandals || []).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
      </div>
    </>
  );
}

// "View: [All districts v] [All mandals v]" switcher for the district / mandal level dashboards.
export function GeoFilter({ value, onChange }) {
  const { districts } = useGeo();
  const current = districts.find((d) => d.name === value.district);
  return (
    <div className="card geo-filter">
      <div className="row" style={{ margin: 0 }}>
        <b>Dashboard level</b>
        <select
          aria-label="District"
          value={value.district}
          onChange={(e) => onChange({ district: e.target.value, mandal: "" })}
        >
          <option value="">All districts</option>
          {districts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select
          aria-label="Mandal"
          value={value.mandal}
          disabled={!current}
          onChange={(e) => onChange({ district: value.district, mandal: e.target.value })}
        >
          <option value="">{current ? "All mandals in district" : "Select a district to pick a mandal"}</option>
          {(current?.mandals || []).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
        {(value.district || value.mandal) && (
          <button type="button" className="secondary sm" onClick={() => onChange({ district: "", mandal: "" })}>Show all</button>
        )}
      </div>
    </div>
  );
}

export function scopeQuery(scope) {
  const qs = new URLSearchParams();
  if (scope.district) qs.set("district", scope.district);
  if (scope.mandal) qs.set("mandal", scope.mandal);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function scopeTitle(scope, base) {
  if (scope?.mandal) return `${scope.mandal} mandal — ${scope.district}`;
  if (scope?.district) return `${scope.district} district`;
  return `${base} · all districts`;
}
