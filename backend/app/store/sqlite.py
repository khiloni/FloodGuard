import sqlite3
import json
import os
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone


class SessionStore:
    def __init__(self, db_path: str = "floodguard.db"):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    scenario_id TEXT NOT NULL,
                    seed INTEGER NOT NULL,
                    difficulty TEXT NOT NULL,
                    language TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    last_active TEXT NOT NULL,
                    actions_json TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    is_ended INTEGER NOT NULL DEFAULT 0
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS turn_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    tick INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    caused_by TEXT NOT NULL,
                    details_json TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions (session_id)
                )
            """)
            conn.commit()

    def create_session(
        self,
        session_id: str,
        scenario_id: str,
        seed: int,
        difficulty: str,
        language: str,
        initial_state_dict: Dict[str, Any],
    ):
        now = datetime.now(timezone.utc).isoformat()
        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO sessions (
                    session_id, scenario_id, seed, difficulty, language,
                    created_at, last_active, actions_json, state_json, is_ended
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """,
                (
                    session_id,
                    scenario_id,
                    seed,
                    difficulty,
                    language,
                    now,
                    now,
                    json.dumps([]),
                    json.dumps(initial_state_dict),
                ),
            )
            conn.commit()

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            if not row:
                return None
            return {
                "session_id": row["session_id"],
                "scenario_id": row["scenario_id"],
                "seed": row["seed"],
                "difficulty": row["difficulty"],
                "language": row["language"],
                "created_at": row["created_at"],
                "last_active": row["last_active"],
                "actions": json.loads(row["actions_json"]),
                "state": json.loads(row["state_json"]),
                "is_ended": bool(row["is_ended"]),
            }

    def update_session(
        self,
        session_id: str,
        actions: List[Dict[str, Any]],
        state_dict: Dict[str, Any],
        is_ended: bool = False,
    ):
        now = datetime.now(timezone.utc).isoformat()
        with self._get_conn() as conn:
            conn.execute(
                """
                UPDATE sessions
                SET actions_json = ?, state_json = ?, last_active = ?, is_ended = ?
                WHERE session_id = ?
                """,
                (
                    json.dumps(actions),
                    json.dumps(state_dict),
                    now,
                    1 if is_ended else 0,
                    session_id,
                ),
            )
            conn.commit()

    def log_event(
        self,
        session_id: str,
        tick: int,
        event_type: str,
        description: str,
        caused_by: str,
        details: Dict[str, Any],
    ):
        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO turn_events (session_id, tick, event_type, description, caused_by, details_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    tick,
                    event_type,
                    description,
                    caused_by,
                    json.dumps(details),
                ),
            )
            conn.commit()

    def get_events(self, session_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM turn_events WHERE session_id = ? ORDER BY id ASC",
                (session_id,),
            ).fetchall()
            return [
                {
                    "tick": r["tick"],
                    "event_type": r["event_type"],
                    "description": r["description"],
                    "caused_by": r["caused_by"],
                    "details": json.loads(r["details_json"]),
                }
                for r in rows
            ]
