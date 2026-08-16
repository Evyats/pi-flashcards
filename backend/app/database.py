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
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS tabs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL CHECK(length(trim(name)) > 0),
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS card_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL CHECK(length(trim(name)) > 0),
                tab_id INTEGER REFERENCES tabs(id) ON DELETE CASCADE,
                color TEXT NOT NULL DEFAULT '#ffffff',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        group_columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(card_groups)").fetchall()
        }
        if "tab_id" not in group_columns:
            connection.execute(
                "ALTER TABLE card_groups ADD COLUMN tab_id INTEGER REFERENCES tabs(id) ON DELETE CASCADE"
            )
        if "color" not in group_columns:
            connection.execute(
                "ALTER TABLE card_groups ADD COLUMN color TEXT NOT NULL DEFAULT '#ffffff'"
            )
        if "sort_order" not in group_columns:
            connection.execute(
                "ALTER TABLE card_groups ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
            )
            connection.execute("UPDATE card_groups SET sort_order = id")
        tab_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(tabs)").fetchall()
        }
        if "sort_order" not in tab_columns:
            connection.execute(
                "ALTER TABLE tabs ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
            )
            connection.execute("UPDATE tabs SET sort_order = id")
        color_updates = {
            "#fff4f4": "#f7e4e6",
            "#fff8e8": "#f6ebd2",
            "#f3faec": "#e7f0dc",
            "#ecf9f7": "#dff0ec",
            "#eef4ff": "#e1eafa",
            "#f5efff": "#ebe3f5",
            "#f7e4e6": "#f5d7dc",
            "#f6ebd2": "#f3e2b9",
            "#e7f0dc": "#dcebc8",
            "#dff0ec": "#cee9e2",
            "#e1eafa": "#d2e1f8",
            "#ebe3f5": "#e2d5f1",
            "#f5d7dc": "#f2c7cf",
            "#f3e2b9": "#efd69a",
            "#dcebc8": "#cde3ad",
            "#cee9e2": "#bde0d7",
            "#d2e1f8": "#bfd5f5",
            "#e2d5f1": "#d6c4eb",
        }
        for old_color, new_color in color_updates.items():
            connection.execute(
                "UPDATE card_groups SET color = ? WHERE color = ?",
                (new_color, old_color),
            )
        orphaned_groups = connection.execute(
            "SELECT 1 FROM card_groups WHERE tab_id IS NULL LIMIT 1"
        ).fetchone()
        if orphaned_groups:
            cursor = connection.execute("INSERT INTO tabs (name) VALUES (?)", ("My tab",))
            connection.execute(
                "UPDATE card_groups SET tab_id = ? WHERE tab_id IS NULL",
                (cursor.lastrowid,),
            )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                front TEXT NOT NULL CHECK(length(trim(front)) > 0),
                back TEXT NOT NULL CHECK(length(trim(back)) > 0),
                group_id INTEGER REFERENCES card_groups(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(cards)").fetchall()
        }
        if "group_id" not in columns:
            connection.execute(
                "ALTER TABLE cards ADD COLUMN group_id INTEGER REFERENCES card_groups(id) ON DELETE CASCADE"
            )
        ungrouped = connection.execute(
            "SELECT 1 FROM cards WHERE group_id IS NULL LIMIT 1"
        ).fetchone()
        if ungrouped:
            default_group = connection.execute(
                "SELECT id FROM card_groups WHERE name = ? ORDER BY id LIMIT 1",
                ("My cards",),
            ).fetchone()
            if default_group is None:
                cursor = connection.execute(
                    "INSERT INTO card_groups (name) VALUES (?)", ("My cards",)
                )
                group_id = cursor.lastrowid
            else:
                group_id = default_group[0]
            connection.execute(
                "UPDATE cards SET group_id = ? WHERE group_id IS NULL", (group_id,)
            )


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
