"""Test-wide setup: never touch the developer's backend/floodguard.db (it may be open
by a running server, which makes SQLite fail with 'disk I/O error' on Windows mounts)."""
import os
import tempfile

os.environ.setdefault("FLOODGUARD_DB_PATH", os.path.join(tempfile.mkdtemp(prefix="floodguard-tests-"), "test.db"))
os.environ.setdefault("RATE_LIMIT_PER_MIN", "0")
