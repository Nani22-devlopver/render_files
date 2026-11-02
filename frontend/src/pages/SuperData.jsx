import { useEffect, useState, useMemo } from "react";
import { api, currentUser } from "../api";
import { Icon, initials, Pill, Empty, Loading, toast, PageHead } from "../common";
import { GeoSelect, useGeo } from "../geo";

const short = (v) => (v === null || v === undefined ? "—" : typeof v === "boolean" ? (v ? "true" : "false") : String(v));

export default function SuperData() {
  const [tables, setTables] = useState(null);
  const [table, setTable] = useState("");
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [editor, setEditor] = useState(null); // { id|null, text }
  const [err, setErr] = useState("");
  const LIMIT = 25;

  useEffect(() => {
    api("/super/data").then((t) => { setTables(t); if (t.length) setTable(t[0].table); }).catch((e) => { setErr(e.message); setTables([]); });
  }, []);

  const load = (t = table, query = q, off = offset) => {
    if (!t) return;
    setData(null);
    api(`/super/data/${t}?limit=${LIMIT}&offset=${off}${query ? `&q=${encodeURIComponent(query)}` : ""}`).then(setData).catch((e) => { setErr(e.message); setData({ columns: [], rows: [], total: 0 }); });
  };
  useEffect(() => { setOffset(0); setQ(""); setEditor(null); setErr(""); load(table, "", 0); }, [table]);

  const cols = data?.columns || [];
  const pk = cols.find((c) => c.pk)?.name || "id";

  function openEditor(row) {
    if (row) {
      const body = { ...row };
      setEditor({ id: row[pk], text: JSON.stringify(body, null, 2) });
    } else {
      const tpl = {};
      cols.forEach((c) => { if (!c.pk && c.name !== "created_at") tpl[c.name] = c.type === "boolean" ? false : null; });
      if (table === "users") tpl.password = "";
      setEditor({ id: null, text: JSON.stringify(tpl, null, 2) });
    }
    setErr("");
  }

  async function save() {
    let body;
    try { body = JSON.parse(editor.text); } catch { setErr("That is not valid JSON"); return; }
    setErr("");
    try {
      if (editor.id) await api(`/super/data/${table}/${editor.id}`, { method: "PATCH", body: JSON.stringify({ data: body }) });
      else await api(`/super/data/${table}`, { method: "POST", body: JSON.stringify({ data: body }) });
      toast(editor.id ? "Row updated" : "Row added");
      setEditor(null);
      load();
      api("/super/data").then(setTables).catch(() => {});
    } catch (e) { setErr(e.message); }
  }

  async function remove(row) {
    if (!window.confirm(`Delete this ${table} row (${row[pk]})? This cannot be undone.`)) return;
    setErr("");
    try {
      await api(`/super/data/${table}/${row[pk]}`, { method: "DELETE" });
      toast("Row deleted");
    } catch (e) {
      if (e.status === 409 && window.confirm(`${e.message}\n\nCascade delete: also delete every record that depends on this row (optional links are just cleared). Continue?`)) {
        try { await api(`/super/data/${table}/${row[pk]}?cascade=true`, { method: "DELETE" }); toast("Row and dependent records deleted"); } catch (e2) { setErr(e2.message); return; }
      } else { setErr(e.message); return; }
    }
    load();
    api("/super/data").then(setTables).catch(() => {});
  }

  const shown = useMemo(() => cols.slice(0, 8), [data]);
  const total = data?.total || 0;

  return (
    <>
      <PageHead title="Data manager" sub="Super admin only. View, add, edit or delete any record in any table. Every change is written to the audit trail." />
      {err && <p className="err">{err}</p>}
      <div className="card">
        <div className="row" style={{ marginTop: 0 }}>
          <select value={table} onChange={(e) => setTable(e.target.value)} aria-label="Table">
            {(tables || []).map((t) => <option key={t.table} value={t.table}>{t.table} ({t.rows})</option>)}
          </select>
          <div className="searchbox"><Icon n="search" s={16} /><input placeholder="Search text columns" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setOffset(0); load(table, q, 0); } }} aria-label="Search rows" /></div>
          <button type="button" className="secondary sm" onClick={() => { setOffset(0); load(table, q, 0); }}>Search</button>
          <button type="button" className="sm" onClick={() => openEditor(null)} disabled={!data}>Add row</button>
        </div>

        {editor && (
          <div style={{ margin: "14px 0" }}>
            <label>{editor.id ? `Edit ${table} row` : `New ${table} row`} (JSON — only include the columns you want to set{table === "users" ? "; use \"password\" to set a password" : ""})</label>
            <textarea className="json-edit" value={editor.text} onChange={(e) => setEditor({ ...editor, text: e.target.value })} spellCheck={false} />
            <div className="row">
              <button type="button" className="sm" onClick={save}>{editor.id ? "Save changes" : "Add row"}</button>
              <button type="button" className="secondary sm" onClick={() => setEditor(null)}>Cancel</button>
            </div>
          </div>
        )}

        {data === null ? <Loading /> : data.rows.length === 0 ? <Empty icon="inbox" text="No rows" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>{shown.map((c) => <th key={c.name}>{c.name}</th>)}<th></th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r[pk]}>
                    {shown.map((c) => <td key={c.name}><div className="cell-trunc" title={short(r[c.name])}>{short(r[c.name])}</div></td>)}
                    <td>
                      <div className="row" style={{ margin: 0, flexWrap: "nowrap" }}>
                        <button type="button" className="secondary sm" onClick={() => openEditor(r)}>Edit</button>
                        <button type="button" className="danger sm" onClick={() => remove(r)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && total > 0 && (
          <div className="row">
            <span className="small">{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}{cols.length > shown.length ? ` · showing the first ${shown.length} of ${cols.length} columns (Edit shows all)` : ""}</span>
            <button type="button" className="secondary sm" disabled={offset === 0} onClick={() => { const o = Math.max(0, offset - LIMIT); setOffset(o); load(table, q, o); }}>Previous</button>
            <button type="button" className="secondary sm" disabled={offset + LIMIT >= total} onClick={() => { const o = offset + LIMIT; setOffset(o); load(table, q, o); }}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}
