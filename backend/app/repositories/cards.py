from datetime import datetime, timedelta, timezone

from ..database import get_connection
from ..errors import NotFoundError
from ..schemas import Card, CardFields


CARD_SELECT = """
    SELECT id, front, back, group_id, created_at, memory_level, next_review_at,
           CASE WHEN next_review_at IS NOT NULL AND datetime(next_review_at) > CURRENT_TIMESTAMP
                THEN 1 ELSE 0 END AS is_known
    FROM cards
"""
REVIEW_INTERVALS = (1, 3, 7, 14, 30)


def fetch_card(card_id: int) -> Card:
    with get_connection() as connection:
        row = connection.execute(f"{CARD_SELECT} WHERE id = ?", (card_id,)).fetchone()
    if row is None:
        raise NotFoundError("Card not found")
    return Card(**dict(row))


def list_cards(group_id: int | None = None) -> list[Card]:
    where, parameters = ("", ()) if group_id is None else (" WHERE group_id = ?", (group_id,))
    with get_connection() as connection:
        rows = connection.execute(f"{CARD_SELECT}{where} ORDER BY id DESC", parameters).fetchall()
    return [Card(**dict(row)) for row in rows]


def create_card(payload: CardFields) -> Card:
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO cards (front, back, group_id) SELECT ?, ?, id FROM card_groups WHERE id = ?",
            (payload.front, payload.back, payload.group_id),
        )
        if cursor.rowcount == 0:
            raise NotFoundError("Group not found")
        card_id = cursor.lastrowid
    return fetch_card(card_id)


def create_cards(payload: list[CardFields]) -> list[Card]:
    if not payload:
        return []
    group_id = payload[0].group_id
    with get_connection() as connection:
        if connection.execute("SELECT 1 FROM card_groups WHERE id = ?", (group_id,)).fetchone() is None:
            raise NotFoundError("Group not found")
        card_ids = []
        for card in payload:
            cursor = connection.execute(
                "INSERT INTO cards (front, back, group_id) VALUES (?, ?, ?)",
                (card.front, card.back, group_id),
            )
            card_ids.append(cursor.lastrowid)
        placeholders = ",".join("?" for _ in card_ids)
        rows = connection.execute(
            f"{CARD_SELECT} WHERE id IN ({placeholders}) ORDER BY id DESC", card_ids
        ).fetchall()
    return [Card(**dict(row)) for row in rows]


def update_card(card_id: int, payload: CardFields) -> Card:
    with get_connection() as connection:
        cursor = connection.execute(
            """UPDATE cards SET front = ?, back = ?, group_id = ?
               WHERE id = ? AND EXISTS (SELECT 1 FROM card_groups WHERE id = ?)""",
            (payload.front, payload.back, payload.group_id, card_id, payload.group_id),
        )
        if cursor.rowcount == 0:
            raise NotFoundError("Card not found")
    return fetch_card(card_id)


def review_card(card_id: int, known: bool) -> Card:
    with get_connection() as connection:
        row = connection.execute("SELECT memory_level FROM cards WHERE id = ?", (card_id,)).fetchone()
        if row is None:
            raise NotFoundError("Card not found")
        if known:
            level = min(row["memory_level"] + 1, len(REVIEW_INTERVALS))
            next_review = datetime.now(timezone.utc) + timedelta(days=REVIEW_INTERVALS[level - 1])
            connection.execute(
                "UPDATE cards SET memory_level = ?, next_review_at = ? WHERE id = ?",
                (level, next_review.isoformat(), card_id),
            )
        else:
            connection.execute(
                "UPDATE cards SET memory_level = 0, next_review_at = NULL WHERE id = ?", (card_id,)
            )
    return fetch_card(card_id)


def delete_card(card_id: int) -> None:
    with get_connection() as connection:
        if connection.execute("DELETE FROM cards WHERE id = ?", (card_id,)).rowcount == 0:
            raise NotFoundError("Card not found")
