"""Tests for Pasal.id MCP server — all Supabase calls are mocked."""

import os
import pytest
from unittest.mock import MagicMock, patch

# Env vars required by server module at import time
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "fake-key")

# Patch create_client before importing server so module-level init works
with patch("supabase.create_client", return_value=MagicMock()):
    import server

# @mcp.tool wraps functions in FunctionTool; access the raw callables via .fn
search_laws = server.search_laws.fn
get_pasal = server.get_pasal.fn
get_law_status = server.get_law_status.fn
list_laws = server.list_laws.fn


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CHAINABLE_ATTRS = (
    "select", "eq", "neq", "in_", "ilike", "or_", "match",
    "order", "range", "limit", "single",
)


def _qm(data: list | None = None, count: int = 0):
    """Chainable query mock that mimics the PostgREST query builder."""
    m = MagicMock()
    for attr in _CHAINABLE_ATTRS:
        getattr(m, attr).return_value = m
    m.execute.return_value = MagicMock(data=data or [], count=count)
    return m


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset():
    """Clear caches and reset mocks between every test."""
    server._reg_types = {}
    server._reg_types_by_id = {}
    server._law_count = None
    server._law_count_ts = 0.0
    server.sb.reset_mock()
    yield


@pytest.fixture
def reg_cache():
    """Pre-populate the regulation-type cache (skips the DB lookup)."""
    server._reg_types = {"UU": 1, "PP": 2, "PERPRES": 3}
    server._reg_types_by_id = {1: "UU", 2: "PP", 3: "PERPRES"}


# ===================================================================
# search_laws
# ===================================================================

class TestSearchLaws:

    def test_empty_query_returns_error(self):
        result = search_laws("")
        assert len(result) == 1
        assert "error" in result[0]

    def test_whitespace_query_returns_error(self):
        result = search_laws("   ")
        assert len(result) == 1
        assert "error" in result[0]

    def test_limit_capped_at_50(self, reg_cache):
        server.sb.rpc.return_value.execute.return_value = MagicMock(data=[])
        search_laws("test", limit=100)

        rpc_args = server.sb.rpc.call_args[0][1]
        assert rpc_args["match_count"] == 50 * 3  # limit capped to 50, then *3

    def test_year_filter_excludes_outside_range(self, reg_cache):
        server.sb.rpc.return_value.execute.return_value = MagicMock(data=[
            {"work_id": 1, "content": "a", "score": 0.9, "metadata": {"pasal": "1"}},
            {"work_id": 2, "content": "b", "score": 0.8, "metadata": {"pasal": "2"}},
            {"work_id": 3, "content": "c", "score": 0.7, "metadata": {"pasal": "3"}},
        ])

        works_mock = _qm(data=[
            {"id": 1, "frbr_uri": "/a", "title_id": "T1", "number": "1",
             "year": 2020, "status": "berlaku", "regulation_type_id": 1},
            {"id": 2, "frbr_uri": "/b", "title_id": "T2", "number": "2",
             "year": 2015, "status": "berlaku", "regulation_type_id": 1},
            {"id": 3, "frbr_uri": "/c", "title_id": "T3", "number": "3",
             "year": 2010, "status": "berlaku", "regulation_type_id": 1},
        ])
        server.sb.table.side_effect = lambda n: works_mock if n == "works" else _qm()

        result = search_laws("test", year_from=2014, year_to=2019)
        assert len(result) == 1
        assert result[0]["year"] == 2015

    def test_unknown_regulation_type_still_searches(self, reg_cache):
        server.sb.rpc.return_value.execute.return_value = MagicMock(data=[])
        result = search_laws("test", regulation_type="UNKNOWN")
        assert isinstance(result, list)
        # Returns "no results" message, not an error
        assert "error" not in result[0]

    def test_results_enriched_with_expected_keys(self, reg_cache):
        server.sb.rpc.return_value.execute.return_value = MagicMock(data=[
            {"work_id": 1, "content": "text", "score": 0.95,
             "metadata": {"pasal": "5"}},
        ])
        works_mock = _qm(data=[
            {"id": 1, "frbr_uri": "/akn/id/act/uu/2003/13",
             "title_id": "UU Ketenagakerjaan", "number": "13",
             "year": 2003, "status": "berlaku", "regulation_type_id": 1},
        ])
        server.sb.table.side_effect = lambda n: works_mock if n == "works" else _qm()

        result = search_laws("ketenagakerjaan")
        assert len(result) == 1
        for key in ("law_title", "frbr_uri", "regulation_type",
                     "pasal", "status", "relevance_score"):
            assert key in result[0], f"Missing key: {key}"


