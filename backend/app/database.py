import os
import sqlite3
from contextlib import closing, contextmanager
from pathlib import Path
from typing import Iterator

from .migrations import run_migrations


DEFAULT_DATABASE = Path(__file__).resolve().parent.parent / "data" / "flashcards.db"


def database_path() -> Path:
    return Path(os.environ.get("FLASHCARDS_DATABASE_PATH", DEFAULT_DATABASE))


def initialize_database() -> None:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path)) as connection, connection:
        connection.execute("PRAGMA foreign_keys = ON")
        run_migrations(connection)


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(database_path())
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()
