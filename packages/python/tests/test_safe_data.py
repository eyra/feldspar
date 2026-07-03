"""Tests for SafeData — typed JSON access with error tracking."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from port.safe_data import SafeData


@pytest.fixture(autouse=True)
def _clear_hook():
    SafeData.set_error_hook(None)
    yield
    SafeData.set_error_hook(None)


# --- parse_json ---------------------------------------------------------

def test_parse_json_from_string():
    d = SafeData.parse_json('{"a": 1}')
    assert d.get_int("a") == 1
    assert not d.had_errors()


def test_parse_json_from_bytes():
    d = SafeData.parse_json(b'{"a": 1}')
    assert d.get_int("a") == 1


def test_parse_json_from_file_like(tmp_path):
    p = tmp_path / "x.json"
    p.write_text('{"a": 1}')
    with p.open() as f:
        d = SafeData.parse_json(f)
    assert d.get_int("a") == 1


def test_parse_json_malformed_returns_empty_and_records_error():
    d = SafeData.parse_json("{not json}")
    assert d.had_errors()
    assert d.get_str("anything") == ""


# --- get_str -------------------------------------------------------------

def test_get_str_present():
    d = SafeData.wrap({"name": "alice"})
    assert d.get_str("name") == "alice"
    assert not d.had_errors()


def test_get_str_coerces_scalars():
    d = SafeData.wrap({"n": 42, "f": 3.14, "b": True})
    assert d.get_str("n") == "42"
    assert d.get_str("f") == "3.14"
    assert d.get_str("b") == "True"
    assert not d.had_errors()


def test_get_str_missing_uses_default_and_records_error():
    d = SafeData.wrap({"name": "alice"})
    assert d.get_str("missing", default="x") == "x"
    assert d.had_errors()


def test_get_str_null_records_error():
    d = SafeData.wrap({"name": None})
    assert d.get_str("name", default="x") == "x"
    assert d.had_errors()


def test_get_str_dict_not_coercible():
    d = SafeData.wrap({"x": {"nested": 1}})
    assert d.get_str("x", default="y") == "y"
    assert d.had_errors()


# --- get_int -------------------------------------------------------------

def test_get_int_present():
    d = SafeData.wrap({"n": 42})
    assert d.get_int("n") == 42


def test_get_int_integral_float():
    d = SafeData.wrap({"n": 3.0})
    assert d.get_int("n") == 3
    assert not d.had_errors()


def test_get_int_non_integral_float_errors():
    d = SafeData.wrap({"n": 3.5})
    assert d.get_int("n", default=-1) == -1
    assert d.had_errors()


def test_get_int_parseable_string():
    d = SafeData.wrap({"n": "42"})
    assert d.get_int("n") == 42


def test_get_int_bad_string():
    d = SafeData.wrap({"n": "abc"})
    assert d.get_int("n", default=-1) == -1
    assert d.had_errors()


def test_get_int_rejects_bool():
    d = SafeData.wrap({"n": True})
    assert d.get_int("n", default=-1) == -1
    assert d.had_errors()


# --- get_float -----------------------------------------------------------

def test_get_float_int_input():
    d = SafeData.wrap({"f": 1})
    assert d.get_float("f") == 1.0


def test_get_float_parseable_str():
    d = SafeData.wrap({"f": "1.5"})
    assert d.get_float("f") == 1.5


def test_get_float_rejects_bool():
    d = SafeData.wrap({"f": False})
    assert d.get_float("f", default=-1.0) == -1.0
    assert d.had_errors()


# --- get_bool ------------------------------------------------------------

def test_get_bool_strict():
    d = SafeData.wrap({"t": True, "f": False, "n": 1, "s": "true"})
    assert d.get_bool("t") is True
    assert d.get_bool("f") is False
    assert not d.had_errors()
    assert d.get_bool("n", default=False) is False
    assert d.had_errors()
    assert d.get_bool("s", default=False) is False


# --- get_dict ------------------------------------------------------------

def test_get_dict_present():
    d = SafeData.wrap({"user": {"name": "alice"}})
    user = d.get_dict("user")
    assert user.get_str("name") == "alice"


def test_get_dict_missing_returns_empty_safe_data():
    d = SafeData.wrap({"user": {"name": "alice"}})
    missing = d.get_dict("missing")
    assert isinstance(missing, SafeData)
    assert missing.get_str("name", default="x") == "x"
    assert d.had_errors()


def test_get_dict_chain_doesnt_crash_on_missing():
    d = SafeData.wrap({})
    # Chain through several missing levels — must not crash.
    name = d.get_dict("a").get_dict("b").get_str("name", default="fallback")
    assert name == "fallback"
    assert d.had_errors()


def test_get_dict_wrong_type():
    d = SafeData.wrap({"user": "alice"})
    user = d.get_dict("user")
    assert user.get_str("name", default="x") == "x"
    assert d.had_errors()


# --- get_list_of ---------------------------------------------------------

def test_get_list_of_strings():
    d = SafeData.wrap({"tags": ["a", "b", "c"]})
    assert d.get_list_of(str, "tags") == ["a", "b", "c"]
    assert not d.had_errors()


def test_get_list_of_drops_bad_elements():
    d = SafeData.wrap({"tags": ["a", 1, "b", None, "c"]})
    assert d.get_list_of(str, "tags") == ["a", "b", "c"]
    assert d.had_errors()


def test_get_list_of_safe_data():
    d = SafeData.wrap({"users": [{"name": "alice"}, "not a dict", {"name": "bob"}]})
    users = d.get_list_of(SafeData, "users")
    assert len(users) == 2
    assert users[0].get_str("name") == "alice"
    assert users[1].get_str("name") == "bob"
    assert d.had_errors()


def test_get_list_of_missing_returns_empty():
    d = SafeData.wrap({})
    assert d.get_list_of(str, "tags") == []
    assert d.had_errors()


def test_get_list_of_wrong_type_returns_default():
    d = SafeData.wrap({"tags": "not a list"})
    assert d.get_list_of(str, "tags", default=["fallback"]) == ["fallback"]
    assert d.had_errors()


def test_get_list_of_rejects_unsupported_type():
    d = SafeData.wrap({"x": [1, 2]})
    with pytest.raises(TypeError):
        d.get_list_of(dict, "x")
    with pytest.raises(TypeError):
        d.get_list_of(list, "x")


def test_get_list_of_int_rejects_bool_elements():
    d = SafeData.wrap({"xs": [1, True, 2, False, 3]})
    assert d.get_list_of(int, "xs") == [1, 2, 3]
    assert d.had_errors()


# --- list root -----------------------------------------------------------

def test_list_root_via_get_list_of_no_key():
    d = SafeData.parse_json('["a", "b", "c"]')
    assert d.get_list_of(str) == ["a", "b", "c"]
    assert not d.had_errors()


def test_list_root_of_objects():
    d = SafeData.parse_json('[{"name": "alice"}, {"name": "bob"}]')
    users = d.get_list_of(SafeData)
    assert [u.get_str("name") for u in users] == ["alice", "bob"]


# --- dotted paths --------------------------------------------------------

def test_dotted_path_through_dicts():
    d = SafeData.wrap({"a": {"b": {"c": "deep"}}})
    assert d.get_str("a.b.c") == "deep"


def test_dotted_path_through_list_index():
    d = SafeData.wrap({"users": [{"name": "alice"}, {"name": "bob"}]})
    assert d.get_str("users.0.name") == "alice"
    assert d.get_str("users.1.name") == "bob"


def test_dotted_path_missing_segment_records_one_error():
    d = SafeData.wrap({"a": {"b": {}}})
    assert d.get_str("a.b.c", default="x") == "x"
    assert d.had_errors()


def test_dotted_path_out_of_range_index():
    d = SafeData.wrap({"users": [{"name": "alice"}]})
    assert d.get_str("users.5.name", default="x") == "x"
    assert d.had_errors()


# --- error tracking & hook -----------------------------------------------

def test_had_errors_propagates_from_descendants():
    d = SafeData.wrap({"user": {"name": "alice"}})
    user = d.get_dict("user")
    assert not d.had_errors()
    user.get_str("missing")
    assert d.had_errors()


def test_path_reflects_position():
    d = SafeData.wrap({"user": {"name": "alice"}})
    assert d.path() == ""
    assert d.get_dict("user").path() == "user"


def test_error_hook_called():
    calls = []
    SafeData.set_error_hook(lambda *args: calls.append(args))

    d = SafeData.wrap({"name": "alice"})
    d.get_int("name", default=0)

    assert len(calls) == 1
    path, expected, actual, reason = calls[0]
    assert path == "name"
    assert expected == "int"
    assert actual == "alice"
    assert reason  # non-empty


def test_error_hook_cleared():
    calls = []
    SafeData.set_error_hook(lambda *args: calls.append(args))
    SafeData.set_error_hook(None)

    d = SafeData.wrap({})
    d.get_str("missing")

    assert calls == []


def test_error_hook_exception_is_swallowed():
    def bad_hook(*args):
        raise RuntimeError("hook crashed")

    SafeData.set_error_hook(bad_hook)
    d = SafeData.wrap({})
    # Must not propagate the hook's exception
    assert d.get_str("missing", default="x") == "x"


# --- get_errors ----------------------------------------------------------

def test_get_errors_lists_each_failure():
    d = SafeData.wrap({"name": "alice", "n": "not-a-number"})
    d.get_str("missing")
    d.get_int("n")

    errors = d.get_errors()
    assert len(errors) == 2
    paths = [e[0] for e in errors]
    assert "missing" in paths
    assert "n" in paths


def test_get_errors_carries_expected_actual_reason():
    d = SafeData.wrap({"n": "abc"})
    d.get_int("n", default=-1)

    errors = d.get_errors()
    assert len(errors) == 1
    path, expected, actual, reason = errors[0]
    assert path == "n"
    assert expected == "int"
    assert actual == "abc"
    assert reason


def test_get_errors_shares_state_across_tree():
    d = SafeData.wrap({"user": {"name": "alice"}})
    user = d.get_dict("user")
    user.get_str("missing")
    # Errors recorded on a child are visible on the root.
    assert len(d.get_errors()) == 1
    assert d.get_errors()[0][0] == "user.missing"


def test_get_errors_returns_copy():
    d = SafeData.wrap({})
    d.get_str("a")
    errors = d.get_errors()
    errors.clear()
    # Mutating the returned list must not affect internal state.
    assert len(d.get_errors()) == 1


# --- poisoned propagation ------------------------------------------------

def test_poisoned_chain_logs_only_once_for_root_cause():
    d = SafeData.wrap({})
    # user is missing -> get_dict logs once and returns poisoned.
    # get_str on the poisoned fallback returns "" silently.
    name = d.get_dict("user").get_str("name", default="fallback")
    assert name == "fallback"
    assert len(d.get_errors()) == 1
    assert d.get_errors()[0][0] == "user"


def test_poisoned_propagates_through_get_dict():
    d = SafeData.wrap({})
    deep = d.get_dict("a").get_dict("b").get_dict("c")
    assert deep.get_str("x", default="z") == "z"
    # Only the first failure ("a") should be logged.
    assert len(d.get_errors()) == 1
    assert d.get_errors()[0][0] == "a"


def test_real_failure_below_a_real_dict_still_logs():
    d = SafeData.wrap({"user": {"name": "alice"}})
    name = d.get_dict("user").get_str("missing", default="x")
    assert name == "x"
    # The user dict is real, so the missing key is a real first-time failure.
    assert len(d.get_errors()) == 1
    assert d.get_errors()[0][0] == "user.missing"


def test_poisoned_get_list_returns_empty_iteration():
    d = SafeData.wrap({})
    items = list(d.get_list("items"))
    assert items == []
    # One error: the missing list. Iteration produced nothing, so no more.
    assert len(d.get_errors()) == 1


def test_parse_failure_produces_poisoned_root():
    d = SafeData.parse_json("not json")
    # Subsequent accesses on a parse-failed root should not pile on errors.
    d.get_str("anything")
    d.get_int("else")
    # Only the original parse error.
    assert len(d.get_errors()) == 1


# --- iteration -----------------------------------------------------------

def test_iterate_list_root():
    d = SafeData.parse_json('["a", "b", "c"]')
    elems = list(d)
    assert all(isinstance(e, SafeData) for e in elems)
    assert [e.raw() for e in elems] == ["a", "b", "c"]


def test_iterate_list_of_objects():
    d = SafeData.parse_json('[{"name": "alice"}, {"name": "bob"}]')
    names = [e.get_str("name") for e in d]
    assert names == ["alice", "bob"]


def test_iterate_polymorphic_list():
    d = SafeData.parse_json('["greeting", {"type": "user", "name": "alice"}, 42]')
    out = []
    for elem in d:
        raw = elem.raw()
        if isinstance(raw, str):
            out.append(("str", raw))
        elif isinstance(raw, int) and not isinstance(raw, bool):
            out.append(("int", raw))
        else:
            out.append((elem.get_str("type"), elem.get_str("name")))
    assert out == [("str", "greeting"), ("user", "alice"), ("int", 42)]


def test_iterate_dict_yields_keys():
    d = SafeData.wrap({"a": 1, "b": 2})
    assert sorted(list(d)) == ["a", "b"]


def test_iterate_scalar_raises():
    d = SafeData.wrap("scalar")
    with pytest.raises(TypeError):
        list(d)


def test_len_list_and_dict():
    assert len(SafeData.wrap([1, 2, 3])) == 3
    assert len(SafeData.wrap({"a": 1, "b": 2})) == 2


def test_len_scalar_raises():
    with pytest.raises(TypeError):
        len(SafeData.wrap(5))


# --- get_list (list node) ------------------------------------------------

def test_get_list_returns_iterable_safedata():
    d = SafeData.wrap({"xs": [1, "two", {"three": 3}]})
    xs = d.get_list("xs")
    assert isinstance(xs, SafeData)
    assert len(xs) == 3
    raws = [e.raw() for e in xs]
    assert raws[0] == 1
    assert raws[1] == "two"
    # nested dict element is a SafeData wrapping a dict
    assert isinstance(raws[2], dict)
    assert xs.path() == "xs"


def test_get_list_missing_is_empty_iteration():
    d = SafeData.wrap({})
    xs = d.get_list("xs")
    assert list(xs) == []
    assert d.had_errors()


def test_get_list_wrong_type_is_empty_iteration():
    d = SafeData.wrap({"xs": "not a list"})
    xs = d.get_list("xs")
    assert list(xs) == []
    assert d.had_errors()


# --- multi-path (coalescing) getters -------------------------------------

def test_get_str_first_path_wins():
    d = SafeData.wrap({"displayName": "alice", "name": "ALICE"})
    assert d.get_str("displayName", "name") == "alice"
    assert not d.had_errors()


def test_get_str_falls_through_to_second_path():
    d = SafeData.wrap({"name": "alice"})
    assert d.get_str("displayName", "display_name", "name") == "alice"
    assert not d.had_errors()


def test_get_str_falls_through_on_wrong_type_not_just_missing():
    # First key exists but is a dict (wrong type) — must fall through, not stop.
    d = SafeData.wrap({"a": {"nested": 1}, "b": "value"})
    assert d.get_str("a", "b") == "value"
    assert not d.had_errors()


def test_get_str_falls_through_on_null():
    d = SafeData.wrap({"a": None, "b": "value"})
    assert d.get_str("a", "b") == "value"
    assert not d.had_errors()


def test_get_str_all_paths_fail_records_one_error():
    d = SafeData.wrap({"x": 1})
    assert d.get_str("a", "b", "c", default="fallback") == "fallback"
    errors = d.get_errors()
    assert len(errors) == 1
    # The single error names all tried paths.
    path, expected, actual, reason = errors[0]
    assert "a" in reason and "b" in reason and "c" in reason


def test_get_str_across_different_shapes():
    d = SafeData.wrap({"account": {"profile": {"fullName": "alice"}}})
    assert d.get_str("user.name", "account.profile.fullName", default="") == "alice"
    assert not d.had_errors()


def test_get_int_coalesce():
    d = SafeData.wrap({"count": "42"})
    assert d.get_int("n", "count", default=0) == 42
    assert not d.had_errors()


def test_get_int_coalesce_skips_wrong_type():
    # bool must not satisfy get_int even via coalesce
    d = SafeData.wrap({"a": True, "b": 7})
    assert d.get_int("a", "b") == 7
    assert not d.had_errors()


def test_single_path_error_message_unchanged():
    # A single failing path should not say "no candidate path matched".
    d = SafeData.wrap({})
    d.get_str("missing")
    reason = d.get_errors()[0][3]
    assert "candidate" not in reason


def test_get_str_no_path_coerces_own_value():
    # On a list element (a scalar SafeData), get_str() with no key reads self.
    d = SafeData.parse_json('["alice", 42]')
    elems = list(d)
    assert elems[0].get_str() == "alice"
    assert elems[1].get_str() == "42"


def test_get_dict_coalesce_on_shape():
    d = SafeData.wrap({"profile": {"name": "alice"}})
    got = d.get_dict("user", "profile")
    assert got.get_str("name") == "alice"
    assert not d.had_errors()


def test_get_dict_coalesce_all_fail_is_poisoned():
    d = SafeData.wrap({"x": 1})
    got = d.get_dict("user", "profile")
    assert got.get_str("name", default="z") == "z"
    # one error for the failed coalesce; the poisoned read adds none
    assert len(d.get_errors()) == 1


def test_get_list_coalesce_on_shape():
    d = SafeData.wrap({"records": [1, 2, 3]})
    got = d.get_list("items", "records")
    assert [e.raw() for e in got] == [1, 2, 3]
    assert not d.had_errors()


def test_coalesce_clean_when_fallback_succeeds():
    # The whole point: a successful fallback must keep had_errors() False.
    d = SafeData.wrap({"b": "value"})
    d.get_str("a", "b")
    assert not d.had_errors()
    assert d.get_errors() == []


# --- literal keys (dot-in-key escape hatch) ------------------------------

def test_dotted_string_descends_by_default():
    d = SafeData.wrap({"user": {"name": "alice"}})
    assert d.get_str("user.name") == "alice"


def test_literal_list_key_with_dot():
    d = SafeData.wrap({"user.name": "alice"})
    # Dotted string would wrongly descend and miss the literal key.
    assert d.get_str("user.name", default="missed") == "missed"
    # Literal-segment form hits it.
    assert d.get_str(["user.name"]) == "alice"
    # Only the dotted attempt above recorded an error.
    assert len(d.get_errors()) == 1


def test_literal_segments_multi_level():
    d = SafeData.wrap({"weird.key": {"also.dotted": 42}})
    assert d.get_int(["weird.key", "also.dotted"]) == 42
    assert not d.had_errors()


def test_mix_literal_and_dotted_in_coalesce():
    d = SafeData.wrap({"normal": {"path": "value"}})
    # Literal "a.b" missing -> fall through to dotted normal.path
    assert d.get_str(["a.b"], "normal.path") == "value"
    assert not d.had_errors()


def test_literal_key_in_get_dict():
    d = SafeData.wrap({"a.b": {"name": "alice"}})
    got = d.get_dict(["a.b"])
    assert got.get_str("name") == "alice"
    assert not d.had_errors()


def test_literal_key_in_get_list_of():
    d = SafeData.wrap({"a.b": [1, 2, 3]})
    assert d.get_list_of(int, ["a.b"]) == [1, 2, 3]
    assert not d.had_errors()


def test_coalesce_error_renders_literal_paths():
    d = SafeData.wrap({})
    d.get_str(["a.b"], "c.d", default="")
    reason = d.get_errors()[0][3]
    # Both candidates named; the literal one shown bracketed/quoted.
    assert "a.b" in reason
    assert "c.d" in reason


def test_list_index_works_in_literal_segments():
    d = SafeData.wrap({"items": [{"name": "alice"}]})
    # numeric segment still indexes the list even in literal form
    assert d.get_str(["items", "0", "name"]) == "alice"


# --- raw() ---------------------------------------------------------------

def test_raw_returns_underlying_scalar():
    d = SafeData.wrap("just a string")
    assert d.raw() == "just a string"


def test_raw_returns_underlying_container():
    d = SafeData.wrap({"a": 1})
    assert isinstance(d.raw(), dict)
    assert "a" in d.raw()