# ===================================================================
# get_pasal
# ===================================================================

class TestGetPasal:

    @staticmethod
    def _make_router(work: dict, node_responses: list):
        """Build a table router for get_pasal tests.

        ``node_responses`` is an ordered list of _qm mocks returned by
        successive ``sb.table("document_nodes")`` calls.
        """
        node_calls = iter(node_responses)

        def router(name):
            if name == "works":
                return _qm(data=[work])
            if name == "document_nodes":
                return next(node_calls)
            return _qm()
        return router

    def test_unknown_law_type_returns_error(self, reg_cache):
        result = get_pasal("FAKE", "1", 2003, "1")
        assert result["error"] == "Unknown regulation type: FAKE"

    def test_missing_pasal_returns_available_pasals(self, reg_cache):
        work = {"id": 1, "title_id": "T", "frbr_uri": "/a", "number": "13",
                "year": 2003, "status": "berlaku", "regulation_type_id": 1}

        server.sb.table.side_effect = self._make_router(work, [
            _qm(data=[]),                                       # pasal not found
            _qm(data=[{"number": "1"}, {"number": "2"}]),       # _get_available_pasals
        ])

        result = get_pasal("UU", "13", 2003, "999")
        assert "error" in result
        assert "available_pasals" in result
        assert result["available_pasals"] == ["1", "2"]

    def test_valid_pasal_returns_content(self, reg_cache):
        work = {
            "id": 1, "title_id": "UU 13/2003",
            "frbr_uri": "/akn/id/act/uu/2003/13", "number": "13",
            "year": 2003, "status": "berlaku", "regulation_type_id": 1,
            "source_url": "https://example.com",
        }
        node = {
            "id": 10, "content_text": "Setiap pekerja berhak...",
            "parent_id": 5, "number": "1", "node_type": "pasal",
        }
        parent = {"node_type": "bab", "number": "I", "heading": "Ketentuan Umum"}

        server.sb.table.side_effect = self._make_router(work, [
            _qm(data=[node]),                                                   # pasal node
            _qm(data=[{"number": "1", "content_text": "Ayat satu"},
                       {"number": "2", "content_text": "Ayat dua"}]),           # ayat children
            _qm(data=[parent]),                                                 # parent bab
        ])

        result = get_pasal("UU", "13", 2003, "1")
        assert result["content_id"] == "Setiap pekerja berhak..."
        assert len(result["ayat"]) == 2
        assert "BAB I" in result["chapter"]
        assert "Ketentuan Umum" in result["chapter"]

    def test_ayat_ordering_preserved(self, reg_cache):
        """Server preserves the DB sort order (.order('sort_order'))."""
        work = {
            "id": 1, "title_id": "T", "frbr_uri": "/a", "number": "1",
            "year": 2020, "status": "berlaku", "regulation_type_id": 1,
            "source_url": "",
        }
        node = {
            "id": 10, "content_text": "Text", "parent_id": None,
            "number": "5", "node_type": "pasal",
        }

        server.sb.table.side_effect = self._make_router(work, [
            _qm(data=[node]),
            _qm(data=[{"number": "2", "content_text": "Second"},
                       {"number": "1", "content_text": "First"},
                       {"number": "3", "content_text": "Third"}]),
            # parent_id is None so no parent lookup
        ])

        result = get_pasal("UU", "1", 2020, "5")
        assert [a["number"] for a in result["ayat"]] == ["2", "1", "3"]


