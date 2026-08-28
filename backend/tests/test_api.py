import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


API = "/flashcards/api"


class FlashcardsApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = Path(self.temp_dir.name) / "api.db"
        self.environment = patch.dict(os.environ, {"FLASHCARDS_DATABASE_PATH": str(self.database)})
        self.environment.start()
        self.client_context = TestClient(app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        self.environment.stop()
        self.temp_dir.cleanup()

    def create_tab(self, name="Languages"):
        response = self.client.post(f"{API}/tabs", json={"name": name})
        self.assertEqual(response.status_code, 201)
        return response.json()

    def create_group(self, tab_id, name="Hebrew"):
        response = self.client.post(
            f"{API}/groups", json={"name": name, "tab_id": tab_id, "color": "#ffffff"}
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_complete_card_workflow(self):
        tab = self.create_tab()
        group = self.create_group(tab["id"])
        created = self.client.post(
            f"{API}/cards", json={"front": "Hello", "back": "שלום", "group_id": group["id"]}
        )
        self.assertEqual(created.status_code, 201)
        card = created.json()

        reviewed = self.client.post(f"{API}/cards/{card['id']}/review", json={"known": True})
        self.assertEqual(reviewed.status_code, 200)
        self.assertTrue(reviewed.json()["is_known"])

        tabs = self.client.get(f"{API}/tabs").json()
        groups = self.client.get(f"{API}/groups").json()
        self.assertEqual(tabs[0]["card_count"], 1)
        self.assertEqual(groups[0]["card_count"], 1)

        deleted = self.client.delete(f"{API}/cards/{card['id']}")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.client.get(f"{API}/cards").json(), [])

    def test_domain_errors_become_expected_http_responses(self):
        missing = self.client.delete(f"{API}/cards/999")
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.json(), {"detail": "Card not found"})

        first = self.create_tab("First")
        self.create_tab("Second")
        conflict = self.client.put(f"{API}/tabs-order", json={"tab_ids": [first["id"]]})
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json(), {"detail": "Tab list is out of date"})

    def test_validation_errors_remain_422(self):
        empty_name = self.client.post(f"{API}/tabs", json={"name": "   "})
        self.assertEqual(empty_name.status_code, 422)

        tab = self.create_tab()
        bad_color = self.client.post(
            f"{API}/groups", json={"name": "Deck", "tab_id": tab["id"], "color": "red"}
        )
        self.assertEqual(bad_color.status_code, 422)

    def test_daily_tasks_keep_ordered_study_steps_and_today_completion(self):
        tab = self.create_tab()
        first = self.create_group(tab["id"], "First")
        second = self.create_group(tab["id"], "Second")
        payload = {
            "name": "Morning review",
            "task_type": "study",
            "tab_id": tab["id"],
            "steps": [
                {"group_id": second["id"], "rounds": 2, "card_subset": "unknown", "game_type": "alternating"},
                {"group_id": first["id"], "rounds": 1, "card_subset": "all", "game_type": "front"},
            ],
        }
        created = self.client.post(f"{API}/daily-tasks", json=payload)
        self.assertEqual(created.status_code, 201)
        task = created.json()
        self.assertFalse(task["completed"])
        self.assertEqual([step["group_id"] for step in task["steps"]], [second["id"], first["id"]])
        self.assertNotIn("cards_per_round", task["steps"][0])

        manual = self.client.put(f"{API}/daily-tasks/{task['id']}/completion", json={"completed": True})
        self.assertEqual(manual.status_code, 409)
        completed = self.client.post(f"{API}/daily-tasks/{task['id']}/complete-study")
        self.assertEqual(completed.status_code, 200)
        self.assertTrue(completed.json()["completed"])

        reopened = self.client.get(f"{API}/daily-tasks").json()[0]
        self.assertTrue(reopened["completed"])

        with closing(sqlite3.connect(self.database)) as connection, connection:
            connection.execute("UPDATE daily_task_completions SET completed_on = '2000-01-01'")
        self.assertFalse(self.client.get(f"{API}/daily-tasks").json()[0]["completed"])

        blocked_delete = self.client.delete(f"{API}/groups/{second['id']}")
        self.assertEqual(blocked_delete.status_code, 409)

        self.assertEqual(self.client.delete(f"{API}/tabs/{tab['id']}").status_code, 204)
        self.assertEqual(self.client.get(f"{API}/daily-tasks").json(), [])

    def test_general_daily_task_can_be_manually_completed(self):
        created = self.client.post(
            f"{API}/daily-tasks",
            json={"name": "Read", "task_type": "general", "tab_id": None, "link": "https://example.com/read", "steps": []},
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["link"], "https://example.com/read")
        task_id = created.json()["id"]
        self.assertTrue(self.client.put(
            f"{API}/daily-tasks/{task_id}/completion", json={"completed": True}
        ).json()["completed"])

        self.assertEqual(self.client.delete(f"{API}/daily-tasks/{task_id}").status_code, 204)
        self.assertEqual(self.client.get(f"{API}/daily-tasks").json(), [])

    def test_daily_task_links_accept_only_web_urls_and_only_for_general_tasks(self):
        invalid = self.client.post(
            f"{API}/daily-tasks",
            json={"name": "Bad", "task_type": "general", "link": "javascript:alert(1)", "steps": []},
        )
        self.assertEqual(invalid.status_code, 422)

        tab = self.create_tab()
        group = self.create_group(tab["id"])
        study_with_link = self.client.post(
            f"{API}/daily-tasks",
            json={
                "name": "Study", "task_type": "study", "tab_id": tab["id"],
                "link": "https://example.com", "steps": [{
                    "group_id": group["id"], "rounds": 1, "card_subset": "all", "game_type": "front",
                }],
            },
        )
        self.assertEqual(study_with_link.status_code, 422)

    def test_daily_history_keeps_aggregate_snapshots(self):
        first = self.client.post(
            f"{API}/daily-tasks",
            json={"name": "Read", "task_type": "general", "steps": []},
        ).json()
        second = self.client.post(
            f"{API}/daily-tasks",
            json={"name": "Listen", "task_type": "general", "steps": []},
        ).json()
        self.client.put(f"{API}/daily-tasks/{first['id']}/completion", json={"completed": True})

        today = self.client.get(f"{API}/daily-tasks/history").json()[-1]
        self.assertEqual((today["completed_count"], today["task_count"]), (1, 2))

        with closing(sqlite3.connect(self.database)) as connection, connection:
            connection.execute(
                "UPDATE daily_task_history SET completed_on = '2000-01-01' WHERE completed_on = ?",
                (today["completed_on"],),
            )
        self.client.delete(f"{API}/daily-tasks/{second['id']}")

        history = self.client.get(f"{API}/daily-tasks/history").json()
        self.assertEqual(history[0], {
            "completed_on": "2000-01-01", "completed_count": 1, "task_count": 2,
        })
        self.assertEqual((history[-1]["completed_count"], history[-1]["task_count"]), (1, 1))

        with closing(sqlite3.connect(self.database)) as connection, connection:
            connection.execute(
                "INSERT OR IGNORE INTO daily_task_completions (task_id, completed_on) VALUES (?, '1999-01-01')",
                (first["id"],),
            )
        self.client.get(f"{API}/daily-tasks/history")
        with closing(sqlite3.connect(self.database)) as connection:
            old_details = connection.execute(
                "SELECT COUNT(*) FROM daily_task_completions WHERE completed_on = '1999-01-01'"
            ).fetchone()[0]
        self.assertEqual(old_details, 0)
