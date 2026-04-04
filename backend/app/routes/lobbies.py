"""Routes for lobby (context) management: list, join, switch default, settings."""
from __future__ import annotations

from flask import Blueprint, request

from ..auth import is_admin, require_user
from ..db import get_db
from ..models import (
    Context,
    ContextConfig,
    ContextMember,
    LobbyRole,
    User,
    Venue,
)
from ..utils import err, ok

bp = Blueprint("lobbies", __name__)


# ── helpers ──────────────────────────────────────────────────────────────

def _lobby_role_rank(role: str | None) -> int:
    role_hierarchy = {
        LobbyRole.PLAYER.value: 0,
        LobbyRole.ORGANIZER.value: 1,
        LobbyRole.ADMIN.value: 2,
        LobbyRole.SUPER_ADMIN.value: 3,
    }
    return role_hierarchy.get(role or "", 0)


def _require_lobby_role(db, context_id: int, tg_id: int, min_role: LobbyRole) -> ContextMember | None:
    """Return membership if user has at least *min_role* or is global admin."""
    member = (
        db.query(ContextMember)
        .filter_by(context_id=context_id, tg_id=tg_id)
        .one_or_none()
    )
    if member is None:
        return None
    if _lobby_role_rank(member.role) >= _lobby_role_rank(min_role.value):
        return member
    return None


# ── lobby list / switch ──────────────────────────────────────────────────

@bp.get("/lobbies")
def list_lobbies():
    """List all lobbies the current user belongs to."""
    user = require_user()
    db = get_db()
    memberships = (
        db.query(ContextMember, Context)
        .join(Context, ContextMember.context_id == Context.id)
        .filter(ContextMember.tg_id == user.tg_id)
        .order_by(Context.title.asc())
        .all()
    )
    items = []
    for membership, context in memberships:
        config = db.query(ContextConfig).filter_by(context_id=context.id).one_or_none()
        member_count = (
            db.query(ContextMember)
            .filter_by(context_id=context.id)
            .count()
        )
        items.append({
            "id": context.id,
            "title": context.title,
            "role": membership.role,
            "is_default": user.default_context_id == context.id,
            "member_count": member_count,
            "config": {
                "payments_enabled": config.payments_enabled if config else False,
                "leaderboard_enabled": config.leaderboard_enabled if config else True,
                "butt_game_allowed": config.butt_game_allowed if config else False,
                "max_team_size": config.max_team_size if config else 5,
            } if config else None,
        })
    return ok({"lobbies": items, "default_context_id": user.default_context_id})


@bp.post("/lobbies")
def create_lobby():
    """Create a new lobby. Only global admins can create new top-level lobbies."""
    user = require_user()
    if not is_admin(user):
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    password = data.get("password") or None
    if password:
        password = str(password).strip()
    admin_tg_id = data.get("admin_tg_id")

    if not title:
        return err("missing_title", 400)
    db = get_db()
    
    # Check for existing title to avoid SQL exception
    existing = db.query(Context).filter_by(title=title).one_or_none()
    if existing:
        return err("title_in_use", 400)
        
    context = Context(title=title, password=password)
    db.add(context)
    db.flush()  # to get context.id
    config = ContextConfig(context_id=context.id)
    db.add(config)
    # creator is the super_admin of this lobby
    member = ContextMember(
        context_id=context.id,
        tg_id=user.tg_id,
        role=LobbyRole.ADMIN.value,
    )
    db.add(member)
    db.flush()
    
    # if admin_tg_id is provided, add them as ADMIN
    if admin_tg_id:
        try:
            tg_id_val = int(admin_tg_id)
            if tg_id_val != user.tg_id:
                # check if the target user actually exists in the app database
                # if not, create a skeleton user for them
                target_user = db.query(User).filter_by(tg_id=tg_id_val).one_or_none()
                if not target_user:
                    target_user = User(tg_id=tg_id_val, tg_name=f"User {tg_id_val}")
                    db.add(target_user)
                    from ..models import UserSettings
                    db.add(UserSettings(tg_id=tg_id_val))
                    db.flush()
                    
                admin_member = ContextMember(
                    context_id=context.id,
                    tg_id=tg_id_val,
                    role=LobbyRole.ADMIN.value,
                )
                db.add(admin_member)
        except (ValueError, TypeError):
            pass

    db.commit()
    return ok({"id": context.id})