# ===================================================================
# get_law_status
# ===================================================================

class TestGetLawStatus:

    def _make_router(self, work, relationships=None, related_works=None):
        """Build a table router for get_law_status tests."""
        works_calls = iter([
            _qm(data=[work]),
            _qm(data=related_works or []),
        ])

        def router(name):
            if name == "works":
                return next(works_calls)
            if name == "work_relationships":
                return _qm(data=relationships or [])
            return _qm()
        return router

    def test_berlaku_status_explanation(self, reg_cache):
        work = {
            "id": 1, "title_id": "T", "frbr_uri": "/a", "number": "1",
            "year": 2020, "status": "berlaku", "regulation_type_id": 1,
            "date_enacted": None,
        }
        server.sb.table.side_effect = self._make_router(work)

        result = get_law_status("UU", "1", 2020)
        assert "currently in force" in result["status_explanation"]

    def test_amendments_vs_related(self, reg_cache):
        work = {
            "id": 1, "title_id": "T", "frbr_uri": "/a", "number": "1",
            "year": 2020, "status": "diubah", "regulation_type_id": 1,
            "date_enacted": "2020-01-01",
        }
        relationships = [
            {
                "source_work_id": 1, "target_work_id": 2,
                "relationship_types": {
                    "code": "mengubah", "name_id": "Mengubah", "name_en": "Amends",
                },
            },
            {
                "source_work_id": 3, "target_work_id": 1,
                "relationship_types": {
                    "code": "merujuk", "name_id": "Merujuk", "name_en": "Refers to",
                },
            },
        ]
        related_works = [
            {"id": 2, "frbr_uri": "/b", "title_id": "UU 2/2019", "number": "2",
             "year": 2019, "status": "berlaku", "regulation_type_id": 1},
            {"id": 3, "frbr_uri": "/c", "title_id": "PP 3/2018", "number": "3",
             "year": 2018, "status": "berlaku", "regulation_type_id": 2},
        ]

        server.sb.table.side_effect = self._make_router(
            work, relationships, related_works,
        )

        result = get_law_status("UU", "1", 2020)
        assert len(result["amendments"]) == 1
        assert result["amendments"][0]["relationship"] == "Amends"
        assert len(result["related_laws"]) == 1
        assert result["related_laws"][0]["relationship"] == "Refers to"

    def test_date_enacted_none(self, reg_cache):
        work = {
            "id": 1, "title_id": "T", "frbr_uri": "/a", "number": "1",
            "year": 2020, "status": "berlaku", "regulation_type_id": 1,
            "date_enacted": None,
        }
        server.sb.table.side_effect = self._make_router(work)

        result = get_law_status("UU", "1", 2020)
        assert result["date_enacted"] is None

    def test_date_enacted_present(self, reg_cache):
        work = {
            "id": 1, "title_id": "T", "frbr_uri": "/a", "number": "1",
            "year": 2020, "status": "berlaku", "regulation_type_id": 1,
            "date_enacted": "2020-03-15",
        }
        server.sb.table.side_effect = self._make_router(work)

        result = get_law_status("UU", "1", 2020)
        assert result["date_enacted"] == "2020-03-15"


# ===================================================================
# list_laws
# ===================================================================

