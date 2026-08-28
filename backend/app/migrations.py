import sqlite3
from collections.abc import Callable


def _columns(connection: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}


def _schema(connection: sqlite3.Connection) -> None:
    connection.execute("""CREATE TABLE IF NOT EXISTS tabs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL CHECK(length(trim(name)) > 0), sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    connection.execute("""CREATE TABLE IF NOT EXISTS card_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL CHECK(length(trim(name)) > 0), tab_id INTEGER REFERENCES tabs(id) ON DELETE CASCADE, color TEXT NOT NULL DEFAULT '#ffffff', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    group_columns = _columns(connection, "card_groups")
    if "tab_id" not in group_columns:
        connection.execute("ALTER TABLE card_groups ADD COLUMN tab_id INTEGER REFERENCES tabs(id) ON DELETE CASCADE")
    if "color" not in group_columns:
        connection.execute("ALTER TABLE card_groups ADD COLUMN color TEXT NOT NULL DEFAULT '#ffffff'")
    if "sort_order" not in group_columns:
        connection.execute("ALTER TABLE card_groups ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
        connection.execute("UPDATE card_groups SET sort_order = id")
    if "sort_order" not in _columns(connection, "tabs"):
        connection.execute("ALTER TABLE tabs ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
        connection.execute("UPDATE tabs SET sort_order = id")

    connection.execute("""CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY AUTOINCREMENT, front TEXT NOT NULL CHECK(length(trim(front)) > 0), back TEXT NOT NULL CHECK(length(trim(back)) > 0), group_id INTEGER REFERENCES card_groups(id) ON DELETE CASCADE, memory_level INTEGER NOT NULL DEFAULT 0, next_review_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    card_columns = _columns(connection, "cards")
    if "group_id" not in card_columns:
        connection.execute("ALTER TABLE cards ADD COLUMN group_id INTEGER REFERENCES card_groups(id) ON DELETE CASCADE")
    if "memory_level" not in card_columns:
        connection.execute("ALTER TABLE cards ADD COLUMN memory_level INTEGER NOT NULL DEFAULT 0")
    if "next_review_at" not in card_columns:
        connection.execute("ALTER TABLE cards ADD COLUMN next_review_at TEXT")


def _normalize_colors(connection: sqlite3.Connection) -> None:
    updates = {
        "#fff4f4": "#f7e4e6", "#fff8e8": "#f6ebd2", "#f3faec": "#e7f0dc",
        "#ecf9f7": "#dff0ec", "#eef4ff": "#e1eafa", "#f5efff": "#ebe3f5",
        "#f7e4e6": "#f5d7dc", "#f6ebd2": "#f3e2b9", "#e7f0dc": "#dcebc8",
        "#dff0ec": "#cee9e2", "#e1eafa": "#d2e1f8", "#ebe3f5": "#e2d5f1",
        "#f5d7dc": "#f2c7cf", "#f3e2b9": "#efd69a", "#dcebc8": "#cde3ad",
        "#cee9e2": "#bde0d7", "#d2e1f8": "#bfd5f5", "#e2d5f1": "#d6c4eb",
    }
    for old, new in updates.items():
        connection.execute("UPDATE card_groups SET color = ? WHERE color = ?", (new, old))


def _repair_orphans(connection: sqlite3.Connection) -> None:
    orphaned_groups = connection.execute("SELECT 1 FROM card_groups WHERE tab_id IS NULL LIMIT 1").fetchone()
    if orphaned_groups:
        cursor = connection.execute("INSERT INTO tabs (name, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tabs))", ("My tab",))
        connection.execute("UPDATE card_groups SET tab_id = ? WHERE tab_id IS NULL", (cursor.lastrowid,))

    if connection.execute("SELECT 1 FROM cards WHERE group_id IS NULL LIMIT 1").fetchone():
        tab = connection.execute("SELECT id FROM tabs ORDER BY sort_order, id LIMIT 1").fetchone()
        if tab is None:
            tab_id = connection.execute("INSERT INTO tabs (name, sort_order) VALUES (?, 0)", ("My tab",)).lastrowid
        else:
            tab_id = tab[0]
        group = connection.execute("SELECT id FROM card_groups WHERE name = ? AND tab_id = ? ORDER BY id LIMIT 1", ("My cards", tab_id)).fetchone()
        group_id = group[0] if group else connection.execute("INSERT INTO card_groups (name, tab_id) VALUES (?, ?)", ("My cards", tab_id)).lastrowid
        connection.execute("UPDATE cards SET group_id = ? WHERE group_id IS NULL", (group_id,))


def _daily_learning(connection: sqlite3.Connection) -> None:
    connection.execute("""CREATE TABLE IF NOT EXISTS daily_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK(length(trim(name)) > 0),
        task_type TEXT NOT NULL CHECK(task_type IN ('general', 'study')),
        tab_id INTEGER REFERENCES tabs(id) ON DELETE CASCADE,
        link TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK((task_type = 'general' AND tab_id IS NULL) OR (task_type = 'study' AND tab_id IS NOT NULL))
    )""")
    connection.execute("""CREATE TABLE IF NOT EXISTS daily_task_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES card_groups(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        rounds INTEGER NOT NULL CHECK(rounds BETWEEN 1 AND 20),
        card_subset TEXT NOT NULL CHECK(card_subset IN ('all', 'known', 'unknown')),
        game_type TEXT NOT NULL CHECK(game_type IN ('alternating', 'front', 'back'))
    )""")
    connection.execute("""CREATE TABLE IF NOT EXISTS daily_task_completions (
        task_id INTEGER NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
        completed_on TEXT NOT NULL,
        PRIMARY KEY (task_id, completed_on)
    )""")


def _fixed_daily_round_size(connection: sqlite3.Connection) -> None:
    if "cards_per_round" not in _columns(connection, "daily_task_steps"):
        return
    connection.execute("""CREATE TABLE daily_task_steps_fixed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES card_groups(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        rounds INTEGER NOT NULL CHECK(rounds BETWEEN 1 AND 20),
        card_subset TEXT NOT NULL CHECK(card_subset IN ('all', 'known', 'unknown')),
        game_type TEXT NOT NULL CHECK(game_type IN ('alternating', 'front', 'back'))
    )""")
    connection.execute("""INSERT INTO daily_task_steps_fixed
        (id, task_id, group_id, sort_order, rounds, card_subset, game_type)
        SELECT id, task_id, group_id, sort_order, rounds, card_subset, game_type
        FROM daily_task_steps""")
    connection.execute("DROP TABLE daily_task_steps")
    connection.execute("ALTER TABLE daily_task_steps_fixed RENAME TO daily_task_steps")


def _daily_task_links(connection: sqlite3.Connection) -> None:
    if "link" not in _columns(connection, "daily_tasks"):
        connection.execute("ALTER TABLE daily_tasks ADD COLUMN link TEXT")


def _daily_history(connection: sqlite3.Connection) -> None:
    connection.execute("""CREATE TABLE IF NOT EXISTS daily_task_history (
        completed_on TEXT PRIMARY KEY,
        completed_count INTEGER NOT NULL CHECK(completed_count >= 0),
        task_count INTEGER NOT NULL CHECK(task_count >= 0 AND completed_count <= task_count),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")


MIGRATIONS: tuple[Callable[[sqlite3.Connection], None], ...] = (
    _schema, _normalize_colors, _repair_orphans, _daily_learning, _fixed_daily_round_size,
    _daily_task_links, _daily_history,
)


def run_migrations(connection: sqlite3.Connection) -> None:
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    for next_version, migration in enumerate(MIGRATIONS, start=1):
        if next_version <= version:
            continue
        migration(connection)
        connection.execute(f"PRAGMA user_version = {next_version}")
