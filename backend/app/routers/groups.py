from fastapi import APIRouter, Response, status

from .. import repositories as repository
from ..schemas import Group, GroupFields, GroupOrder

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("", response_model=list[Group])
def list_groups(tab_id: int | None = None):
    return repository.list_groups(tab_id)


@router.post("", response_model=Group, status_code=status.HTTP_201_CREATED)
def create_group(payload: GroupFields):
    return repository.create_group(payload)


@router.put("-order", status_code=status.HTTP_204_NO_CONTENT)
def reorder_groups(payload: GroupOrder):
    repository.reorder_groups(payload.tab_id, payload.group_ids)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{group_id}", response_model=Group)
def update_group(group_id: int, payload: GroupFields):
    return repository.update_group(group_id, payload)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int):
    repository.delete_group(group_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
