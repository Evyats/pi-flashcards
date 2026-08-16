from ..database import get_connection
from ..errors import ConflictError, InvalidOrderError, NotFoundError
from ..schemas import Group, GroupFields


GROUP_SELECT = """
    SELECT card_groups.id, card_groups.name, card_groups.tab_id, card_groups.color,
           card_groups.sort_order, card_groups.created_at, COUNT(cards.id) AS card_count
    FROM card_groups LEFT JOIN cards ON cards.group_id = card_groups.id
"""


def fetch_group(group_id: int) -> Group:
    with get_connection() as connection:
        row = connection.execute(
            f"{GROUP_SELECT} WHERE card_groups.id = ? GROUP BY card_groups.id", (group_id,)
        ).fetchone()
    if row is None:
        raise NotFoundError("Group not found")
    return Group(**dict(row))


def list_groups(tab_id: int | None = None) -> list[Group]:
    where, parameters = ("", ()) if tab_id is None else (" WHERE card_groups.tab_id = ?", (tab_id,))
    with get_connection() as connection:
        rows = connection.execute(
            f"{GROUP_SELECT}{where} GROUP BY card_groups.id "
            "ORDER BY card_groups.tab_id, card_groups.sort_order, card_groups.id",
            parameters,
        ).fetchall()
    return [Group(**dict(row)) for row in rows]


def create_group(payload: GroupFields) -> Group:
    with get_connection() as connection:
        cursor = connection.execute(
            """INSERT INTO card_groups (name, tab_id, color, sort_order)
               SELECT ?, id, ?, COALESCE(
                   (SELECT MAX(sort_order) + 1 FROM card_groups WHERE tab_id = ?), 0
               ) FROM tabs WHERE id = ?""",
            (payload.name, payload.color, payload.tab_id, payload.tab_id),
        )
        if cursor.rowcount == 0:
            raise NotFoundError("Tab not found")
        group_id = cursor.lastrowid
    return fetch_group(group_id)


def update_group(group_id: int, payload: GroupFields) -> Group:
    with get_connection() as connection:
        cursor = connection.execute(
            """UPDATE card_groups SET name = ?, tab_id = ?, color = ?
               WHERE id = ? AND EXISTS (SELECT 1 FROM tabs WHERE id = ?)""",
            (payload.name, payload.tab_id, payload.color, group_id, payload.tab_id),
        )
        if cursor.rowcount == 0:
            raise NotFoundError("Group not found")
    return fetch_group(group_id)


def reorder_groups(tab_id: int, group_ids: list[int]) -> None:
    if len(group_ids) != len(set(group_ids)):
        raise InvalidOrderError("Group IDs must be unique")
    with get_connection() as connection:
        current_ids = [
            row[0] for row in connection.execute("SELECT id FROM card_groups WHERE tab_id = ?", (tab_id,))
        ]
        if set(group_ids) != set(current_ids):
            raise ConflictError("Deck list is out of date")
        connection.executemany(
            "UPDATE card_groups SET sort_order = ? WHERE id = ? AND tab_id = ?",
            [(position, group_id, tab_id) for position, group_id in enumerate(group_ids)],
        )


def delete_group(group_id: int) -> None:
    with get_connection() as connection:
        if connection.execute("DELETE FROM card_groups WHERE id = ?", (group_id,)).rowcount == 0:
            raise NotFoundError("Group not found")
