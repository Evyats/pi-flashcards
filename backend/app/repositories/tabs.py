from ..database import get_connection
from ..errors import ConflictError, InvalidOrderError, NotFoundError
from ..schemas import Tab


TAB_SELECT = """
    SELECT tabs.id, tabs.name, tabs.sort_order, tabs.created_at,
           (SELECT COUNT(*) FROM card_groups WHERE card_groups.tab_id = tabs.id) AS group_count,
           (SELECT COUNT(*) FROM cards JOIN card_groups ON cards.group_id = card_groups.id
            WHERE card_groups.tab_id = tabs.id) AS card_count
    FROM tabs
"""


def fetch_tab(tab_id: int) -> Tab:
    with get_connection() as connection:
        row = connection.execute(f"{TAB_SELECT} WHERE tabs.id = ?", (tab_id,)).fetchone()
    if row is None:
        raise NotFoundError("Tab not found")
    return Tab(**dict(row))


def list_tabs() -> list[Tab]:
    with get_connection() as connection:
        rows = connection.execute(f"{TAB_SELECT} ORDER BY tabs.sort_order, tabs.id").fetchall()
    return [Tab(**dict(row)) for row in rows]


def create_tab(name: str) -> Tab:
    with get_connection() as connection:
        cursor = connection.execute(
            """INSERT INTO tabs (name, sort_order)
               VALUES (?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tabs))""",
            (name,),
        )
        tab_id = cursor.lastrowid
    return fetch_tab(tab_id)


def update_tab(tab_id: int, name: str) -> Tab:
    with get_connection() as connection:
        if connection.execute("UPDATE tabs SET name = ? WHERE id = ?", (name, tab_id)).rowcount == 0:
            raise NotFoundError("Tab not found")
    return fetch_tab(tab_id)


def reorder_tabs(tab_ids: list[int]) -> None:
    if len(tab_ids) != len(set(tab_ids)):
        raise InvalidOrderError("Tab IDs must be unique")
    with get_connection() as connection:
        current_ids = [row[0] for row in connection.execute("SELECT id FROM tabs")]
        if set(tab_ids) != set(current_ids):
            raise ConflictError("Tab list is out of date")
        connection.executemany("UPDATE tabs SET sort_order = ? WHERE id = ?", enumerate(tab_ids))


def delete_tab(tab_id: int) -> None:
    with get_connection() as connection:
        if connection.execute("DELETE FROM tabs WHERE id = ?", (tab_id,)).rowcount == 0:
            raise NotFoundError("Tab not found")
