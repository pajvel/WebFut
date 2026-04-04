from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base


Base = declarative_base()


# ---------------------------------------------------------------------------
#  Enums
# ---------------------------------------------------------------------------

class MatchStatus(str, Enum):
    CREATED = "created"
    STARTED = "started"
    FINISHED = "finished"
    CANCELLED = "cancelled"


class PaymentStatusType(str, Enum):
    NONE = "none"
    PENDING = "pending"
    PAID = "paid"
    PARTIAL = "partial"


class LobbyRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    ORGANIZER = "organizer"
    PLAYER = "player"


class DraftStatus(str, Enum):
    CAPTAIN_SELECTION = "captain_selection"
    PICKING = "picking"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DraftPickStatus(str, Enum):
    PENDING = "pending"
    PICKED = "picked"
    AUTO_ASSIGNED = "auto_assigned"


# ---------------------------------------------------------------------------
#  Core models
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"
    tg_id = Column(BigInteger, primary_key=True)
    tg_name = Column(String, nullable=False)
    tg_avatar = Column(Text, nullable=True)
    custom_name = Column(String, nullable=True)
    custom_avatar = Column(Text, nullable=True)
    default_context_id = Column(Integer, ForeignKey("contexts.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class UserSettings(Base):
    __tablename__ = "user_settings"
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    theme = Column(String, nullable=False, default="juve")
    mode_18plus = Column(Boolean, nullable=False, default=False)
    avatar_grayscale = Column(Boolean, nullable=False, default=False)


class Context(Base):
    __tablename__ = "contexts"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class ContextConfig(Base):
    """Feature toggles per lobby (one-to-one with Context)."""
    __tablename__ = "context_configs"
    context_id = Column(Integer, ForeignKey("contexts.id"), primary_key=True)
    payments_enabled = Column(Boolean, nullable=False, default=False)
    leaderboard_enabled = Column(Boolean, nullable=False, default=True)
    butt_game_allowed = Column(Boolean, nullable=False, default=False)
    max_team_size = Column(Integer, nullable=False, default=5)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class ContextMember(Base):
    """Mapping of users to lobbies with roles."""
    __tablename__ = "context_members"
    context_id = Column(Integer, ForeignKey("contexts.id"), primary_key=True)
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    role = Column(String, nullable=False, default=LobbyRole.PLAYER.value)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class Venue(Base):
    """Venues (fields/halls) bound to a specific lobby."""
    __tablename__ = "venues"
    id = Column(Integer, primary_key=True)
    context_id = Column(Integer, ForeignKey("contexts.id"), nullable=False)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


# ---------------------------------------------------------------------------
#  Match models
# ---------------------------------------------------------------------------

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True)
    context_id = Column(Integer, ForeignKey("contexts.id"), nullable=False)
    created_by = Column(BigInteger, ForeignKey("users.tg_id"), nullable=False)
    scheduled_at = Column(DateTime, nullable=True)
    venue = Column(String, nullable=False)
    venue_id = Column(Integer, ForeignKey("venues.id"), nullable=True)
    status = Column(String, nullable=False, default=MatchStatus.CREATED.value)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    finished_at = Column(DateTime, nullable=True)


class MatchMember(Base):
    __tablename__ = "match_members"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    role = Column(String, nullable=False)
    can_edit = Column(Boolean, nullable=False, default=False)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    name = Column(String, nullable=True)
    rating = Column(Float, nullable=True)
    invited_by_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)