class TestListLaws:

    def test_pagination_offset(self, reg_cache):
        works_mock = _qm(data=[], count=25)
        server.sb.table.side_effect = lambda n: works_mock if n == "works" else _qm()

        result = list_laws(page=2, per_page=10)

        works_mock.range.assert_called_once_with(10, 19)
        assert result["page"] == 2
        assert result["per_page"] == 10

    def test_search_produces_ilike(self, reg_cache):
        works_mock = _qm(data=[], count=0)
        server.sb.table.side_effect = lambda n: works_mock if n == "works" else _qm()

        list_laws(search="ketenagakerjaan")

        works_mock.ilike.assert_called_once_with("title_id", "%ketenagakerjaan%")

    def test_no_args_does_not_crash(self, reg_cache):
        works_mock = _qm(data=[], count=0)
        server.sb.table.side_effect = lambda n: works_mock if n == "works" else _qm()

        result = list_laws()
        assert "error" not in result
        assert result["total"] == 0
        assert result["laws"] == []


# ===================================================================
# _get_reg_types caching
# ===================================================================

class TestGetRegTypesCaching:

    def test_second_call_skips_db(self):
        reg_mock = _qm(data=[{"id": 1, "code": "UU"}])
        server.sb.table.side_effect = lambda n: (
            reg_mock if n == "regulation_types" else _qm()
        )

        server._get_reg_types()
        server._get_reg_types()

        # table() called only once — second call hits the cache
        assert server.sb.table.call_count == 1


# ===================================================================
# Disclaimer presence in all tool responses
# ===================================================================

class TestDisclaimer:

    def test_search_laws_results_have_disclaimer(self, reg_cache):
        server.sb.rpc.return_value.execute.return_value = MagicMock(data=[
            {"work_id": 1, "content": "text", "score": 0.5, "metadata": {"pasal": "1"}},
        ])
        works_mock = _qm(data=[
            {"id": 1, "frbr_uri": "/a", "title_id": "T", "number": "1",
             "year": 2020, "status": "berlaku", "regulation_type_id": 1},
        ])
        server.sb.table.side_effect = lambda n: works_mock if n == "works" else _qm()

        result = search_laws("test")
        assert all("disclaimer" in r for r in result)

    def test_search_laws_no_results_has_disclaimer(self, reg_cache):
        server.sb.rpc.return_value.execute.return_value = MagicMock(data=[])
        # _get_law_count needs works table
        count_mock = _qm(data=[], count=19)
        server.sb.table.side_effect = lambda n: count_mock

        result = search_laws("nonexistent query")
        assert len(result) == 1
        assert "disclaimer" in result[0]

    def test_search_laws_empty_query_has_disclaimer(self):
        result = search_laws("")
        assert all("disclaimer" in r for r in result)

    def test_get_pasal_has_disclaimer(self, reg_cache):
        work = {"id": 1, "title_id": "T", "frbr_uri": "/a", "number": "1",
                "year": 2020, "status": "berlaku", "regulation_type_id": 1, "source_url": ""}
        node = {"id": 10, "content_text": "Text", "parent_id": None, "number": "1", "node_type": "pasal"}

        node_calls = iter([_qm(data=[node]), _qm(data=[])])
        server.sb.table.side_effect = lambda n: (
            _qm(data=[work]) if n == "works" else next(node_calls)
        )

        result = get_pasal("UU", "1", 2020, "1")
        assert "disclaimer" in result

    def test_get_law_status_has_disclaimer(self, reg_cache):
        work = {"id": 1, "title_id": "T", "frbr_uri": "/a", "number": "1",
                "year": 2020, "status": "berlaku", "regulation_type_id": 1, "date_enacted": None}

        works_calls = iter([_qm(data=[work]), _qm(data=[])])
        server.sb.table.side_effect = lambda n: (
            next(works_calls) if n == "works"
            else _qm(data=[]) if n == "work_relationships"
            else _qm()
        )

        result = get_law_status("UU", "1", 2020)
        assert "disclaimer" in result

    def test_list_laws_has_disclaimer(self, reg_cache):
        works_mock = _qm(data=[], count=0)
        server.sb.table.side_effect = lambda n: works_mock if n == "works" else _qm()

        result = list_laws()
        assert "disclaimer" in result


