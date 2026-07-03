"""Crash-resistant access to parsed JSON data with typed accessors and error tracking.

Wraps Python objects produced by JSON parsing so extraction scripts can
pull typed values without worrying about missing keys, nulls, or
unexpected types. Every type mismatch is logged and recorded; callers
can check `had_errors()` to decide whether the extracted data is
trustworthy.
"""

from __future__ import annotations

import json
import logging
from typing import IO, Any, Callable, Optional, Sequence, Type, TypeVar, Union

Path = Union[str, Sequence[str]]
"""A path is either a dotted string ("user.name") or a sequence of
literal segments (["user.name"] = one key whose name contains a dot)."""

logger = logging.getLogger("safedata")

T = TypeVar("T")

ErrorHook = Callable[[str, str, Any, str], None]
"""Hook signature: (path, expected_type, actual_value, reason)."""

_MAX_REPR_LEN = 80


class _Root:
    """Shared per-tree state: error list and optional hook target.

    Every SafeData in a tree (including empty fallbacks produced by
    failed accessors) holds a reference to the same _Root, so errors
    anywhere propagate to had_errors() on the root.
    """

    __slots__ = ("errors",)

    def __init__(self) -> None:
        self.errors: list[tuple[str, str, Any, str]] = []


def _truncate_repr(value: Any) -> str:
    r = repr(value)
    return r if len(r) <= _MAX_REPR_LEN else r[: _MAX_REPR_LEN - 3] + "..."


