import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


DEFAULT_DATABASE = Path(__file__).resolve().parent.parent / "data" / "flashcards.db"


def database_path() -> Path:
    return Path(os.environ.get("FLASHCARDS_DATABASE_PATH", DEFAULT_DATABASE))


def initialize_database() -> None:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                front TEXT NOT NULL CHECK(length(trim(front)) > 0),
                back TEXT NOT NULL CHECK(length(trim(back)) > 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(database_path())
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()

