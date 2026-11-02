from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Patient, Referral, Screening, User


CLINICAL_ROLES = {"health_worker", "medical_officer", "specialist", "navigator"}


def audit(db: Session, actor_id: str | None, event: str, resource: str, meta: str | None = None):
    from .models import AuditEvent

    db.add(AuditEvent(actor_id=actor_id, event=event, resource=resource, metadata_json=meta))


def notify(db: Session, user_id: str, title: str, body: str, ref: str | None = None, kind: str = "info", expires_at=None):
    """Create an alert.

    kind="info": cleared once the action it asks for is taken (see clear_notifications / PATCH /notifications).
    kind="meet": a video-call link alert; it is never cleared by actions and disappears after its scheduled day (expires_at).
    """
    from .models import Notification

    db.add(Notification(user_id=user_id, title=title, body=body, ref=ref, kind=kind, expires_at=expires_at))


def clear_notifications(db: Session, ref: str, kind: str | None = "info") -> int:
    """Remove every alert about `ref` (default: only plain alerts, never video-link alerts)."""
    from .models import Notification

    q = db.query(Notification).filter(Notification.ref == ref)
    if kind:
        q = q.filter(Notification.kind == kind)
    return q.delete(synchronize_session=False)


def specialist_referral_filter(user: User):
    """A specialist only receives referrals the medical officer sent to them, or to their hospital without naming anyone."""
    from sqlalchemy import and_, or_

    own = Referral.specialist_id == user.id
    if not user.hospital_id:
        return own
    return or_(own, and_(Referral.specialist_id.is_(None), Referral.hospital_id == user.hospital_id))


def referral_visible(user: User, r: Referral) -> bool:
    if user.role != "specialist":
        return True
    return r.specialist_id == user.id or (r.specialist_id is None and bool(user.hospital_id) and r.hospital_id == user.hospital_id)


def patient_visible(user: User, patient: Patient) -> bool:
    if user.role == "super_admin":
        return True
    if user.role == "admin":
        return False
    if user.role == "health_worker":
        return patient.facility == user.assigned_facility
    if user.role == "medical_officer":
        return patient.facility == user.assigned_facility
    if user.role in {"specialist", "navigator"}:
        return True
    return False


def get_patient_or_404(db: Session, patient_id: str) -> Patient:
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")
    return patient


def assert_patient_access(user: User, patient: Patient, db: Session | None = None):
    if user.role == "super_admin":
        return
    if user.role == "admin":
        raise HTTPException(403, "Administrators receive aggregate data only")
    if user.role in {"specialist", "navigator"}:
        q = db.query(Referral).filter(Referral.patient_id == patient.id) if db else None
        if q is not None and user.role == "specialist":
            q = q.filter(specialist_referral_filter(user))
        if q is None or not q.first():
            raise HTTPException(403, "Access is limited to cases referred to you" if user.role == "specialist" else "Access is limited to referred cases")
        return
    if not patient_visible(user, patient):
        raise HTTPException(403, "Access denied for this patient record")


def assert_screening_access(db: Session, user: User, screening: Screening):
    patient = get_patient_or_404(db, screening.patient_id)
    assert_patient_access(user, patient, db)
    if user.role == "navigator":
        raise HTTPException(403, "Navigators cannot open screening photographs or exam notes")
