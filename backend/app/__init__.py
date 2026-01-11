import pathlib

from flask import Flask, abort, send_from_directory
from flask_cors import CORS

from .config import Config
from .db import SessionLocal
from .seed import ensure_schema, seed_if_empty


def create_app() -> Flask:
    dist_dir = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "dist"
    app = Flask(
        __name__,
        static_folder=str(dist_dir),
        static_url_path="",
    )
    app.url_map.strict_slashes = False
    CORS(
        app,
        resources={r"/*": {"origins": "*"}},
        allow_headers=["Content-Type", "Authorization", "X-Telegram-InitData"],
    )

    from .routes import admin, auth, events, feedback, matches, me, payments, teams

    api_prefix = "/api"
    app.register_blueprint(auth.bp, url_prefix=f"{api_prefix}/auth")
    app.register_blueprint(me.bp, url_prefix=api_prefix)
    app.register_blueprint(matches.bp, url_prefix=f"{api_prefix}/matches")
    app.register_blueprint(teams.bp, url_prefix=f"{api_prefix}/matches/<int:match_id>/teams")
    app.register_blueprint(events.bp, url_prefix=f"{api_prefix}/matches/<int:match_id>/events")
    app.register_blueprint(payments.bp, url_prefix=f"{api_prefix}/matches/<int:match_id>")
    app.register_blueprint(feedback.bp, url_prefix=f"{api_prefix}/matches/<int:match_id>")
    app.register_blueprint(admin.bp, url_prefix=f"{api_prefix}/admin")

    @app.get("/api/health")
    def healthcheck():
        return {"ok": True}

    @app.get("/uploads/<path:filename>")
    def serve_uploads(filename: str):
        return send_from_directory(Config.UPLOADS_DIR, filename)

    @app.get("/")
    def serve_index():
        if not dist_dir.exists():
            abort(404)
        return app.send_static_file("index.html")

    @app.get("/<path:path>")
    def serve_static(path: str):
        if path == "api" or path.startswith("api/"):
            abort(404)
        if dist_dir.exists():
            file_path = dist_dir / path
            if file_path.is_file():
                return send_from_directory(dist_dir, path)
            return app.send_static_file("index.html")
        abort(404)

    @app.teardown_appcontext
    def shutdown_session(_exc=None):
        SessionLocal.remove()

    @app.errorhandler(ValueError)
    def handle_value_error(exc):
        return {"ok": False, "error": str(exc)}, 401

    ensure_schema()
    seed_if_empty()

    return app