@bp.post("/lobbies/set-default")
def set_default_lobby():
    """Set user's default lobby (auto-enter on next launch)."""
    user = require_user()
    data = request.get_json(silent=True) or {}
    context_id = data.get("context_id")
    db = get_db()
    if context_id is not None:
        membership = (
            db.query(ContextMember)
            .filter_by(context_id=context_id, tg_id=user.tg_id)
            .one_or_none()
        )
        if membership is None:
            return err("not_a_member", 403)
    user.default_context_id = context_id
    db.commit()
    return ok()


@bp.post("/lobbies/join-by-pass")
def join_lobby_by_password():
    """Join a lobby using title and password."""
    user = require_user()
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    password = data.get("password") or None

    if password:
        password = str(password).strip()
        
    if not title:
        return err("missing_title", 400)
        
    db = get_db()
    context = db.query(Context).filter_by(title=title).one_or_none()
    if context is None:
        return err("lobby_not_found", 404)
        
    if context.password and context.password != password:
        return err("invalid_password", 403)
        
    existing = (
        db.query(ContextMember)
        .filter_by(context_id=context.id, tg_id=user.tg_id)
        .one_or_none()
    )
    if existing:
        return ok({"role": existing.role, "already_member": True, "id": context.id})
        
    member = ContextMember(
        context_id=context.id,
        tg_id=user.tg_id,
        role=LobbyRole.PLAYER.value,
    )
    db.add(member)
    db.commit()
    return ok({"role": member.role, "already_member": False, "id": context.id})


@bp.post("/lobbies/<int:context_id>/join")
def join_lobby(context_id: int):
    """Join a lobby (bypassing password, e.g. from an invite link, though unused now)."""
    user = require_user()
    db = get_db()
    context = db.query(Context).filter_by(id=context_id).one_or_none()
    if context is None:
        return err("lobby_not_found", 404)
    existing = (
        db.query(ContextMember)
        .filter_by(context_id=context_id, tg_id=user.tg_id)
        .one_or_none()
    )
    if existing:
        return ok({"role": existing.role, "already_member": True})
    member = ContextMember(
        context_id=context_id,
        tg_id=user.tg_id,
        role=LobbyRole.PLAYER.value,
    )
    db.add(member)
    db.commit()
    return ok({"role": member.role, "already_member": False})


@bp.post("/lobbies/<int:context_id>/leave")
def leave_lobby(context_id: int):
    """Leave a lobby. Admins cannot leave."""
    user = require_user()
    db = get_db()
    member = (
        db.query(ContextMember)
        .filter_by(context_id=context_id, tg_id=user.tg_id)
        .one_or_none()
    )
    if member is None:
        return err("not_a_member", 400)
    if member.role in (LobbyRole.ADMIN.value, LobbyRole.SUPER_ADMIN.value):
        return err("admin_cannot_leave", 400)
    db.delete(member)
    if user.default_context_id == context_id:
        user.default_context_id = None
    db.commit()
    return ok()


# ── lobby settings (admin only) ─────────────────────────────────────────

@bp.post("/lobbies/<int:context_id>/members")
def add_lobby_member(context_id: int):
    """Add a user to the lobby manually. Admin-only."""
    user = require_user()
    db = get_db()
    if not is_admin(user):
        member = _require_lobby_role(db, context_id, user.tg_id, LobbyRole.ADMIN)
        if member is None:
            return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    target_tg_id = data.get("tg_id")
    if not target_tg_id:
        return err("missing_tg_id", 400)
    target_user = db.query(User).filter_by(tg_id=target_tg_id).one_or_none()
    if not target_user:
        return err("user_not_found", 404)
    # check if already a member
    existing = db.query(ContextMember).filter_by(context_id=context_id, tg_id=target_tg_id).one_or_none()
    if existing:
        return err("already_member", 400)
    member = ContextMember(
        context_id=context_id,
        tg_id=target_tg_id,
        role=data.get("role", LobbyRole.PLAYER.value)
    )
    db.add(member)
    db.commit()
    return ok()


