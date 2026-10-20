"""Run against the installed pinned Hermes in protected Agent Eval."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

from acp_adapter import events, tools

SOURCE = Path(__file__).parents[1] / "src-tauri/src/runtime/hermes_readonly_compat.py"
spec = importlib.util.spec_from_file_location("omnidesk_readonly_compat", SOURCE)
compat = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compat)


class ReadonlyCompletionCompatibility(unittest.TestCase):
    def test_real_formatter_serialized_arguments_match_object_arguments(self):
        complete = compat.normalize_read_completion(tools.build_tool_complete)
        for result in ['{"content":"fixture source"}', '{"error":"fixture read denied"}']:
            expected = tools.build_tool_complete("read-1", "read_file", result, {"path": "README.md"})
            actual = complete("read-1", "read_file", result, '{"path":"README.md"}')
            self.assertEqual(actual.model_dump(), expected.model_dump())
        self.assertEqual(actual.status, "failed")

    def test_invalid_arguments_never_create_a_successful_completion(self):
        complete = compat.normalize_read_completion(tools.build_tool_complete)
        for arguments in ['not json', '[]', 'null', '"README.md"']:
            with self.assertRaises((ValueError, TypeError)):
                complete("read-1", "read_file", '{"content":"fixture"}', arguments)

    def test_unknown_version_does_not_replace_the_upstream_callback(self):
        before = events.build_tool_complete
        with patch("importlib.metadata.version", return_value="99.0.0"):
            compat.install()
        self.assertIs(events.build_tool_complete, before)

    def test_other_tools_are_not_reinterpreted(self):
        calls = []
        def original(*args, **kwargs):
            calls.append((args, kwargs))
            return "unchanged"
        complete = compat.normalize_read_completion(original)
        self.assertEqual(complete("other-1", "terminal", "failed", "unchanged"), "unchanged")
        self.assertEqual(calls[0][1]["function_args"], "unchanged")


if __name__ == "__main__":
    unittest.main()
