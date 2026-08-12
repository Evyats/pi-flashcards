from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response, status
from pydantic import BaseModel, field_validator

from .database import get_connection, initialize_database


API_PREFIX = "/flashcards/api"


class CardFields(BaseModel):
    front: str
    back: str

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


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="Flashcards API", version="1.0.0", lifespan=lifespan)


def fetch_card(card_id: int) -> Card:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, front, back, created_at FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return Card(**dict(row))


@app.get(f"{API_PREFIX}/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(f"{API_PREFIX}/cards", response_model=list[Card])
def list_cards() -> list[Card]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, front, back, created_at FROM cards ORDER BY id DESC"
        ).fetchall()
    return [Card(**dict(row)) for row in rows]


@app.post(f"{API_PREFIX}/cards", response_model=Card, status_code=status.HTTP_201_CREATED)
def create_card(payload: CardFields) -> Card:
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO cards (front, back) VALUES (?, ?)",
            (payload.front, payload.back),
        )
        card_id = cursor.lastrowid
    return fetch_card(card_id)


@app.put(f"{API_PREFIX}/cards/{{card_id}}", response_model=Card)
def update_card(card_id: int, payload: CardFields) -> Card:
    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE cards SET front = ?, back = ? WHERE id = ?",
            (payload.front, payload.back, card_id),
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

