import pickle
from datetime import datetime, timezone

from team_model.team_model import Config as TeamConfig
from team_model.team_model import ModelState as TeamModelState

from ..models import ModelState


def load_state(db, context_id: int) -> TeamModelState:
    record = db.query(ModelState).filter_by(context_id=context_id).one_or_none()
    if record is None:
        state = TeamModelState.empty(TeamConfig())
        record = ModelState(context_id=context_id, state_blob=pickle.dumps(state), updated_at=datetime.now(timezone.utc))
        db.add(record)
        db.commit()
        return state
    state = pickle.loads(record.state_blob)
    if not hasattr(state, "base_ratings"):
        state.base_ratings = {}
    for player in state.players.values():
        if not hasattr(player, "base_rating"):
            player.base_rating = None
    return state


def save_state(db, context_id: int, state: TeamModelState) -> None:
    record = db.query(ModelState).filter_by(context_id=context_id).one()
    record.state_blob = pickle.dumps(state)
    record.updated_at = datetime.now(timezone.utc)
    db.commit()
