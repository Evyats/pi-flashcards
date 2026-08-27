from fastapi import APIRouter, Response, status

from .. import repositories as repository
from ..schemas import DailyTask, DailyTaskCompletion, DailyTaskFields, DailyTaskOrder

router = APIRouter(prefix="/daily-tasks", tags=["daily learning"])


@router.get("", response_model=list[DailyTask])
def list_daily_tasks():
    return repository.list_daily_tasks()


@router.post("", response_model=DailyTask, status_code=status.HTTP_201_CREATED)
def create_daily_task(payload: DailyTaskFields):
    return repository.create_daily_task(payload)


@router.put("-order", status_code=status.HTTP_204_NO_CONTENT)
def reorder_daily_tasks(payload: DailyTaskOrder):
    repository.reorder_daily_tasks(payload.task_ids)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{task_id}", response_model=DailyTask)
def update_daily_task(task_id: int, payload: DailyTaskFields):
    return repository.update_daily_task(task_id, payload)


@router.put("/{task_id}/completion", response_model=DailyTask)
def set_daily_task_completion(task_id: int, payload: DailyTaskCompletion):
    return repository.set_daily_task_completion(task_id, payload.completed)


@router.post("/{task_id}/complete-study", response_model=DailyTask)
def complete_daily_study(task_id: int):
    return repository.complete_daily_study(task_id)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_daily_task(task_id: int):
    repository.delete_daily_task(task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