class SafeData:
    """Wraps a parsed JSON-derived Python object for crash-free typed access.

    Construct via `SafeData.parse_json(text_or_file)` or
    `SafeData.wrap(obj)`. The tree is walked once and every nested dict
    or list is replaced with a SafeData that knows its dotted path from
    the root. Dotted paths use string keys for dicts and integer
    indices for lists: e.g. `get_str("users.0.name")`.

    The root may be a dict, a list, or a scalar. For a list root, call
    `get_list_of(type_)` without a key, or navigate into it with dotted
    indices.

    Variant shapes: the scalar getters and `get_dict`/`get_list` accept
    several paths and return the first that resolves to the requested
    type, so a value that may live under different keys (or different
    nesting) can be read in one call:

        data.get_str("user.name", "account.profile.fullName", default="")

    A path that is missing or wrong-typed is tried silently and falls
    through to the next; an error is recorded only if every path fails.

    Dotted vs literal keys: a path given as a string is split on ".".
    If a JSON key itself contains a dot, pass the path as a sequence of
    literal segments instead — the elements are used verbatim, with no
    splitting:

        data.get_str("user.name")       # descend: user -> name
        data.get_str(["user.name"])     # one literal key "user.name"
        data.get_str(["a.b"], "x.y")    # literal "a.b", else path x.y
    """

    _error_hook: Optional[ErrorHook] = None

    __slots__ = ("_raw", "_path", "_root", "_poisoned")

    def __init__(self, raw: Any, path: str, root: _Root, poisoned: bool = False) -> None:
        self._raw = raw
        self._path = path
        self._root = root
        self._poisoned = poisoned

    @classmethod
    def set_error_hook(cls, hook: Optional[ErrorHook]) -> None:
        """Install a class-level hook called on every type error.

        Pass None to clear. The hook fires in addition to logging, not
        instead of it. One hook per process; later calls replace earlier.
        """
        cls._error_hook = hook

    @classmethod
    def parse_json(cls, source: Union[str, bytes, IO]) -> "SafeData":
        """Parse JSON from a string, bytes, or a file-like object and wrap the result.

        A parse failure (malformed JSON, I/O error) returns an empty
        SafeData with had_errors() == True. The script never sees a
        JSONDecodeError or IOError.
        """
        root = _Root()
        try:
            if isinstance(source, (str, bytes)):
                obj = json.loads(source)
            else:
                obj = json.load(source)
        except (json.JSONDecodeError, OSError, ValueError, TypeError) as e:
            reason = f"parse failed: {e}"
            root.errors.append(("", "json", source, reason))
            logger.warning("safedata: parse_json failed: %s", e)
            cls._fire_hook("", "json", source, reason)
            return cls(None, "", root, poisoned=True)
        return cls._build(obj, "", root)

    @classmethod
    def wrap(cls, obj: Any) -> "SafeData":
        """Wrap an already-parsed object.

        Accepts dict, list, or scalar. Scalars are retrievable via raw().
        """
        return cls._build(obj, "", _Root())

    @classmethod
    def _build(cls, obj: Any, path: str, root: _Root) -> "SafeData":
        """Wrap a parsed object as the root SafeData.

        Nested dicts are walked and each becomes a SafeData. Lists stay
        as Python lists but their dict elements become SafeData.
        Scalars remain raw.
        """
        if isinstance(obj, dict):
            wrapped: Any = {k: cls._build_value(v, _join(path, k), root) for k, v in obj.items()}
        elif isinstance(obj, list):
            wrapped = [cls._build_value(v, _join(path, str(i)), root) for i, v in enumerate(obj)]
        else:
            wrapped = obj
        return cls(wrapped, path, root)

    @classmethod
    def _build_value(cls, obj: Any, path: str, root: _Root) -> Any:
        """Recursively wrap a dict into SafeData; lists keep their shape
        but have nested dicts wrapped; scalars stay raw."""
        if isinstance(obj, dict):
            return cls._build(obj, path, root)
        if isinstance(obj, list):
            return [cls._build_value(v, _join(path, str(i)), root) for i, v in enumerate(obj)]
        return obj

    def raw(self) -> Any:
        """Return the underlying object (dict, list, or scalar).

        For wrapped dicts/lists, returns the container with child
        SafeData nodes still wrapping nested dicts/lists.
        """
        return self._raw

    def path(self) -> str:
        """Dotted path from the root. Empty string at the root."""
        return self._path

    def had_errors(self) -> bool:
        """True if any error occurred on this node or any descendant.

        Propagates to the root: checking the root after extraction tells
        you whether anything in the whole tree went sideways.
        """
        return bool(self._root.errors)

    def get_errors(self) -> list[tuple[str, str, Any, str]]:
        """Return a copy of all recorded errors as (path, expected, actual, reason).

        Always reflects every error in the tree, not just errors below
        this node — the list lives on the root and is shared.
        """
        return list(self._root.errors)

    # --- Iteration -------------------------------------------------------

    def __iter__(self):
        """Iterate elements of a list node or keys of a dict node.

        - List node: yields each element as a `SafeData`. Scalar
          elements get wrapped on the fly so callers can mix scalar and
          object elements in a polymorphic list:

              for elem in data.get_list("payload"):
                  if isinstance(elem.raw(), str):
                      ...
                  else:
                      name = elem.get_str("name")

        - Dict node: yields the keys (str), matching Python's dict
          iteration convention.
        - Scalar / non-iterable: raises TypeError.
        """
        if isinstance(self._raw, list):
            for i, element in enumerate(self._raw):
                if isinstance(element, SafeData):
                    yield element
                else:
                    yield SafeData(element, _join(self._path, str(i)), self._root, poisoned=self._poisoned)
            return
        if isinstance(self._raw, dict):
            yield from self._raw.keys()
            return
        raise TypeError(f"SafeData at {self._path or '<root>'} is not iterable (got {type(self._raw).__name__})")

    def __len__(self) -> int:
        """Length of a list or dict node. Raises TypeError on scalars."""
        if isinstance(self._raw, (list, dict)):
            return len(self._raw)
        raise TypeError(f"SafeData at {self._path or '<root>'} has no length (got {type(self._raw).__name__})")

    # --- Typed accessors -------------------------------------------------
    #
    # Each scalar getter accepts one or more dotted paths. Paths are
    # tried in order and the first that resolves to the requested type
    # wins. A path that is missing or holds the wrong type is NOT an
    # error on its own — it just falls through to the next candidate. An
    # error (logged + recorded) is raised only if EVERY candidate fails,
    # so a successful fallback keeps had_errors() clean. Call with no
    # path to coerce this node's own value (useful on list elements).

    def get_str(self, *keys: "Path", default: str = "") -> str:
        """Get a string from the first matching path. Coerces non-None scalars via str()."""
        return self._resolve_scalar(keys, "str", _coerce_str, default)

    def get_int(self, *keys: "Path", default: int = 0) -> int:
        """Get an int from the first matching path. Accepts int, integral float, parseable str."""
        return self._resolve_scalar(keys, "int", _coerce_int, default)

    def get_float(self, *keys: "Path", default: float = 0.0) -> float:
        """Get a float from the first matching path. Accepts int, float, parseable str."""
        return self._resolve_scalar(keys, "float", _coerce_float, default)

    def get_bool(self, *keys: "Path", default: bool = False) -> bool:
        """Get a bool from the first matching path. Strict: only accepts actual bool values."""
        return self._resolve_scalar(keys, "bool", _coerce_bool, default)

    def _resolve_scalar(
        self,
        keys: tuple["Path", ...],
        expected: str,
        coerce: Callable[[Any], tuple[bool, Any]],
        default: T,
    ) -> T:
        """Try each path in `keys`, returning the first that coerces.

        With no keys, coerce this node's own value. Records exactly one
        error if every candidate fails; that error names all tried paths.
        """
        candidates = keys if keys else (None,)
        last_value: Any = None
        last_path = self._path
        for key in candidates:
            if key is None:
                value, full_path, ok = self._raw, self._path, True
            else:
                value, full_path, ok = self._navigate(key)
            last_value, last_path = value, full_path
            if not ok:
                continue
            matched, result = coerce(value)
            if matched:
                return result
        err_path, reason = self._coalesce_error_info(candidates, last_path)
        return self._error(err_path, expected, last_value, reason, default)

    def get_list(self, *keys: "Path", default: Optional["SafeData"] = None) -> "SafeData":
        """Get a nested SafeData wrapping a list — useful for polymorphic lists.

        Accepts one or more paths; the first that resolves to a list
        wins (others are tried silently). Iterate the result to get one
        SafeData per element regardless of element type. For homogeneous
        lists where you want a plain Python list back, use
        `get_list_of(type_, key)` instead.

        If no candidate path holds a list, records one error and returns
        an empty poisoned SafeData so iteration is empty and downstream
        access stays quiet.
        """
        candidates = keys if keys else (None,)
        last_value: Any = None
        last_path = self._path
        for key in candidates:
            if key is None:
                value, full_path, ok = self, self._path, True
            else:
                value, full_path, ok = self._navigate(key)
            last_value, last_path = value, full_path
            if not ok:
                continue
            container = value._raw if isinstance(value, SafeData) else value
            if isinstance(container, list):
                return SafeData(container, full_path, self._root)
        err_path, reason = self._coalesce_error_info(candidates, last_path)
        self._error(err_path, "list", last_value, reason, None)
        return default if default is not None else SafeData([], err_path, self._root, poisoned=True)

    def get_dict(self, *keys: "Path", default: Optional["SafeData"] = None) -> "SafeData":
        """Get a nested SafeData wrapping a dict.

        Accepts one or more paths; the first that resolves to a dict
        wins (others are tried silently). If none does, records one
        error and returns an empty SafeData marked as "poisoned" —
        further access on it returns defaults silently, avoiding a
        cascade of follow-up errors for the same root cause.
        """
        candidates = keys if keys else (None,)
        last_value: Any = None
        last_path = self._path
        for key in candidates:
            if key is None:
                value, full_path, ok = self, self._path, True
            else:
                value, full_path, ok = self._navigate(key)
            last_value, last_path = value, full_path
            if not ok:
                continue
            if isinstance(value, SafeData) and isinstance(value._raw, dict):
                return value
        err_path, reason = self._coalesce_error_info(candidates, last_path)
        self._error(err_path, "dict", last_value, reason, None)
        return default if default is not None else SafeData({}, err_path, self._root, poisoned=True)

    def get_list_of(
        self,
        type_: Type[T],
        key: Optional["Path"] = None,
        default: Optional[list] = None,
    ) -> list[T]:
        """Get a list filtered to elements of the given type.

        If `key` is None, this node itself must be a list (used at the
        root of a list document, or after navigating into a list). If
        `key` is given, the list is fetched from that key/path first.

        Elements failing the type check are dropped and each drop is
        logged with its index in the path (e.g. "tags[3]"). Allowed
        types: str, int, float, bool, SafeData. Raw dict and list are
        intentionally not allowed — use SafeData for nested objects so
        downstream access stays crash-free.
        """
        if type_ not in (str, int, float, bool, SafeData):
            raise TypeError(
                f"get_list_of: type_ must be one of str, int, float, bool, SafeData; got {type_!r}"
            )

        if key is None:
            container = self._raw
            full_path = self._path
        else:
            value, full_path, ok = self._navigate(key)
            if not ok:
                self._error(full_path, "list", None, "missing or unreachable", None)
                return list(default) if default is not None else []
            container = value._raw if isinstance(value, SafeData) else value

        if not isinstance(container, list):
            self._error(full_path, "list", container, "not a list", None)
            return list(default) if default is not None else []

        out: list[T] = []
        for i, element in enumerate(container):
            elem_path = f"{full_path}[{i}]" if full_path else f"[{i}]"
            unwrapped = element._raw if isinstance(element, SafeData) else element

            if type_ is SafeData:
                if isinstance(element, SafeData) and isinstance(element._raw, dict):
                    out.append(element)  # type: ignore[arg-type]
                else:
                    self._error(elem_path, "SafeData", unwrapped, "element is not a dict", None)
                continue

            if type_ is bool:
                if isinstance(unwrapped, bool):
                    out.append(unwrapped)  # type: ignore[arg-type]
                else:
                    self._error(elem_path, "bool", unwrapped, "element is not a bool", None)
                continue

            # bool is a subclass of int — reject it for int/float/str so we don't quietly accept True/False as 1/0.
            if isinstance(unwrapped, bool):
                self._error(elem_path, type_.__name__, unwrapped, "bool not accepted for this list type", None)
                continue

            if type_ is int and isinstance(unwrapped, int):
                out.append(unwrapped)  # type: ignore[arg-type]
                continue
            if type_ is float and isinstance(unwrapped, (int, float)):
                out.append(float(unwrapped))  # type: ignore[arg-type]
                continue
            if type_ is str and isinstance(unwrapped, str):
                out.append(unwrapped)  # type: ignore[arg-type]
                continue

            self._error(elem_path, type_.__name__, unwrapped, "element type mismatch", None)

        return out

    # --- Internals -------------------------------------------------------

    def _navigate(self, key: "Path") -> tuple[Any, str, bool]:
        """Resolve a path. Returns (value, full_path, ok).

        `key` is a dotted string (split on ".") or a sequence of literal
        segments (no splitting — use this when a key itself contains a
        dot). On any failure (missing key, bad index, wrong container
        shape), ok is False — caller decides whether that's an error.

        Each segment is matched as a dict key verbatim; if the current
        node is a list, the segment must parse as a non-negative integer
        index.
        """
        node: Any = self
        full_path = self._path
        for segment in _segments(key):
            full_path = _join(full_path, segment)
            container = node._raw if isinstance(node, SafeData) else node
            if isinstance(container, dict):
                if segment in container:
                    node = container[segment]
                    continue
                return None, full_path, False
            if isinstance(container, list):
                try:
                    idx = int(segment)
                except ValueError:
                    return None, full_path, False
                if 0 <= idx < len(container):
                    node = container[idx]
                    continue
                return None, full_path, False
            return None, full_path, False
        return node, full_path, True

    def _coalesce_error_info(self, candidates: tuple, last_path: str) -> tuple[str, str]:
        """Build (error_path, reason) for a failed multi-path lookup."""
        if len(candidates) == 1:
            return last_path, "missing or wrong type"
        named = ", ".join(_path_display(k) for k in candidates if k is not None)
        return self._path or "<root>", f"no candidate path matched: {named}"

    def _error(
        self,
        path: str,
        expected: str,
        actual: Any,
        reason: str,
        default: T,
    ) -> T:
        # Poisoned nodes are fallbacks from an already-logged failure
        # higher up — silently return the default so callers don't get
        # a flood of secondary errors for the same root cause.
        if self._poisoned:
            return default
        self._root.errors.append((path, expected, actual, reason))
        logger.warning(
            "safedata: %s expected %s, got %s (%s)",
            path or "<root>",
            expected,
            _truncate_repr(actual),
            reason,
        )
        self._fire_hook(path, expected, actual, reason)
        return default

    @classmethod
    def _fire_hook(cls, path: str, expected: str, actual: Any, reason: str) -> None:
        hook = cls._error_hook
        if hook is None:
            return
        try:
            hook(path, expected, actual, reason)
        except Exception:  # noqa: BLE001
            logger.exception("safedata: error hook raised")


