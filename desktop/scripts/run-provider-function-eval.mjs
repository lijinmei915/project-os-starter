import fs from "node:fs";
import path from "node:path";
import { normalizeProviderUsage } from "../src/agent-runtime/provider-evaluation.js";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};

const apiBase = String(process.env.OMNIDESK_AGENT_EVAL_API_BASE || "").trim();
const apiKey = String(process.env.OMNIDESK_AGENT_EVAL_KEY || "").trim();
const model = String(process.env.OMNIDESK_AGENT_EVAL_MODEL || "").trim();
const tracePath = argument("--trace") ? path.resolve(argument("--trace")) : "";
if (!apiBase || !apiKey || !model) {
  throw new Error("Provider Function Eval requires API base, key, and model environment values");
}
if (!tracePath) throw new Error("Provider Function Eval requires --trace");

function chatCompletionsEndpoint(base) {
  const normalized = base.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

const tool = {
  type: "function",
  function: {
    name: "start_engineering_task",
    description: "Start an engineering task when the user explicitly requests a code change.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        task: { type: "string", description: "The requested engineering outcome." },
      },
      required: ["task"],
    },
  },
};
const request = {
  model,
  messages: [
    {
      role: "system",
      content: "You are an engineering task router. For explicit code changes, call start_engineering_task.",
    },
    {
      role: "user",
      content: "请修改 README，把过期的启动命令替换为当前命令。",
    },
  ],
  tools: [tool],
  tool_choice: { type: "function", function: { name: "start_engineering_task" } },
  temperature: 0,
  stream: false,
};

const startedAt = new Date().toISOString();
const started = Date.now();
const response = await fetch(chatCompletionsEndpoint(apiBase), {
  method: "POST",
  headers: {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  },
  body: JSON.stringify(request),
  signal: AbortSignal.timeout(60_000),
});
const rawBody = await response.text();
let body;
try {
  body = JSON.parse(rawBody);
} catch {
  body = { parseError: true, excerpt: rawBody.slice(0, 1000) };
}
const toolCalls = Array.isArray(body?.choices?.[0]?.message?.tool_calls)
  ? body.choices[0].message.tool_calls
  : [];
const call = toolCalls.find((item) => item?.function?.name === "start_engineering_task");
let parsedArguments = null;
try {
  parsedArguments = JSON.parse(String(call?.function?.arguments || ""));
} catch {
  parsedArguments = null;
}
const accepted = response.ok;
const validCall = Boolean(call && typeof parsedArguments?.task === "string" && parsedArguments.task.trim());
const usage = normalizeProviderUsage(body?.usage);
const trace = {
  schemaVersion: "omnidesk.provider-function-eval.v0.1",
  startedAt,
  completedAt: new Date().toISOString(),
  durationMs: Date.now() - started,
  endpointHost: new URL(chatCompletionsEndpoint(apiBase)).host,
  model,
  request: {
    stream: false,
    toolChoice: "start_engineering_task",
    toolNames: ["start_engineering_task"],
  },
  response: {
    accepted,
    httpStatus: response.status,
    finishReason: body?.choices?.[0]?.finish_reason || "",
    toolNames: toolCalls.map((item) => String(item?.function?.name || "")).filter(Boolean),
    argumentsValid: validCall,
    providerRequestId: response.headers.get("x-request-id") || "",
    usage,
    raw: body,
  },
};
fs.mkdirSync(path.dirname(tracePath), { recursive: true });
fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
if (!accepted) {
  throw new Error(`Provider rejected native tools with HTTP ${response.status}; trace: ${tracePath}`);
}
if (!validCall) {
  throw new Error(`Provider did not return a valid start_engineering_task call; trace: ${tracePath}`);
}
if (!usage.reported) {
  throw new Error(`Provider did not return complete token usage; trace: ${tracePath}`);
}
process.stdout.write(`${JSON.stringify({ status: "passed", tracePath, model, durationMs: trace.durationMs })}\n`);
