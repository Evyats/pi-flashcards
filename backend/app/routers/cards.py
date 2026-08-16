from fastapi import APIRouter, HTTPException, Response, status

from .. import repositories as repository
from ..schemas import Card, CardFields, CardReview

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("", response_model=list[Card])
def list_cards(group_id: int | None = None):
    return repository.list_cards(group_id)


@router.post("", response_model=Card, status_code=status.HTTP_201_CREATED)
def create_card(payload: CardFields):
    return repository.create_card(payload)


@router.post("/bulk", response_model=list[Card], status_code=status.HTTP_201_CREATED)
def create_cards_bulk(payload: list[CardFields]):
    if not payload or len(payload) > 200:
        raise HTTPException(status_code=400, detail="Bulk imports require between 1 and 200 cards")
    if len({card.group_id for card in payload}) != 1:
        raise HTTPException(status_code=400, detail="All imported cards must belong to one group")
    return repository.create_cards(payload)


@router.put("/{card_id}", response_model=Card)
def update_card(card_id: int, payload: CardFields):
    return repository.update_card(card_id, payload)


@router.post("/{card_id}/review", response_model=Card)
def review_card(card_id: int, payload: CardReview):
    return repository.review_card(card_id, payload.known)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(card_id: int):
    repository.delete_card(card_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
