export function mcpToolFields(schema = {}) {
  const properties = schema?.properties && typeof schema.properties === "object" ? schema.properties : {};
  const required = new Set(Array.isArray(schema?.required) ? schema.required : []);
  return Object.entries(properties).map(([name, property]) => ({
    description: String(property?.description || ""),
    enum: Array.isArray(property?.enum) ? property.enum : null,
    name,
    required: required.has(name),
    type: String(property?.type || "string"),
  }));
}

export function initialMcpToolValues(schema = {}) {
  return Object.fromEntries(mcpToolFields(schema).map((field) => {
    if (field.type === "boolean") return [field.name, false];
    if (field.type === "object") return [field.name, "{}"];
    if (field.type === "array") return [field.name, "[]"];
    if (field.type === "null") return [field.name, "null"];
    return [field.name, ""];
  }));
}

export function buildMcpToolArguments(schema = {}, values = {}) {
  const arguments_ = {};
  const errors = {};
  for (const field of mcpToolFields(schema)) {
    const value = values[field.name];
    const empty = value === "" || value === undefined || value === null;
    if (empty) {
      if (field.required) errors[field.name] = "此参数必填";
      continue;
    }
    try {
      let normalized = value;
      if (field.type === "number" || field.type === "integer") {
        normalized = Number(value);
        if (!Number.isFinite(normalized) || (field.type === "integer" && !Number.isInteger(normalized))) {
          throw new Error(field.type === "integer" ? "请输入整数" : "请输入数字");
        }
      } else if (field.type === "object" || field.type === "array") {
        normalized = JSON.parse(String(value));
        if (field.type === "object" && (Array.isArray(normalized) || normalized === null || typeof normalized !== "object")) {
          throw new Error("请输入 JSON 对象");
        }
        if (field.type === "array" && !Array.isArray(normalized)) throw new Error("请输入 JSON 数组");
      } else if (field.type === "null") {
        normalized = null;
      } else if (field.type === "string") {
        normalized = String(value);
      }
      if (field.enum && !field.enum.some((candidate) => Object.is(candidate, normalized))) {
        throw new Error("请选择有效选项");
      }
      arguments_[field.name] = normalized;
    } catch (error) {
      errors[field.name] = error instanceof Error ? error.message : String(error);
    }
  }
  return { arguments_, errors, valid: Object.keys(errors).length === 0 };
}

export function emptyMcpServerDraft() {
  return {
    approvalPolicy: "always",
    args: [],
    command: "",
    enabled: true,
    env: [],
    id: "",
    name: "",
    schemaVersion: "omnidesk.mcp-server.v0.1",
    transport: "stdio",
  };
}

export function mcpServerDraft(server) {
  return {
    ...emptyMcpServerDraft(),
    ...server,
    args: Array.isArray(server?.args) ? [...server.args] : [],
    env: Array.isArray(server?.env) ? server.env.map((binding) => ({ ...binding })) : [],
  };
}
