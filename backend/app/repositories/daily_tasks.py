from ..database import get_connection
from ..errors import ConflictError, InvalidOrderError, NotFoundError
from ..schemas import DailyHistory, DailyTask, DailyTaskFields, DailyTaskStep


def _refresh_today_history(connection) -> None:
    connection.execute(
        """INSERT INTO daily_task_history (completed_on, completed_count, task_count, updated_at)
           VALUES (
               date('now', 'localtime'),
               (SELECT COUNT(*) FROM daily_task_completions
                WHERE completed_on = date('now', 'localtime')),
               (SELECT COUNT(*) FROM daily_tasks),
               CURRENT_TIMESTAMP
           )
           ON CONFLICT(completed_on) DO UPDATE SET
               completed_count = excluded.completed_count,
               task_count = excluded.task_count,
               updated_at = CURRENT_TIMESTAMP"""
    )
    connection.execute(
        "DELETE FROM daily_task_completions WHERE completed_on < date('now', 'localtime')"
    )


def _steps(connection, task_id: int) -> list[DailyTaskStep]:
    rows = connection.execute(
        """SELECT group_id, rounds, card_subset, game_type
           FROM daily_task_steps WHERE task_id = ? ORDER BY sort_order, id""",
        (task_id,),
    ).fetchall()
    return [DailyTaskStep(**dict(row)) for row in rows]


def _task(connection, row) -> DailyTask:
    data = dict(row)
    data["completed"] = bool(data["completed"])
    data["steps"] = _steps(connection, data["id"])
    return DailyTask(**data)


def fetch_daily_task(task_id: int) -> DailyTask:
    with get_connection() as connection:
        row = connection.execute(
            """SELECT daily_tasks.*,
                      EXISTS(SELECT 1 FROM daily_task_completions
                             WHERE task_id = daily_tasks.id AND completed_on = date('now', 'localtime')) AS completed
               FROM daily_tasks WHERE id = ?""",
            (task_id,),
        ).fetchone()
        if row is None:
            raise NotFoundError("Daily task not found")
        return _task(connection, row)


def list_daily_tasks() -> list[DailyTask]:
    with get_connection() as connection:
        rows = connection.execute(
            """SELECT daily_tasks.*,
                      EXISTS(SELECT 1 FROM daily_task_completions
                             WHERE task_id = daily_tasks.id AND completed_on = date('now', 'localtime')) AS completed
               FROM daily_tasks ORDER BY sort_order, id"""
        ).fetchall()
        return [_task(connection, row) for row in rows]


def list_daily_history() -> list[DailyHistory]:
    with get_connection() as connection:
        _refresh_today_history(connection)
        rows = connection.execute(
            """SELECT completed_on, completed_count, task_count
               FROM daily_task_history ORDER BY completed_on"""
        ).fetchall()
        return [DailyHistory(**dict(row)) for row in rows]


def _validate_study_configuration(connection, payload: DailyTaskFields) -> None:
    if payload.task_type != "study":
        return
    group_ids = [step.group_id for step in payload.steps]
    placeholders = ",".join("?" for _ in group_ids)
    rows = connection.execute(
        f"SELECT id FROM card_groups WHERE tab_id = ? AND id IN ({placeholders})",
        (payload.tab_id, *group_ids),
    ).fetchall()
    if {row["id"] for row in rows} != set(group_ids):
        raise NotFoundError("A configured deck does not belong to this workspace")


def _replace_steps(connection, task_id: int, steps: list[DailyTaskStep]) -> None:
    connection.execute("DELETE FROM daily_task_steps WHERE task_id = ?", (task_id,))
    connection.executemany(
        """INSERT INTO daily_task_steps
           (task_id, group_id, sort_order, rounds, card_subset, game_type)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [
            (task_id, step.group_id, index, step.rounds, step.card_subset, step.game_type)
            for index, step in enumerate(steps)
        ],
    )


def create_daily_task(payload: DailyTaskFields) -> DailyTask:
    with get_connection() as connection:
        _validate_study_configuration(connection, payload)
        cursor = connection.execute(
            """INSERT INTO daily_tasks (name, task_type, tab_id, link, sort_order)
               VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM daily_tasks))""",
            (payload.name, payload.task_type, payload.tab_id, payload.link),
        )
        task_id = cursor.lastrowid
        _replace_steps(connection, task_id, payload.steps)
        _refresh_today_history(connection)
    return fetch_daily_task(task_id)


def update_daily_task(task_id: int, payload: DailyTaskFields) -> DailyTask:
    with get_connection() as connection:
        _validate_study_configuration(connection, payload)
        cursor = connection.execute(
            "UPDATE daily_tasks SET name = ?, task_type = ?, tab_id = ?, link = ? WHERE id = ?",
            (payload.name, payload.task_type, payload.tab_id, payload.link, task_id),
        )
        if cursor.rowcount == 0:
            raise NotFoundError("Daily task not found")
        _replace_steps(connection, task_id, payload.steps)
        _refresh_today_history(connection)
    return fetch_daily_task(task_id)


def set_daily_task_completion(task_id: int, completed: bool, allow_study: bool = False) -> DailyTask:
    with get_connection() as connection:
        row = connection.execute("SELECT task_type FROM daily_tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            raise NotFoundError("Daily task not found")
        if row["task_type"] == "study" and not allow_study:
            raise ConflictError("Study tasks complete only after their configured session")
        if completed:
            connection.execute(
                "INSERT OR IGNORE INTO daily_task_completions (task_id, completed_on) VALUES (?, date('now', 'localtime'))",
                (task_id,),
            )
        else:
            connection.execute(
                "DELETE FROM daily_task_completions WHERE task_id = ? AND completed_on = date('now', 'localtime')",
                (task_id,),
            )
        _refresh_today_history(connection)
    return fetch_daily_task(task_id)


def complete_daily_study(task_id: int) -> DailyTask:
    with get_connection() as connection:
        row = connection.execute("SELECT task_type FROM daily_tasks WHERE id = ?", (task_id,)).fetchone()
    if row is None:
        raise NotFoundError("Daily task not found")
    if row["task_type"] != "study":
        raise ConflictError("Only study tasks can complete through a study session")
    return set_daily_task_completion(task_id, True, allow_study=True)


def reorder_daily_tasks(task_ids: list[int]) -> None:
    if len(task_ids) != len(set(task_ids)):
        raise InvalidOrderError("Daily task IDs must be unique")
    with get_connection() as connection:
        current_ids = [row[0] for row in connection.execute("SELECT id FROM daily_tasks")]
        if set(task_ids) != set(current_ids):
            raise ConflictError("Daily task list is out of date")
        connection.executemany("UPDATE daily_tasks SET sort_order = ? WHERE id = ?", enumerate(task_ids))


def delete_daily_task(task_id: int) -> None:
    with get_connection() as connection:
        if connection.execute("DELETE FROM daily_tasks WHERE id = ?", (task_id,)).rowcount == 0:
            raise NotFoundError("Daily task not found")
        _refresh_today_history(connection)
