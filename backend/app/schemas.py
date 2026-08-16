import re

from pydantic import BaseModel, field_validator


HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class NamedFields(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Name cannot be empty")
        if len(name) > 100:
            raise ValueError("Name cannot exceed 100 characters")
        return name


class Tab(NamedFields):
    id: int
    sort_order: int
    created_at: str
    group_count: int = 0
    card_count: int = 0


class GroupFields(NamedFields):
    tab_id: int
    color: str = "#ffffff"

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        if not HEX_COLOR.fullmatch(value):
            raise ValueError("Deck color must be a six-digit hex color")
        return value.lower()


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
    memory_level: int
    next_review_at: str | None = None
    is_known: bool


class CardReview(BaseModel):
    known: bool


class TabOrder(BaseModel):
    tab_ids: list[int]


class GroupOrder(BaseModel):
    tab_id: int
    group_ids: list[int]
