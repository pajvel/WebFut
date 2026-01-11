from __future__ import annotations

from datetime import datetime, timedelta
import pickle

from sqlalchemy import text

from .config import Config
from .db import SessionLocal, engine
from .models import (
    Base,
    Context,
    Match,
    MatchMember,
    ModelState as ModelStateRecord,
    Segment,
    TeamVariant,
    User,
    UserSettings,
)
from team_model.team_model import Config as TeamConfig
from team_model.team_model import Match as TeamMatch
from team_model.team_model import ModelState as TeamModelState
from team_model.team_model import Segment as TeamSegment
from team_model.team_model import update_from_match


PLAYER_IDS = {
    "Паша": 963047320,
    "Виталик": 1002,
    "Юра": 1003,
    "Игорь": 5952551798,
    "ВаняБ": 1005,
    "ЕгорГ": 1006,
    "ЕгорИ": 1007,
    "Майор": 1008,
    "Максон": 1009,
    "Данек": 1010,
    "Рома": 1011,
    "Ванек": 1012,
    "Мотя": 1013,
    "Курк": 1014,
    "Чел": 1015,
    "Тёма": 1016,
    "Чап": 1017,
    "ЛСтим": 1018,
}

TIER_BONUS = {
    "ЕгорГ": 115.0,
    "Майор": 85.0,
    "Ванек": 95.0,
    "Максон": 60.0,
    "Юра": 55.0,
    "ЕгорИ": 45.0,
    "Паша": 45.0,
    "Игорь": 45.0,
    "Виталик": 30.0,
    "Данек": -110.0,
}

HISTORICAL_MATCHES = [
    {
        "match_id": "game1",
        "venue": "зал1",
        "team_a": ["Паша", "Виталик", "Юра", "Игорь", "ВаняБ"],
        "team_b": ["ЕгорГ", "ЕгорИ", "Майор", "Максон", "Данек"],
        "segments": [
            {"score_a": 0, "score_b": 5, "is_butt_game": False},
        ],
    },
    {
        "match_id": "game2",
        "venue": "зал1",
        "team_a": ["Паша", "Майор", "ЕгорИ", "Рома"],
        "team_b": ["Максон", "Ванек", "Мотя", "ВаняБ"],
        "segments": [
            {"score_a": 0, "score_b": 1, "is_butt_game": False},
        ],
    },
    {
        "match_id": "game3",
        "venue": "зал2",
        "team_a": ["Юра", "Игорь", "Виталик", "Курк", "Чел"],
        "team_b": ["Паша", "Майор", "Максон", "ЕгорГ", "Мотя"],
        "segments": [
            {"score_a": 0, "score_b": 6, "is_butt_game": False},
        ],
    },
    {
        "match_id": "game4",
        "venue": "зал2",
        "team_a": ["Юра", "Паша", "Майор", "ЕгорИ", "Мотя", "Ванек"],
        "team_b": ["Игорь", "Виталик", "ЕгорГ", "Максон", "Данек", "Тёма"],
        "segments": [
            {"score_a": 4, "score_b": 0, "is_butt_game": False},
        ],
    },
    {
        "match_id": "game5",
        "venue": "зал2",
        "team_a": ["Паша", "Максон", "ЕгорГ", "Тёма", "Ванек"],
        "team_b": ["Юра", "Игорь", "Виталик", "Майор", "Мотя"],
        "segments": [
            {"score_a": 5, "score_b": 0, "is_butt_game": False},
        ],
    },
    {
        "match_id": "game6",
        "venue": "зал1",
        "team_a": ["Майор", "Ванек", "Игорь", "Юра", "Чап"],
        "team_b": ["Паша", "ЕгорГ", "Максон", "ЕгорИ", "Виталик"],
        "segments": [
            {"score_a": 6, "score_b": 5, "is_butt_game": False},
            {"score_a": 8, "score_b": 6, "is_butt_game": True},
        ],
    },
    {
        "match_id": "game7",
        "venue": "зал2",
        "team_a": ["Паша", "ЕгорГ", "Максон", "Майор", "ВаняБ"],
        "team_b": ["Игорь", "Юра", "Виталик", "Курк", "ЛСтим"],
        "segments": [
            {"score_a": 6, "score_b": 6, "is_butt_game": False},
            {"score_a": 8, "score_b": 7, "is_butt_game": True},
        ],
    },
]


