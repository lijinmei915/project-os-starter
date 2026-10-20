"""Process-local compatibility for Hermes' readonly ACP completion callback.

Hermes 0.18.2/0.19.0 passes serialized function arguments from its step
callback to a display formatter that expects a mapping. The exception loses
the completion notification. Normalize that argument only; the original
formatter and success/failure classification still own the result.
Loaded as sitecustomize only inside OmniDesk's temporary readonly home.
"""

import importlib.metadata
import json


def normalize_read_completion(original):
    def complete(tool_call_id, tool_name, result=None, function_args=None, snapshot=None):
        if tool_name == "read_file" and isinstance(function_args, str):
            function_args = json.loads(function_args)
            if not isinstance(function_args, dict):
                raise ValueError("Hermes read_file arguments must be a JSON object")
        return original(
            tool_call_id,
            tool_name,
            result=result,
            function_args=function_args,
            snapshot=snapshot,
        )

    return complete


def install():
    if importlib.metadata.version("hermes-agent") not in {"0.18.2", "0.19.0"}:
        return
    import acp_adapter.events

    acp_adapter.events.build_tool_complete = normalize_read_completion(
        acp_adapter.events.build_tool_complete
    )


install()
