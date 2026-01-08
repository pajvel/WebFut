from datetime import datetime

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
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base


Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    tg_id = Column(BigInteger, primary_key=True)
    tg_name = Column(String, nullable=False)
    tg_avatar = Column(Text, nullable=True)
    custom_name = Column(String, nullable=True)
    custom_avatar = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UserSettings(Base):
    __tablename__ = "user_settings"
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    theme = Column(String, nullable=False, default="light")
    mode_18plus = Column(Boolean, nullable=False, default=False)


class Context(Base):
    __tablename__ = "contexts"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True)
    context_id = Column(Integer, ForeignKey("contexts.id"), nullable=False)
    created_by = Column(BigInteger, ForeignKey("users.tg_id"), nullable=False)
    scheduled_at = Column(DateTime, nullable=True)
    venue = Column(String, nullable=False)
    status = Column(String, nullable=False, default="created")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)


class MatchMember(Base):
    __tablename__ = "match_members"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    role = Column(String, nullable=False)
    can_edit = Column(Boolean, nullable=False, default=False)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TeamVariant(Base):
    __tablename__ = "team_variants"
    id = Column(Integer, primary_key=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    variant_no = Column(Integer, nullable=False)
    is_recommended = Column(Boolean, nullable=False, default=False)
    teams_json = Column(JSONB, nullable=False)
    why_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TeamCurrent(Base):
    __tablename__ = "team_current"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    base_variant_no = Column(Integer, nullable=False)
    current_teams_json = Column(JSONB, nullable=False)
    is_custom = Column(Boolean, nullable=False, default=False)
    why_now_worse_text = Column(Text, nullable=True)


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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_deleted = Column(Boolean, nullable=False, default=False)


class PaymentInfo(Base):
    __tablename__ = "payment_info"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    payer_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)
    payer_phone = Column(String, nullable=True)
    payer_fio = Column(String, nullable=True)
    payer_bank = Column(String, nullable=True)
    status = Column(String, nullable=False, default="none")


class PaymentRequest(Base):
    __tablename__ = "payment_requests"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PaymentStatus(Base):
    __tablename__ = "payment_status"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    status = Column(String, nullable=False, default="unpaid")
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Feedback(Base):
    __tablename__ = "feedback"
    match_id = Column(Integer, ForeignKey("matches.id"), primary_key=True)
    tg_id = Column(BigInteger, ForeignKey("users.tg_id"), primary_key=True)
    mode_18plus = Column(Boolean, nullable=False)
    answers_json = Column(JSONB, nullable=False)
    mvp_vote_tg_id = Column(BigInteger, ForeignKey("users.tg_id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ModelState(Base):
    __tablename__ = "model_states"
    context_id = Column(Integer, primary_key=True)
    state_blob = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