@bp.delete("/lobbies/<int:context_id>/members/<int:tg_id>")
def delete_lobby_member(context_id: int, tg_id: int):
    """Remove a member from the lobby. Lobby admins can remove players and organizers."""
    user = require_user()
    db = get_db()

    if not is_admin(user):
        member = _require_lobby_role(db, context_id, user.tg_id, LobbyRole.ADMIN)
        if member is None:
            return err("forbidden", 403)

    target = (
        db.query(ContextMember)
        .filter_by(context_id=context_id, tg_id=tg_id)
        .one_or_none()
    )
    if target is None:
        return err("member_not_found", 404)
    if tg_id == user.tg_id:
        return err("cannot_remove_self", 400)
    if not is_admin(user) and _lobby_role_rank(target.role) >= _lobby_role_rank(LobbyRole.ADMIN.value):
        return err("cannot_remove_admin", 403)

    db.delete(target)
    db.query(User).filter_by(tg_id=tg_id, default_context_id=context_id).update({"default_context_id": None})
    db.commit()
    return ok()


@bp.get("/lobbies/<int:context_id>/settings")
def get_lobby_settings(context_id: int):
    """Get lobby config. Requires admin role or super_admin."""
    user = require_user()
    db = get_db()
    if not is_admin(user):
        member = _require_lobby_role(db, context_id, user.tg_id, LobbyRole.ADMIN)
        if member is None:
            return err("forbidden", 403)
    config = db.query(ContextConfig).filter_by(context_id=context_id).one_or_none()
    if config is None:
        context = db.query(Context).filter_by(id=context_id).one_or_none()
        if context is None:
            return err("lobby_not_found", 404)
        config = ContextConfig(context_id=context_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    context = db.query(Context).filter_by(id=context_id).one_or_none()
    venues = db.query(Venue).filter_by(context_id=context_id).order_by(Venue.name.asc()).all()
    members = (
        db.query(ContextMember, User)
        .join(User, ContextMember.tg_id == User.tg_id)
        .filter(ContextMember.context_id == context_id)
        .order_by(ContextMember.joined_at.asc())
        .all()
    )
    return ok({
        "context": {
            "id": context.id,
            "title": context.title,
            "password": context.password,
        } if context else None,
        "config": {
            "payments_enabled": config.payments_enabled,
            "leaderboard_enabled": config.leaderboard_enabled,
            "butt_game_allowed": config.butt_game_allowed,
            "max_team_size": config.max_team_size,
        },
        "venues": [
            {"id": v.id, "name": v.name, "address": v.address}
            for v in venues
        ],
        "members": [
            {
                "tg_id": m.tg_id,
                "role": m.role,
                "name": u.custom_name or u.tg_name,
                "avatar": u.custom_avatar or u.tg_avatar,
                "joined_at": m.joined_at.isoformat(),
            }
            for m, u in members
        ],
    })


@bp.get("/lobbies/<int:context_id>/venues")
def get_lobby_venues(context_id: int):
    """List lobby venues for any lobby member."""
    user = require_user()
    db = get_db()
    if not is_admin(user):
        member = _require_lobby_role(db, context_id, user.tg_id, LobbyRole.PLAYER)
        if member is None:
            return err("forbidden", 403)
    venues = db.query(Venue).filter_by(context_id=context_id).order_by(Venue.name.asc()).all()
    return ok({
        "venues": [
            {"id": venue.id, "name": venue.name, "address": venue.address}
            for venue in venues
        ]
    })


@bp.patch("/lobbies/<int:context_id>/settings")
def patch_lobby_settings(context_id: int):
    """Update lobby config toggles. Requires admin or super_admin."""
    user = require_user()
    db = get_db()
    if not is_admin(user):
        member = _require_lobby_role(db, context_id, user.tg_id, LobbyRole.ADMIN)
        if member is None:
            return err("forbidden", 403)
    config = db.query(ContextConfig).filter_by(context_id=context_id).one_or_none()
    if config is None:
        context = db.query(Context).filter_by(id=context_id).one_or_none()
        if context is None:
            return err("lobby_not_found", 404)
        config = ContextConfig(context_id=context_id)
        db.add(config)
        db.flush()
    data = request.get_json(silent=True) or {}
    if "payments_enabled" in data:
        config.payments_enabled = bool(data["payments_enabled"])
    if "leaderboard_enabled" in data:
        config.leaderboard_enabled = bool(data["leaderboard_enabled"])
    if "butt_game_allowed" in data:
        config.butt_game_allowed = bool(data["butt_game_allowed"])
    if "max_team_size" in data:
        config.max_team_size = max(2, min(11, int(data["max_team_size"])))
    # Allow renaming lobby
    if "title" in data and data["title"]:
        context = db.query(Context).filter_by(id=context_id).one_or_none()
        if context:
            context.title = str(data["title"]).strip()
    # Allow changing password
    if "password" in data:
        context = db.query(Context).filter_by(id=context_id).one_or_none()
        if context:
            p = str(data["password"]).strip()
            context.password = p if p else None
    db.commit()
    return ok()


@bp.delete("/lobbies/<int:context_id>")
def delete_lobby(context_id: int):
    """Delete an entire lobby. Only global admins can do this."""
    user = require_user()
    db = get_db()
    if not is_admin(user):
        return err("forbidden", 403)
    
    context = db.query(Context).filter_by(id=context_id).one_or_none()
    if context is None:
        return err("lobby_not_found", 404)
        
    db.query(ContextMember).filter_by(context_id=context_id).delete()
    db.query(ContextConfig).filter_by(context_id=context_id).delete()
    db.query(Venue).filter_by(context_id=context_id).delete()
    db.delete(context)
    # Clear default_context_id for anyone who had this lobby as default
    db.query(User).filter_by(default_context_id=context_id).update({"default_context_id": None})
    db.commit()
    return ok()


# ── venue management (admin only) ───────────────────────────────────────

@bp.post("/lobbies/<int:context_id>/venues")
def create_venue(context_id: int):
    """Add a new venue to this lobby. Admin-only."""
    user = require_user()
    db = get_db()
    if not is_admin(user):
        member = _require_lobby_role(db, context_id, user.tg_id, LobbyRole.ADMIN)
        if member is None:
            return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return err("missing_name", 400)
    venue = Venue(
        context_id=context_id,
        name=name,
        address=(data.get("address") or "").strip() or None,
    )
    db.add(venue)
    db.commit()
    return ok({"id": venue.id})


@bp.delete("/lobbies/<int:context_id>/venues/<int:venue_id>")
def delete_venue(context_id: int, venue_id: int):
    """Remove a venue. Admin-only."""
    user = require_user()
    db = get_db()
    if not is_admin(user):
        member = _require_lobby_role(db, context_id, user.tg_id, LobbyRole.ADMIN)
        if member is None:
            return err("forbidden", 403)
    venue = db.query(Venue).filter_by(id=venue_id, context_id=context_id).one_or_none()
    if venue is None:
        return err("venue_not_found", 404)
    db.delete(venue)
    db.commit()
    return ok()


# ── member role management (admin only) ─────────────────────────────────

@bp.patch("/lobbies/<int:context_id>/members/<int:tg_id>/role")
def set_member_role(context_id: int, tg_id: int):
    """Change a member's lobby role. Admin-only."""
    user = require_user()
    db = get_db()
    if not is_admin(user):
        member = _require_lobby_role(db, context_id, user.tg_id, LobbyRole.ADMIN)
        if member is None:
            return err("forbidden", 403)
    target = (
        db.query(ContextMember)
        .filter_by(context_id=context_id, tg_id=tg_id)
        .one_or_none()
    )
    if target is None:
        return err("member_not_found", 404)
    data = request.get_json(silent=True) or {}
    new_role = data.get("role")
    valid_roles = {r.value for r in LobbyRole}
    if new_role not in valid_roles:
        return err("invalid_role", 400)
    # Non-super-admins cannot promote to super_admin
    if new_role == LobbyRole.SUPER_ADMIN.value and not is_admin(user):
        return err("forbidden", 403)
    target.role = new_role
    db.commit()
    return ok()
