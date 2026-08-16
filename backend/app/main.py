from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response, status
from pydantic import BaseModel, field_validator

from .database import get_connection, initialize_database


API_PREFIX = "/flashcards/api"


class NamedFields(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Group name cannot be empty")
        if len(name) > 100:
            raise ValueError("Group name cannot exceed 100 characters")
        return name


class Tab(NamedFields):
    id: int
    sort_order: int
    created_at: str
    group_count: int = 0


class GroupFields(NamedFields):
    tab_id: int
    color: str = "#ffffff"

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        allowed = {"#ffffff", "#f2c7cf", "#f1c5ad", "#efd69a", "#cde3ad", "#bde0d7", "#acdfe9", "#bfd5f5", "#d6c4eb"}
        if value not in allowed:
            raise ValueError("Unsupported deck color")
        return value


class Group(GroupFields):
    id: int
    sort_order: int
    created_at: str
    card_count: int = 0


class CardFields(BaseModel):
    front: str
    back: str
    group_id: int

    @field_validator("front", "back")
    @classmethod
    def validate_text(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Card text cannot be empty")
        if len(text) > 2000:
            raise ValueError("Card text cannot exceed 2000 characters")
        return text


class Card(CardFields):
    id: int
    created_at: str


class TabOrder(BaseModel):
    tab_ids: list[int]


class GroupOrder(BaseModel):
    tab_id: int
    group_ids: list[int]


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="Flashcards API", version="1.0.0", lifespan=lifespan)


def fetch_card(card_id: int) -> Card:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, front, back, group_id, created_at FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return Card(**dict(row))


@app.get(f"{API_PREFIX}/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(f"{API_PREFIX}/cards", response_model=list[Card])
def list_cards(group_id: int | None = None) -> list[Card]:
    with get_connection() as connection:
        if group_id is None:
            rows = connection.execute(
                "SELECT id, front, back, group_id, created_at FROM cards ORDER BY id DESC"
            ).fetchall()
        else:
            rows = connection.execute(
                "SELECT id, front, back, group_id, created_at FROM cards WHERE group_id = ? ORDER BY id DESC",
                (group_id,),
            ).fetchall()
    return [Card(**dict(row)) for row in rows]


@app.post(f"{API_PREFIX}/cards", response_model=Card, status_code=status.HTTP_201_CREATED)
def create_card(payload: CardFields) -> Card:
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO cards (front, back, group_id) SELECT ?, ?, id FROM card_groups WHERE id = ?",
            (payload.front, payload.back, payload.group_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Group not found")
        card_id = cursor.lastrowid
    return fetch_card(card_id)


@app.post(f"{API_PREFIX}/cards/bulk", response_model=list[Card], status_code=status.HTTP_201_CREATED)
def create_cards_bulk(payload: list[CardFields]) -> list[Card]:
    if not payload:
        raise HTTPException(status_code=400, detail="At least one card is required")
    if len(payload) > 200:
        raise HTTPException(status_code=400, detail="A bulk import can contain at most 200 cards")
    group_ids = {card.group_id for card in payload}
    if len(group_ids) != 1:
        raise HTTPException(status_code=400, detail="All imported cards must belong to one group")
    group_id = next(iter(group_ids))
    with get_connection() as connection:
        if connection.execute("SELECT 1 FROM card_groups WHERE id = ?", (group_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Group not found")
        card_ids = []
        for card in payload:
            cursor = connection.execute(
                "INSERT INTO cards (front, back, group_id) VALUES (?, ?, ?)",
                (card.front, card.back, group_id),
            )
            card_ids.append(cursor.lastrowid)
        placeholders = ",".join("?" for _ in card_ids)
        rows = connection.execute(
            f"SELECT id, front, back, group_id, created_at FROM cards WHERE id IN ({placeholders}) ORDER BY id DESC",
            card_ids,
        ).fetchall()
    return [Card(**dict(row)) for row in rows]


@app.put(f"{API_PREFIX}/cards/{{card_id}}", response_model=Card)
def update_card(card_id: int, payload: CardFields) -> Card:
    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE cards SET front = ?, back = ?, group_id = ? WHERE id = ? AND EXISTS (SELECT 1 FROM card_groups WHERE id = ?)",
            (payload.front, payload.back, payload.group_id, card_id, payload.group_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Card not found")
    return fetch_card(card_id)


@app.delete(f"{API_PREFIX}/cards/{{card_id}}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(card_id: int) -> Response:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM cards WHERE id = ?", (card_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Card not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{API_PREFIX}/groups", response_model=list[Group])
def list_groups(tab_id: int | None = None) -> list[Group]:
    with get_connection() as connection:
        query = """
            SELECT card_groups.id, card_groups.name, card_groups.tab_id, card_groups.color, card_groups.sort_order, card_groups.created_at,
                   COUNT(cards.id) AS card_count
            FROM card_groups
            LEFT JOIN cards ON cards.group_id = card_groups.id
        """
        parameters = ()
        if tab_id is not None:
            query += " WHERE card_groups.tab_id = ?"
            parameters = (tab_id,)
        query += """
            GROUP BY card_groups.id
            ORDER BY card_groups.tab_id ASC, card_groups.sort_order ASC, card_groups.id ASC
        """
        rows = connection.execute(query, parameters).fetchall()
    return [Group(**dict(row)) for row in rows]


@app.post(f"{API_PREFIX}/groups", response_model=Group, status_code=status.HTTP_201_CREATED)
def create_group(payload: GroupFields) -> Group:
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO card_groups (name, tab_id, color, sort_order)
            SELECT ?, id, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM card_groups WHERE tab_id = ?), 0)
            FROM tabs WHERE id = ?
            """,
            (payload.name, payload.color, payload.tab_id, payload.tab_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Tab not found")
        group_id = cursor.lastrowid
        row = connection.execute(
            "SELECT id, name, tab_id, color, sort_order, created_at, 0 AS card_count FROM card_groups WHERE id = ?",
            (group_id,),
        ).fetchone()
    return Group(**dict(row))


@app.put(f"{API_PREFIX}/groups/{{group_id}}", response_model=Group)
def update_group(group_id: int, payload: GroupFields) -> Group:
    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE card_groups SET name = ?, tab_id = ?, color = ? WHERE id = ? AND EXISTS (SELECT 1 FROM tabs WHERE id = ?)",
            (payload.name, payload.tab_id, payload.color, group_id, payload.tab_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Group not found")
        row = connection.execute(
            """SELECT card_groups.id, card_groups.name, card_groups.tab_id, card_groups.color, card_groups.sort_order, card_groups.created_at,
                      COUNT(cards.id) AS card_count
               FROM card_groups LEFT JOIN cards ON cards.group_id = card_groups.id
               WHERE card_groups.id = ? GROUP BY card_groups.id""",
            (group_id,),
        ).fetchone()
    return Group(**dict(row))


@app.put(f"{API_PREFIX}/groups-order", status_code=status.HTTP_204_NO_CONTENT)
def reorder_groups(payload: GroupOrder) -> Response:
    if len(payload.group_ids) != len(set(payload.group_ids)):
        raise HTTPException(status_code=400, detail="Group IDs must be unique")
    with get_connection() as connection:
        current_ids = [
            row[0]
            for row in connection.execute(
                "SELECT id FROM card_groups WHERE tab_id = ?", (payload.tab_id,)
            )
        ]
        if set(payload.group_ids) != set(current_ids):
            raise HTTPException(status_code=409, detail="Deck list is out of date")
        connection.executemany(
            "UPDATE card_groups SET sort_order = ? WHERE id = ? AND tab_id = ?",
            [(position, group_id, payload.tab_id) for position, group_id in enumerate(payload.group_ids)],
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.delete(f"{API_PREFIX}/groups/{{group_id}}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int) -> Response:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM card_groups WHERE id = ?", (group_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Group not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{API_PREFIX}/tabs", response_model=list[Tab])
def list_tabs() -> list[Tab]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT tabs.id, tabs.name, tabs.sort_order, tabs.created_at,
                   COUNT(card_groups.id) AS group_count
            FROM tabs
            LEFT JOIN card_groups ON card_groups.tab_id = tabs.id
            GROUP BY tabs.id
            ORDER BY tabs.sort_order ASC, tabs.id ASC
            """
        ).fetchall()
    return [Tab(**dict(row)) for row in rows]


@app.post(f"{API_PREFIX}/tabs", response_model=Tab, status_code=status.HTTP_201_CREATED)
def create_tab(payload: NamedFields) -> Tab:
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO tabs (name, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tabs))",
            (payload.name,),
        )
        row = connection.execute(
            "SELECT id, name, sort_order, created_at, 0 AS group_count FROM tabs WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return Tab(**dict(row))


@app.put(f"{API_PREFIX}/tabs/{{tab_id}}", response_model=Tab)
def update_tab(tab_id: int, payload: NamedFields) -> Tab:
    with get_connection() as connection:
        cursor = connection.execute("UPDATE tabs SET name = ? WHERE id = ?", (payload.name, tab_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Tab not found")
        row = connection.execute(
            """SELECT tabs.id, tabs.name, tabs.sort_order, tabs.created_at,
                      COUNT(card_groups.id) AS group_count
               FROM tabs LEFT JOIN card_groups ON card_groups.tab_id = tabs.id
               WHERE tabs.id = ? GROUP BY tabs.id""",
            (tab_id,),
        ).fetchone()
    return Tab(**dict(row))


@app.put(f"{API_PREFIX}/tabs-order", status_code=status.HTTP_204_NO_CONTENT)
def reorder_tabs(payload: TabOrder) -> Response:
    if len(payload.tab_ids) != len(set(payload.tab_ids)):
        raise HTTPException(status_code=400, detail="Tab IDs must be unique")
    with get_connection() as connection:
        current_ids = [row[0] for row in connection.execute("SELECT id FROM tabs")]
        if set(payload.tab_ids) != set(current_ids):
            raise HTTPException(status_code=409, detail="Tab list is out of date")
        connection.executemany(
            "UPDATE tabs SET sort_order = ? WHERE id = ?",
            [(position, tab_id) for position, tab_id in enumerate(payload.tab_ids)],
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.delete(f"{API_PREFIX}/tabs/{{tab_id}}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tab(tab_id: int) -> Response:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM tabs WHERE id = ?", (tab_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Tab not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
