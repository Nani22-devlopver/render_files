import { useEffect, useState, useMemo } from "react";
import { Link, NavLink, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, clearSession, currentUser, enqueue, flushQueue, getQueue, getToken, newIdempotencyKey, setSession } from "../api";
import { useI18n, ICONS, Icon, initials, tone, Pill, toUploadable, AI_LABELS, URGENCY_KIND, URGENCY_TEXT, BulletList, AiFeedback, Empty, Loading, toast, Toasts, PageHead, slotLabel, localToSlot, slotToLocalInput, defaultSlotInput, weekdayLabel, isPast, DateTimePick } from "../common";

const APPT = /\s*\[appt:([0-9a-f-]{36})\]/;
const XREQ = /\s*\[xmandal:([0-9a-f-]{36})\]/;

export default function Notes() {
  const [rows, setRows] = useState([]);
  const load = () => api("/notifications").then(setRows);
  useEffect(() => { load(); }, []);
  // Plain alerts disappear once you act on them (open them or press Done). Google Meet link alerts stay until their scheduled day is over.
  async function markRead(n) {
    if ((n.kind === "meet" || n.action_pending) && n.read) return;
    await api(`/notifications/${n.id}`, { method: "PATCH" });
    window.dispatchEvent(new Event("notes-changed"));
    load();
  }
  return (
    <>
      <PageHead title="Notifications" sub="Alerts clear once you act on them (requests clear when they are answered). Video-call links stay until the scheduled day is over. Reminders omit clinical details." />
      <div className="card">
        {rows.length === 0 ? <Empty icon="bell" text="You're all caught up" /> : (
          <ul className="list">
            {rows.map((n) => {
              const m = n.body.match(APPT);
              const isVideo = n.kind === "meet";
              const x = n.body.match(XREQ);
              return (
                <li key={n.id} className={n.read ? "" : "unread"} onClick={() => markRead(n)}>
                  <div className="item-top">
                    <b>{n.title}</b>
                    <span className="small">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p className="small">{n.body.replace(APPT, "").replace(XREQ, "")}</p>
                  {m && isVideo && <Link to={`/video/${m[1]}`}><Icon n="video" s={14} /> Join video call</Link>}
                  {m && !isVideo && <Link to="/appointments">View appointment</Link>}
                  {x && <Link to="/cross-mandal">Review request</Link>}
                  {n.kind === "meet" && n.expires_at && <p className="small">Shown until the end of {new Date(n.expires_at).toLocaleDateString()}</p>}
                  {n.kind !== "meet" && !n.action_pending && <button type="button" className="secondary sm" onClick={(e) => { e.stopPropagation(); markRead(n); }}>Done</button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