def _join(parent: str, segment: str) -> str:
    return f"{parent}.{segment}" if parent else segment


def _segments(key: "Path") -> list[str]:
    """Normalise a path to a list of literal segments.

    A str is split on "."; a sequence of strings is taken verbatim
    (each element is one literal key, even if it contains a dot).
    """
    if isinstance(key, str):
        return key.split(".")
    return list(key)


def _path_display(key: "Path") -> str:
    """Render a path for error messages.

    Literal-segment paths are shown bracketed so a dotted key is
    distinguishable from a nested path: ["user.name"] -> ['user.name'].
    """
    if isinstance(key, str):
        return key
    return "[" + ", ".join(repr(s) for s in key) + "]"


# --- Scalar coercion ----------------------------------------------------
#
# Each helper takes a navigated value and returns (matched, result).
# `matched` is False when the value cannot be produced as the target
# type; in that case `result` is None and the caller falls through to
# the next candidate path (or records an error if none remain). These
# never log — error reporting is the getter's job.

def _coerce_str(value: Any) -> tuple[bool, Any]:
    if value is None:
        return False, None
    if isinstance(value, str):
        return True, value
    if isinstance(value, (int, float, bool)):
        return True, str(value)
    return False, None


def _coerce_int(value: Any) -> tuple[bool, Any]:
    if isinstance(value, bool):
        return False, None  # bool is a subclass of int — reject it explicitly
    if isinstance(value, int):
        return True, value
    if isinstance(value, float):
        return (True, int(value)) if value.is_integer() else (False, None)
    if isinstance(value, str):
        try:
            return True, int(value)
        except ValueError:
            return False, None
    return False, None


def _coerce_float(value: Any) -> tuple[bool, Any]:
    if isinstance(value, bool):
        return False, None
    if isinstance(value, (int, float)):
        return True, float(value)
    if isinstance(value, str):
        try:
            return True, float(value)
        except ValueError:
            return False, None
    return False, None


def _coerce_bool(value: Any) -> tuple[bool, Any]:
    if isinstance(value, bool):
        return True, value
    return False, None
