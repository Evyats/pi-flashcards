import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app.database import get_connection, initialize_database
from app.errors import ConflictError
from app import repositories
from app.migrations import MIGRATIONS
from app.routers.cards import create_cards_bulk
from app.schemas import CardFields, GroupFields


class FlashcardsTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = Path(self.temp_dir.name) / "flashcards.db"
        self.environment = patch.dict(os.environ, {"FLASHCARDS_DATABASE_PATH": str(self.database)})
        self.environment.start()
        initialize_database()

    def tearDown(self):
        self.environment.stop()
        self.temp_dir.cleanup()

    def create_structure(self):
        tab = repositories.create_tab("Languages")
        group = repositories.create_group(GroupFields(name="Hebrew", tab_id=tab.id))
        return tab, group

    def test_create_entities_updates_aggregate_counts(self):
        tab, group = self.create_structure()
        card = repositories.create_card(CardFields(front="Hello", back="שלום", group_id=group.id))

        self.assertEqual(card.group_id, group.id)
        self.assertEqual(repositories.list_groups()[0].card_count, 1)
        self.assertEqual(repositories.list_tabs()[0].card_count, 1)

    def test_review_schedules_known_card_and_resets_unknown_card(self):
        _, group = self.create_structure()
        card = repositories.create_card(CardFields(front="Hello", back="שלום", group_id=group.id))

        known = repositories.review_card(card.id, True)
        self.assertTrue(known.is_known)
        self.assertEqual(known.memory_level, 1)
        self.assertIsNotNone(known.next_review_at)

        unknown = repositories.review_card(card.id, False)
        self.assertFalse(unknown.is_known)
        self.assertEqual(unknown.memory_level, 0)
        self.assertIsNone(unknown.next_review_at)

    def test_review_level_progresses_and_stops_at_maximum(self):
        _, group = self.create_structure()
        card = repositories.create_card(CardFields(front="Hello", back="שלום", group_id=group.id))

        for expected_level in [1, 2, 3, 4, 5, 5]:
            card = repositories.review_card(card.id, True)
            self.assertEqual(card.memory_level, expected_level)

    def test_deleting_a_tab_cascades_to_groups_and_cards(self):
        tab, group = self.create_structure()
        repositories.create_card(CardFields(front="Hello", back="שלום", group_id=group.id))

        repositories.delete_tab(tab.id)

        self.assertEqual(repositories.list_tabs(), [])
        self.assertEqual(repositories.list_groups(), [])
        self.assertEqual(repositories.list_cards(), [])

    def test_bulk_import_validation_rejects_empty_and_mixed_groups(self):
        _, first_group = self.create_structure()
        second_tab = repositories.create_tab("Other")
        second_group = repositories.create_group(GroupFields(name="Other", tab_id=second_tab.id))

        with self.assertRaises(HTTPException) as empty_error:
            create_cards_bulk([])
        self.assertEqual(empty_error.exception.status_code, 400)

        mixed = [
            CardFields(front="One", back="א", group_id=first_group.id),
            CardFields(front="Two", back="ב", group_id=second_group.id),
        ]
        with self.assertRaises(HTTPException) as mixed_error:
            create_cards_bulk(mixed)
        self.assertEqual(mixed_error.exception.status_code, 400)

    def test_reordering_requires_complete_current_lists(self):
        first = repositories.create_tab("First")
        second = repositories.create_tab("Second")
        repositories.reorder_tabs([second.id, first.id])
        self.assertEqual([tab.id for tab in repositories.list_tabs()], [second.id, first.id])

        first_group = repositories.create_group(GroupFields(name="One", tab_id=first.id))
        second_group = repositories.create_group(GroupFields(name="Two", tab_id=first.id))
        repositories.reorder_groups(first.id, [second_group.id, first_group.id])
        self.assertEqual([group.id for group in repositories.list_groups(first.id)], [second_group.id, first_group.id])

        with self.assertRaises(ConflictError):
            repositories.reorder_groups(first.id, [first_group.id])

    def test_legacy_ungrouped_cards_receive_a_group_with_a_tab(self):
        self.database.unlink()
        with closing(sqlite3.connect(self.database)) as connection, connection:
            connection.execute("CREATE TABLE cards (id INTEGER PRIMARY KEY, front TEXT, back TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)")
            connection.execute("INSERT INTO cards (front, back) VALUES ('Hello', 'שלום')")

        initialize_database()

        with get_connection() as connection:
            row = connection.execute(
                "SELECT cards.group_id, card_groups.tab_id FROM cards JOIN card_groups ON card_groups.id = cards.group_id"
            ).fetchone()
        self.assertIsNotNone(row)
        self.assertIsNotNone(row["group_id"])
        self.assertIsNotNone(row["tab_id"])
        self.assertEqual(len(repositories.list_cards()), 1)

        with get_connection() as connection:
            version = connection.execute("PRAGMA user_version").fetchone()[0]
        self.assertEqual(version, len(MIGRATIONS))

        initialize_database()
        self.assertEqual(len(repositories.list_cards()), 1)


if __name__ == "__main__":
    unittest.main()
