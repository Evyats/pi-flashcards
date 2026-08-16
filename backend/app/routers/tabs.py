from fastapi import APIRouter, Response, status

from .. import repositories as repository
from ..schemas import NamedFields, Tab, TabOrder

router = APIRouter(prefix="/tabs", tags=["tabs"])


@router.get("", response_model=list[Tab])
def list_tabs():
    return repository.list_tabs()


@router.post("", response_model=Tab, status_code=status.HTTP_201_CREATED)
def create_tab(payload: NamedFields):
    return repository.create_tab(payload.name)


@router.put("-order", status_code=status.HTTP_204_NO_CONTENT)
def reorder_tabs(payload: TabOrder):
    repository.reorder_tabs(payload.tab_ids)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{tab_id}", response_model=Tab)
def update_tab(tab_id: int, payload: NamedFields):
    return repository.update_tab(tab_id, payload.name)


@router.delete("/{tab_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tab(tab_id: int):
    repository.delete_tab(tab_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
