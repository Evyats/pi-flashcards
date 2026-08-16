import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


API = "/flashcards/api"


class FlashcardsApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database = Path(self.temp_dir.name) / "api.db"
        self.environment = patch.dict(os.environ, {"FLASHCARDS_DATABASE_PATH": str(database)})
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
