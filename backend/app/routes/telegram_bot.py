from __future__ import annotations

from datetime import datetime

from flask import Blueprint, request

from ..db import get_db
from ..models import PaymentInfo, PaymentStatus
from ..services.telegram_bot import answer_callback, send_start
from ..utils import ok

bp = Blueprint("telegram_bot", __name__, url_prefix="")


@bp.route("/webhook", methods=["GET", "POST"])
def webhook():
    if request.method == "GET":
        return ok()
    update = request.get_json(silent=True) or {}

    message = update.get("message") or {}
    text = (message.get("text") or "").strip()
    chat_id = ((message.get("chat") or {}).get("id"))
    if text == "/start" and chat_id:
        send_start(int(chat_id))
        return ok()

    callback_query = update.get("callback_query") or {}
    callback_id = callback_query.get("id")
    data = callback_query.get("data") or ""
    from_user_tg_id = ((callback_query.get("from") or {}).get("id"))
    if not callback_id or not data or not from_user_tg_id:
        return ok()

    if data.startswith("confirm_payment:") or data.startswith("reject_payment:"):
        parts = data.split(":")
        if len(parts) != 3:
            answer_callback(callback_id, "Ошибка")
            return ok()

        action, raw_match_id, raw_target_tg_id = parts
        try:
            match_id = int(raw_match_id)
            target_tg_id = int(raw_target_tg_id)
        except ValueError:
            answer_callback(callback_id, "Ошибка")
            return ok()

        db = get_db()
        payer = db.query(PaymentInfo).filter_by(match_id=match_id).one_or_none()
        if payer is None or payer.payer_tg_id != int(from_user_tg_id):
            answer_callback(callback_id, "Нет доступа")
            return ok()

        payment_status = db.query(PaymentStatus).filter_by(match_id=match_id, tg_id=target_tg_id).one_or_none()
        if payment_status is None:
            payment_status = PaymentStatus(match_id=match_id, tg_id=target_tg_id, status="unpaid")
            db.add(payment_status)
        payment_status.status = "confirmed" if action == "confirm_payment" else "rejected"
        payment_status.updated_at = datetime.utcnow()
        db.commit()

        answer_callback(callback_id, "Готово")
        return ok()

    return ok()
