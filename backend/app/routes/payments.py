from datetime import datetime

from flask import Blueprint, request

from ..auth import is_admin, require_user
from ..db import get_db
from ..models import Match, MatchMember, PaymentInfo, PaymentRequest, PaymentStatus
from ..utils import err, ok

bp = Blueprint("payments", __name__, url_prefix="/matches/<int:match_id>")


def _require_organizer(db, match_id: int, tg_id: int) -> bool:
    member = (
        db.query(MatchMember)
        .filter_by(match_id=match_id, tg_id=tg_id, role="organizer")
        .one_or_none()
    )
    return member is not None


@bp.post("/payer/request")
def payer_request(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    req = db.query(PaymentRequest).filter_by(match_id=match_id, tg_id=user.tg_id).one_or_none()
    if req is None:
        db.add(PaymentRequest(match_id=match_id, tg_id=user.tg_id, status="pending"))
    else:
        req.status = "pending"
    db.commit()
    return ok()


@bp.post("/payer/offer")
def payer_offer(match_id: int):
    user = require_user()
    db = get_db()
    if not (is_admin(user) or _require_organizer(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    info = db.query(PaymentInfo).filter_by(match_id=match_id).one_or_none()
    if info and info.payer_tg_id:
        return err("payer_already_set", 400)
    data = request.get_json(silent=True) or {}
    target_tg_id = data.get("tg_id")
    if not target_tg_id:
        return err("missing_tg_id", 400)
    db.query(PaymentRequest).filter_by(match_id=match_id, status="offered").update(
        {"status": "canceled"}
    )
    req = db.query(PaymentRequest).filter_by(match_id=match_id, tg_id=target_tg_id).one_or_none()
    if req is None:
        db.add(PaymentRequest(match_id=match_id, tg_id=target_tg_id, status="offered"))
    else:
        req.status = "offered"
    db.commit()
    return ok()


@bp.post("/payer/respond")
def payer_respond(match_id: int):
    user = require_user()
    db = get_db()
    data = request.get_json(silent=True) or {}
    accepted = bool(data.get("accepted", False))
    req = db.query(PaymentRequest).filter_by(match_id=match_id, tg_id=user.tg_id).one_or_none()
    if req is None or req.status != "offered":
        return err("no_offer", 400)
    req.status = "accepted" if accepted else "declined"
    if accepted:
        info = db.query(PaymentInfo).filter_by(match_id=match_id).one_or_none()
        if info is None:
            info = PaymentInfo(match_id=match_id, payer_tg_id=user.tg_id, status="chosen")
            db.add(info)
        else:
            info.payer_tg_id = user.tg_id
            info.status = "chosen"
    db.commit()
    return ok()


@bp.post("/payer/select")
def payer_select(match_id: int):
    user = require_user()
    db = get_db()
    if not (is_admin(user) or _require_organizer(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    payer_tg_id = data.get("payer_tg_id")
    if not payer_tg_id:
        return err("missing_payer", 400)
    info = db.query(PaymentInfo).filter_by(match_id=match_id).one_or_none()
    if info is None:
        info = PaymentInfo(match_id=match_id, payer_tg_id=payer_tg_id, status="chosen")
        db.add(info)
    else:
        info.payer_tg_id = payer_tg_id
        info.status = "chosen"
    req = db.query(PaymentRequest).filter_by(match_id=match_id, tg_id=payer_tg_id).one_or_none()
    if req is None:
        db.add(PaymentRequest(match_id=match_id, tg_id=payer_tg_id, status="accepted"))
    else:
        req.status = "accepted"
    db.query(PaymentRequest).filter(
        PaymentRequest.match_id == match_id,
        PaymentRequest.tg_id != payer_tg_id,
        PaymentRequest.status == "offered"
    ).update({"status": "canceled"})
    db.commit()
    return ok()


@bp.post("/payer/clear")
def payer_clear(match_id: int):
    user = require_user()
    db = get_db()
    info = db.query(PaymentInfo).filter_by(match_id=match_id).one_or_none()
    if info is None:
        return err("payer_not_set", 400)
    if not (
        info.payer_tg_id == user.tg_id
        or is_admin(user)
        or _require_organizer(db, match_id, user.tg_id)
    ):
        return err("forbidden", 403)
    info.payer_tg_id = None
    info.payer_phone = None
    info.payer_fio = None
    info.payer_bank = None
    info.status = "none"
    db.commit()
    return ok()


@bp.post("/payer/details")
def payer_details(match_id: int):
    user = require_user()
    db = get_db()
    info = db.query(PaymentInfo).filter_by(match_id=match_id).one_or_none()
    if info is None or info.payer_tg_id != user.tg_id:
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    info.payer_phone = data.get("payer_phone")
    info.payer_fio = data.get("payer_fio")
    info.payer_bank = data.get("payer_bank")
    info.status = "details_set"
    db.commit()
    return ok()


@bp.post("/payments/mark-paid")
def mark_paid(match_id: int):
    user = require_user()
    db = get_db()
    status = db.query(PaymentStatus).filter_by(match_id=match_id, tg_id=user.tg_id).one_or_none()
    if status is None:
        status = PaymentStatus(match_id=match_id, tg_id=user.tg_id, status="reported_paid")
        db.add(status)
    else:
        status.status = "reported_paid"
    status.updated_at = datetime.utcnow()
    db.commit()
    return ok()


@bp.post("/payments/confirm")
def confirm_payment(match_id: int):
    user = require_user()
    db = get_db()
    info = db.query(PaymentInfo).filter_by(match_id=match_id).one_or_none()
    if info is None or info.payer_tg_id != user.tg_id:
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    target_tg_id = data.get("tg_id")
    approved = bool(data.get("approved", False))
    if not target_tg_id:
        return err("missing_tg_id", 400)
    status = db.query(PaymentStatus).filter_by(match_id=match_id, tg_id=target_tg_id).one_or_none()
    if status is None:
        status = PaymentStatus(match_id=match_id, tg_id=target_tg_id, status="unpaid")
        db.add(status)
    status.status = "confirmed" if approved else "rejected"
    status.updated_at = datetime.utcnow()
    db.commit()
    return ok()