# ===================================================================
# search_laws with Supabase exception
# ===================================================================

class TestSearchLawsException:

    def test_rpc_exception_returns_error(self, reg_cache):
        server.sb.rpc.return_value.execute.side_effect = Exception("connection timeout")

        result = search_laws("test query")
        assert len(result) == 1
        assert "error" in result[0]
        assert "connection timeout" in result[0]["error"]
        assert "disclaimer" in result[0]


# ===================================================================
# get_pasal with parent_id=None
# ===================================================================

class TestGetPasalNoParent:

    def test_parent_id_none_returns_empty_chapter(self, reg_cache):
        work = {"id": 1, "title_id": "T", "frbr_uri": "/a", "number": "1",
                "year": 2020, "status": "berlaku", "regulation_type_id": 1, "source_url": ""}
        node = {"id": 10, "content_text": "Text", "parent_id": None, "number": "5", "node_type": "pasal"}

        node_calls = iter([_qm(data=[node]), _qm(data=[])])
        server.sb.table.side_effect = lambda n: (
            _qm(data=[work]) if n == "works" else next(node_calls)
        )

        result = get_pasal("UU", "1", 2020, "5")
        assert result["chapter"] == ""


# ===================================================================
# get_law_status with no relationships
# ===================================================================

class TestGetLawStatusNoRelationships:

    def test_no_relationships_returns_empty_lists(self, reg_cache):
        work = {"id": 1, "title_id": "T", "frbr_uri": "/a", "number": "1",
                "year": 2020, "status": "berlaku", "regulation_type_id": 1, "date_enacted": None}

        works_calls = iter([_qm(data=[work]), _qm(data=[])])
        server.sb.table.side_effect = lambda n: (
            next(works_calls) if n == "works"
            else _qm(data=[]) if n == "work_relationships"
            else _qm()
        )

        result = get_law_status("UU", "1", 2020)
        assert result["amendments"] == []
        assert result["related_laws"] == []


# ===================================================================
# list_laws filter combinations
# ===================================================================

class TestListLawsFilters:

    def test_all_filters(self, reg_cache):
        works_mock = _qm(data=[
            {"frbr_uri": "/a", "title_id": "T", "number": "1", "year": 2020,
             "status": "berlaku", "regulation_types": {"code": "UU", "name_id": "Undang-Undang"}},
        ], count=1)
        server.sb.table.side_effect = lambda n: works_mock if n == "works" else _qm()

        result = list_laws(regulation_type="UU", year=2020, status="berlaku", search="test")

        assert result["total"] == 1
        assert len(result["laws"]) == 1
        works_mock.eq.assert_any_call("regulation_type_id", 1)
        works_mock.eq.assert_any_call("year", 2020)
        works_mock.eq.assert_any_call("status", "berlaku")
        works_mock.ilike.assert_called_once_with("title_id", "%test%")

    def test_type_only_filter(self, reg_cache):
        works_mock = _qm(data=[], count=0)
        server.sb.table.side_effect = lambda n: works_mock if n == "works" else _qm()

        result = list_laws(regulation_type="PP")
        assert "error" not in result
        works_mock.eq.assert_any_call("regulation_type_id", 2)

    def test_year_only_filter(self, reg_cache):
        works_mock = _qm(data=[], count=0)
        server.sb.table.side_effect = lambda n: works_mock if n == "works" else _qm()

        result = list_laws(year=2023)
        assert "error" not in result
        works_mock.eq.assert_any_call("year", 2023)


# ===================================================================
# _no_results_message
# ===================================================================

class TestNoResultsMessage:

    def test_includes_law_count(self, reg_cache):
        count_mock = _qm(data=[], count=19)
        server.sb.table.side_effect = lambda n: count_mock

        msg = server._no_results_message("'test'")
        assert "19" in msg
        assert "does NOT mean" in msg.lower() or "does NOT" in msg