class TeamVariant(Base):
    __tablename__ = "team_variants"
    id = Column(Integer, primary_key=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    variant_no = Column(Integer, nullable=False)
    is_recommended = Column(Boolean, nullable=False, default=False)
    teams_json = Column(JSONB, nullable=False)
    why_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class TeamCurrent(Base):
    __tablename__ = "team_current"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    base_variant_no = Column(Integer, nullable=False)
    current_teams_json = Column(JSONB, nullable=False)
    is_custom = Column(Boolean, nullable=False, default=False)
    why_now_worse_text = Column(Text, nullable=True)
    last_notify_at = Column(DateTime, nullable=True)
    last_notify_hash = Column(Text, nullable=True)


class Segment(Base):
    __tablename__ = "segments"
    id = Column(Integer, primary_key=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    seg_no = Column(Integer, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    score_a = Column(Integer, nullable=False, default=0)
    score_b = Column(Integer, nullable=False, default=0)
    is_butt_game = Column(Boolean, nullable=False, default=False)


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    segment_id = Column(Integer, ForeignKey("segments.id"), nullable=False)
    event_type = Column(String, nullable=False)
    team = Column(String, nullable=False)
    scorer_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)
    assist_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)
    created_by_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    is_deleted = Column(Boolean, nullable=False, default=False)


# ---------------------------------------------------------------------------
#  Payments
# ---------------------------------------------------------------------------

class PaymentInfo(Base):
    __tablename__ = "payment_info"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    payer_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)
    payer_phone = Column(String, nullable=True)
    payer_fio = Column(String, nullable=True)
    payer_bank = Column(String, nullable=True)
    payer_amount = Column(Float, nullable=True)
    last_reminder_at = Column(DateTime, nullable=True)
    last_announce_at = Column(DateTime, nullable=True)
    last_announce_hash = Column(Text, nullable=True)
    status = Column(String, nullable=False, default=PaymentStatusType.NONE.value)


class PaymentRequest(Base):
    __tablename__ = "payment_requests"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class PaymentStatus(Base):
    __tablename__ = "payment_status"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    status = Column(String, nullable=False, default="unpaid")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


# ---------------------------------------------------------------------------
#  Feedback
# ---------------------------------------------------------------------------

class Feedback(Base):
    __tablename__ = "feedback"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    mode_18plus = Column(Boolean, nullable=False)
    answers_json = Column(JSONB, nullable=False)
    mvp_vote_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


# ---------------------------------------------------------------------------
#  Model & Rating state
# ---------------------------------------------------------------------------

class ModelState(Base):
    __tablename__ = "model_states"
    context_id = Column(Integer, primary_key=True)
    state_blob = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class RatingLog(Base):
    __tablename__ = "rating_logs"
    id = Column(Integer, primary_key=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    player_id = Column(String, nullable=False)
    venue = Column(String, nullable=False)
    delta = Column(Float, nullable=False, default=0)
    pre_global = Column(Float, nullable=False, default=0)
    post_global = Column(Float, nullable=False, default=0)
    pre_venue = Column(Float, nullable=False, default=0)
    post_venue = Column(Float, nullable=False, default=0)
    goals = Column(Integer, nullable=False, default=0)
    assists = Column(Integer, nullable=False, default=0)
    details_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class InteractionLog(Base):
    __tablename__ = "interaction_logs"
    id = Column(Integer, primary_key=True)
    context_id = Column(Integer, nullable=False)
    match_id = Column(Integer, nullable=True)
    venue = Column(String, nullable=False)
    kind = Column(String, nullable=False)  # "synergy" | "domination"
    player_a = Column(String, nullable=False)
    player_b = Column(String, nullable=False)
    value_before = Column(Float, nullable=False, default=0)
    value_after = Column(Float, nullable=False, default=0)
    source = Column(String, nullable=False, default="manual")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


# ---------------------------------------------------------------------------
#  Captain's Draft
# ---------------------------------------------------------------------------

class DraftSession(Base):
    """Live draft state — one per match."""
    __tablename__ = "draft_sessions"
    __table_args__ = (
        UniqueConstraint("match_id", name="uq_draft_sessions_match_id"),
    )

    id = Column(Integer, primary_key=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    status = Column(String, nullable=False, default=DraftStatus.CAPTAIN_SELECTION.value)

    captain_a_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)
    captain_b_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)

    current_pick_number = Column(Integer, nullable=False, default=0)
    current_captain_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)

    suggested_pair_json = Column(JSONB, nullable=True)    # [tg_id, tg_id]
    snake_order_json = Column(JSONB, nullable=True)       # ["A","B","B","A",...]

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class DraftPick(Base):
    """History of individual picks — enables Undo."""
    __tablename__ = "draft_picks"

    id = Column(Integer, primary_key=True)
    draft_id = Column(Integer, ForeignKey("draft_sessions.id"), nullable=False)
    pick_number = Column(Integer, nullable=False)

    captain_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=False)
    picked_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=False)
    auto_assigned_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)

    assigned_team = Column(String, nullable=False)         # "A" or "B"
    auto_assigned_team = Column(String, nullable=True)     # "A" or "B"

    is_undone = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
