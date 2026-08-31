import re
from urllib.parse import urlsplit

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


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


class DailyTaskStep(BaseModel):
    group_id: int | None = None
    rounds: int = Field(ge=1, le=20)
    card_subset: Literal["all", "known", "unknown"]
    game_type: Literal["alternating", "front", "back"]


class DailyTaskFields(NamedFields):
    task_type: Literal["general", "study"]
    tab_id: int | None = None
    link: str | None = None
    steps: list[DailyTaskStep] = Field(default_factory=list)

    @field_validator("link", mode="before")
    @classmethod
    def validate_link(cls, value):
        if value is None:
            return None
        link = str(value).strip()
        if not link:
            return None
        parsed = urlsplit(link)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Link must be a complete http or https URL")
        if len(link) > 2048:
            raise ValueError("Link cannot exceed 2048 characters")
        return link

    @model_validator(mode="after")
    def validate_configuration(self):
        if self.task_type == "general":
            if self.tab_id is not None or self.steps:
                raise ValueError("General tasks cannot have a study configuration")
        elif self.tab_id is None or not self.steps:
            raise ValueError("Study tasks require a workspace and at least one deck")
        elif self.link is not None:
            raise ValueError("Study tasks cannot have a link")
        if len({step.group_id for step in self.steps}) != len(self.steps):
            raise ValueError("Each deck can appear only once in a study task")
        return self


class DailyTask(DailyTaskFields):
    id: int
    sort_order: int
    created_at: str
    completed: bool


class DailyTaskCompletion(BaseModel):
    completed: bool


class DailyTaskOrder(BaseModel):
    task_ids: list[int]


class DailyHistory(BaseModel):
    completed_on: str
    completed_count: int
    task_count: int
