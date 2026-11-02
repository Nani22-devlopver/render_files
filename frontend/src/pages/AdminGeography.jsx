import { useEffect, useState, useMemo } from "react";
import { api, currentUser } from "../api";
import { Icon, initials, Pill, Empty, Loading, toast, PageHead } from "../common";
import { GeoSelect, useGeo } from "../geo";

export default function AdminGeography() {
  const isSuper = currentUser()?.role === "super_admin";
  const { districts, ready, setDistricts } = useGeo();
  const [newDistricts, setNewDistricts] = useState("");
  const [mandalText, setMandalText] = useState({});
  const [err, setErr] = useState("");
  const [open, setOpen] = useState({});

  async function call(path, options, okText) {
    setErr("");
    try {
      const r = await api(path, options);
      if (r?.districts) setDistricts(r.districts);
      if (r?.districts) { try { localStorage.setItem("geoCache", JSON.stringify({ districts: r.districts })); } catch { /* ignore */ } }
      if (okText) toast(okText(r));
      return r;
    } catch (e) {
      setErr(e.message);
      return null;
    }
  }

  const summary = (r, what) =>
    `${r.added.length ? `Added ${r.added.length} ${what}` : "Nothing new added"}${r.skipped.length ? ` · ${r.skipped.length} already existed` : ""}`;

  async function addDistricts(e) {
    e.preventDefault();
    const r = await call("/admin/geo/districts", { method: "POST", body: JSON.stringify({ names: [newDistricts] }) }, (x) => summary(x, "district(s)"));
    if (r) setNewDistricts("");
  }

  async function addMandals(d) {
    const r = await call("/admin/geo/mandals", { method: "POST", body: JSON.stringify({ district_id: d.id, names: [mandalText[d.id] || ""] }) }, (x) => summary(x, "mandal(s)"));
    if (r) setMandalText({ ...mandalText, [d.id]: "" });
  }

  async function rename(kind, item) {
    const name = window.prompt(`Rename ${kind} "${item.name}" to:`, item.name);
    if (!name || name.trim() === item.name) return;
    await call(`/admin/geo/${kind}s/${item.id}`, { method: "PATCH", body: JSON.stringify({ name }) }, () => "Renamed — existing patient and staff records were updated too");
  }

  async function remove(kind, item) {
    if (!window.confirm(`Remove ${kind} "${item.name}" from the list?${kind === "district" ? " Its mandals are removed too." : ""}`)) return;
    setErr("");
    try {
      const r = await api(`/admin/geo/${kind}s/${item.id}`, { method: "DELETE" });
      setDistricts(r.districts);
      toast(`${item.name} removed`);
    } catch (e) {
      if (e.status === 409 && isSuper && window.confirm(`${e.message}.\n\nRemove it from the list anyway? Existing records keep their saved text.`)) {
        await call(`/admin/geo/${kind}s/${item.id}?force=true`, { method: "DELETE" }, () => `${item.name} removed`);
      } else {
        setErr(e.message);
      }
    }
  }

  return (
    <>
      <PageHead title="Districts & mandals" sub="This list fills the district and mandal dropdowns on every registration form and drives the district / mandal dashboards." />
      {err && <p className="err">{err}</p>}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add districts</h3>
        <form onSubmit={addDistricts}>
          <label>District names — one per line, or separated by commas</label>
          <textarea value={newDistricts} onChange={(e) => setNewDistricts(e.target.value)} placeholder={"Alluri Sitharama Raju\nVisakhapatnam"} required />
          <button type="submit">Add districts</button>
        </form>
      </div>

      {!ready ? <Loading /> : districts.length === 0 ? (
        <div className="card"><Empty icon="compass" text="No districts yet. Add your first district above." /></div>
      ) : districts.map((d) => (
        <div className="card" key={d.id}>
          <div className="geo-head">
            <h3>{d.name} <span className="small">· {d.mandals.length} mandal{d.mandals.length === 1 ? "" : "s"}</span></h3>
            <div className="row" style={{ margin: 0 }}>
              <button type="button" className="secondary sm" onClick={() => rename("district", d)}>Rename</button>
              <button type="button" className="secondary sm" onClick={() => remove("district", d)}>Remove</button>
            </div>
          </div>
          <div className="mchips">
            {d.mandals.length === 0 && <span className="small">No mandals yet.</span>}
            {d.mandals.map((m) => (
              <span className="mchip" key={m.id}>
                {m.name}
                <button type="button" className="ed" title="Rename" aria-label={`Rename ${m.name}`} onClick={() => rename("mandal", m)}>✎</button>
                <button type="button" title="Remove" aria-label={`Remove ${m.name}`} onClick={() => remove("mandal", m)}>✕</button>
              </span>
            ))}
          </div>
          <div className="row" style={{ marginBottom: 0 }}>
            <input
              value={mandalText[d.id] || ""}
              onChange={(e) => setMandalText({ ...mandalText, [d.id]: e.target.value })}
              placeholder="Add mandals — e.g. Paderu, Araku Valley, Chintapalle"
              aria-label={`Add mandals to ${d.name}`}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMandals(d); } }}
            />
            <button type="button" className="sm" disabled={!(mandalText[d.id] || "").trim()} onClick={() => addMandals(d)}>Add mandals</button>
          </div>
        </div>
      ))}
    </>
  );
}
