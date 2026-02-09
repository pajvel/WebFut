from __future__ import annotations

import json
from datetime import datetime
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..config import Config
from ..models import MatchMember, PaymentInfo, User


START_TEXT = (
    "⚽ WebFut\n\n"
    "Мини-приложение для игр с друзьями.\n\n"
    "• создание игры\n"
    "• автоматическое деление на команды\n"
    "• ведение и завершение матча\n"
    "• оплата поля\n"
    "• фидбек и статистика игроков\n\n"
    "Всё — внутри приложения 👇"
)

PAYMENT_ANNOUNCE_TEXT = (
    "💸 Оплата поля\n\n"
    "Плательщик: {payer_name}\n"
    "Сумма с человека: {amount} ₽\n\n"
    "Переведи и отметь оплату"
)

PAYMENT_MARKED_TEXT = (
    "💸 Перевод отмечен\n\n"
    "{user_name} отметил, что перевёл {amount} ₽\n\n"
    "Проверь перевод и подтверди"
)

PAYMENT_REMINDER_TEXT = (
    "⏰ Напоминание об оплате\n\n"
    "Плательщик: {payer_name}\n"
    "Сумма: {amount} ₽\n\n"
    "Если ещё не перевёл — скинь сейчас"
)

SQUADS_PROPOSED_TEXT = (
    "⚽ Предложены составы команд\n\n"
    "Организатор зафиксировал составы команд.\n"
    "Вы можете посмотреть их в приложении."
)


def _api_url(method: str) -> str:
    token = Config.TELEGRAM_BOT_TOKEN
    if not token:
        return ""
    return f"https://api.telegram.org/bot{token}/{method}"


def _post_telegram(method: str, payload: dict) -> None:
    url = _api_url(method)
    if not url:
        return
    data = json.dumps(payload).encode("utf-8")
    req = Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(req, timeout=7):
            pass
    except (HTTPError, URLError, TimeoutError):
        return


def _app_url(action: str, match_id: int | None = None) -> str | None:
    base = (Config.TELEGRAM_WEBAPP_URL or "").strip().rstrip("/")
    if not base:
        return None
    if action == "open_app":
        return f"{base}/"
    if action in ("open_game", "open_payment") and match_id is not None:
        return f"{base}/#/matches/{match_id}"
    return f"{base}/"


def _keyboard(
    buttons: list[dict[str, str]],
    *,
    match_id: int | None = None,
    target_tg_id: int | None = None,
) -> dict:
    rows = []
    for btn in buttons:
        text = btn["text"]
        action = btn["action"]
        if action in ("open_app", "open_game", "open_payment"):
            url = _app_url(action, match_id=match_id)
            if url:
                rows.append([{"text": text, "web_app": {"url": url}}])
            else:
                rows.append([{"text": text, "callback_data": action}])
            continue

        if action == "confirm_payment" and match_id is not None and target_tg_id is not None:
            rows.append([{"text": text, "callback_data": f"confirm_payment:{match_id}:{target_tg_id}"}])
            continue
        if action == "reject_payment" and match_id is not None and target_tg_id is not None:
            rows.append([{"text": text, "callback_data": f"reject_payment:{match_id}:{target_tg_id}"}])
            continue

        rows.append([{"text": text, "callback_data": action}])
    return {"inline_keyboard": rows}




def send_message(
    chat_id: int,
    text: str,
    *,
    buttons: list[dict[str, str]] | None = None,
    match_id: int | None = None,
    target_tg_id: int | None = None,
) -> None:
    payload = {
        "chat_id": chat_id,
        "text": text,
    }
    if buttons:
        payload["reply_markup"] = _keyboard(
            buttons, match_id=match_id, target_tg_id=target_tg_id
        )
    _post_telegram("sendMessage", payload)


def answer_callback(callback_query_id: str, text: str) -> None:
    _post_telegram("answerCallbackQuery", {"callback_query_id": callback_query_id, "text": text})


def _display_name(user: User | None) -> str:
    if not user:
        return "—"
    return user.custom_name or user.tg_name or str(user.tg_id)


def _player_count_for_payment(members: list[MatchMember]) -> int:
    return sum(1 for m in members if m.role in ("player", "organizer"))


def _format_amount(amount: float | None) -> str:
    if amount is None:
        return "0"
    return f"{amount:.2f}".rstrip("0").rstrip(".")


def send_start(chat_id: int) -> None:
    send_message(
        chat_id,
        START_TEXT,
        buttons=[{"text": "🚀 Открыть WebFut", "action": "open_app"}],
    )


def send_payment_announce(
    *,
    match_id: int,
    payer_user: User | None,
    payer_info: PaymentInfo,
    members: list[MatchMember],
) -> None:
    amount = payer_info.payer_amount
    if amount is None:
        return
    split_count = _player_count_for_payment(members)
    if split_count <= 0:
        return
    per_person = amount / split_count
    text = PAYMENT_ANNOUNCE_TEXT.format(
        payer_name=_display_name(payer_user),
        amount=_format_amount(per_person),
    )
    buttons = [
        {"text": "💳 Скинуть", "action": "open_payment"},
        {"text": "📱 Открыть игру", "action": "open_game"},
    ]
    for member in members:
        send_message(member.tg_id, text, buttons=buttons, match_id=match_id)


def send_payment_marked_with_target(
    *,
    match_id: int,
    payer_tg_id: int | None,
    target_tg_id: int,
    user_name: str,
    amount: float | None,
) -> None:
    if not payer_tg_id:
        return
    text = PAYMENT_MARKED_TEXT.format(
        user_name=user_name,
        amount=_format_amount(amount),
    )
    send_message(
        payer_tg_id,
        text,
        buttons=[
            {"text": "✅ Подтвердить", "action": "confirm_payment"},
            {"text": "❌ Не подтвердить", "action": "reject_payment"},
            {"text": "📱 Открыть приложение", "action": "open_app"},
        ],
        match_id=match_id,
        target_tg_id=target_tg_id,
    )


def send_payment_reminder(
    *,
    match_id: int,
    payer_user: User | None,
    amount: float,
    members: Iterable[MatchMember],
) -> int:
    text = PAYMENT_REMINDER_TEXT.format(
        payer_name=_display_name(payer_user),
        amount=_format_amount(amount),
    )
    sent = 0
    for member in members:
        send_message(
            member.tg_id,
            text,
            buttons=[{"text": "💳 Скинуть", "action": "open_payment"}],
            match_id=match_id,
        )
        sent += 1
    return sent


def send_squads_proposed(match_id: int, members: list[MatchMember]) -> None:
    for member in members:
        send_message(
            member.tg_id,
            SQUADS_PROPOSED_TEXT,
            buttons=[{"text": "📱 Открыть игру", "action": "open_game"}],
            match_id=match_id,
        )


def is_reminder_on_cooldown(last_sent_at: datetime | None, now: datetime) -> bool:
    if not last_sent_at:
        return False
    return (now - last_sent_at).total_seconds() < 3600