def ensure_schema() -> None:
    Base.metadata.create_all(engine)


def _reset_db() -> None:
    tables = [
        "feedback",
        "payment_status",
        "payment_requests",
        "payment_info",
        "events",
        "segments",
        "team_current",
        "team_variants",
        "match_members",
        "matches",
        "user_settings",
        "users",
        "model_states",
        "contexts",
    ]
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))


def _ensure_context(session) -> Context:
    context = Context(
        id=Config.DEFAULT_CONTEXT_ID,
        title=Config.DEFAULT_CONTEXT_TITLE,
    )
    session.add(context)
    return context


def _ensure_users(session) -> None:
    for name, tg_id in PLAYER_IDS.items():
        session.add(User(tg_id=tg_id, tg_name=name, tg_avatar=None))
        session.add(UserSettings(tg_id=tg_id, theme="light", mode_18plus=False))


def _make_team_match(venue: str, team_a: list[str], team_b: list[str], segments: list[dict]) -> TeamMatch:
    return TeamMatch(
        venue=venue,
        team_a=[str(PLAYER_IDS[name]) for name in team_a],
        team_b=[str(PLAYER_IDS[name]) for name in team_b],
        segments=[
            TeamSegment(
                goals_a=seg["score_a"],
                goals_b=seg["score_b"],
                segment_index=idx,
                is_butt_game=seg.get("is_butt_game", False),
            )
            for idx, seg in enumerate(segments)
        ],
        events=[],
    )


def _seed_model_state(session) -> None:
    cfg = TeamConfig()
    model = TeamModelState.empty(cfg)
    model.tier_bonus = {str(PLAYER_IDS[name]): bonus for name, bonus in TIER_BONUS.items()}

    for data in HISTORICAL_MATCHES:
        match = _make_team_match(data["venue"], data["team_a"], data["team_b"], data["segments"])
        update_from_match(model, match)

    session.add(ModelStateRecord(context_id=Config.DEFAULT_CONTEXT_ID, state_blob=pickle.dumps(model)))


def _seed_matches(session) -> None:
    base_time = datetime.utcnow() - timedelta(days=10)
    organizer_id = PLAYER_IDS["Паша"]

    for idx, data in enumerate(HISTORICAL_MATCHES, start=1):
        match = Match(
            context_id=Config.DEFAULT_CONTEXT_ID,
            created_by=organizer_id,
            scheduled_at=base_time + timedelta(days=idx),
            venue=data["venue"],
            status="finished",
            created_at=base_time + timedelta(days=idx),
            finished_at=base_time + timedelta(days=idx, hours=2),
        )
        session.add(match)
        session.flush()

        session.add(
            MatchMember(
                match_id=match.id,
                tg_id=organizer_id,
                role="organizer",
                can_edit=True,
            )
        )
        participants = data["team_a"] + data["team_b"]
        for name in participants:
            tg_id = PLAYER_IDS[name]
            if tg_id == organizer_id:
                continue
            session.add(
                MatchMember(
                    match_id=match.id,
                    tg_id=tg_id,
                    role="player",
                    can_edit=False,
                )
            )

        for seg_no, seg in enumerate(data["segments"], start=1):
            segment = Segment(
                match_id=match.id,
                seg_no=seg_no,
                ended_at=match.finished_at,
                score_a=seg["score_a"],
                score_b=seg["score_b"],
                is_butt_game=seg.get("is_butt_game", False),
            )
            session.add(segment)

        session.add(
            TeamVariant(
                match_id=match.id,
                variant_no=1,
                is_recommended=True,
                teams_json={
                    "A": [str(PLAYER_IDS[name]) for name in data["team_a"]],
                    "B": [str(PLAYER_IDS[name]) for name in data["team_b"]],
                },
                why_text=None,
            )
        )


def seed(reset: bool = False) -> bool:
    if reset:
        _reset_db()
    session = SessionLocal()
    try:
        _ensure_context(session)
        _ensure_users(session)
        session.flush()
        _seed_matches(session)
        _seed_model_state(session)
        session.commit()
    finally:
        session.close()
    return True


def seed_if_empty() -> bool:
    if not Config.DATABASE_URL or not Config.AUTO_SEED:
        return False
    session = SessionLocal()
    try:
        existing = session.query(Context).first()
    finally:
        session.close()
    if existing:
        return False
    return seed(reset=False)
