import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

function RequiredLabel({ children }) {
  return <span className="requiredLabel">{children}<span aria-hidden="true" className="requiredMark">*</span></span>;
}

export function ProviderFormFields({ apiKey, apiKeyHint, catalogProviders, customModel, form, modelOptions, onApiKeyChange, onFieldChange, onModelChange, onProviderChange, selectedProviderId }) {
  return (
    <>
      <div className="providerSectionTitle">基础设置</div>
      <Field label="连接名称" hint="只用于识别，不影响实际调用。">
        {({ id }) => <Input id={id} value={form.profileName || ""} onChange={(event) => onFieldChange("profileName", event.target.value)} placeholder="例如：公司网关、我的 OpenAI" />}
      </Field>
      <Field label={<RequiredLabel>服务商</RequiredLabel>}>
        {({ id }) => <Select id={id} value={selectedProviderId || "gateway"} onChange={onProviderChange}>{catalogProviders.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}</Select>}
      </Field>
      <Field label={<RequiredLabel>API 地址</RequiredLabel>}>
        {({ id }) => <Input id={id} value={form.apiBase} onChange={(event) => onFieldChange("apiBase", event.target.value)} placeholder="https://api.example.com/v1" />}
      </Field>
      <Field label={<RequiredLabel>API Key</RequiredLabel>} hint={apiKeyHint}>
        {({ id }) => <Input id={id} type="password" value={apiKey} onChange={(event) => onApiKeyChange(event.target.value)} placeholder="粘贴你的 API Key" />}
      </Field>
      <div className="providerSectionTitle">模型</div>
      <Field label={<RequiredLabel>模型</RequiredLabel>}>
        {({ id }) => <Select id={id} value={!customModel && modelOptions.includes(form.model) ? form.model : "__custom"} onChange={onModelChange}>{modelOptions.map((model) => <option value={model} key={model}>{model}</option>)}<option value="__custom">自定义</option></Select>}
      </Field>
      {customModel || !modelOptions.includes(form.model) ? <Field label={<RequiredLabel>自定义模型</RequiredLabel>}>{({ id }) => <Input id={id} value={form.model} onChange={(event) => onFieldChange("model", event.target.value)} placeholder="例如：gpt-4o-mini" />}</Field> : null}
    </>
  );
}
