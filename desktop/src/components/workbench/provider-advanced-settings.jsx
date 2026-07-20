import { Field } from "../ui/field";
import { Input } from "../ui/input";

export function ProviderAdvancedSettings({ form, readOnly, onFieldChange, usesCatalogPreset }) {
  return (
    <details className="advancedProvider">
      <summary>
        <span>高级设置</span>
        {usesCatalogPreset ? <small>来自服务商预设</small> : <small>自定义连接</small>}
      </summary>
      <Field label="备注">
        {({ id }) => <Input id={id} value={form.profileNote || ""} onChange={(event) => onFieldChange("profileNote", event.target.value)} placeholder="例如：团队共用" readOnly={readOnly} />}
      </Field>
      <Field className="providerReadOnly" label="接入方式">
        {({ id }) => <Input id={id} value={form.provider} onChange={(event) => onFieldChange("provider", event.target.value)} readOnly={readOnly} />}
      </Field>
      <Field label="Key 保存变量名">
        {({ id }) => <Input id={id} value={form.apiKeyEnv} onChange={(event) => onFieldChange("apiKeyEnv", event.target.value)} readOnly={readOnly} />}
      </Field>
      <Field label="官网链接">
        {({ id }) => <Input id={id} value={form.profileWebsite || ""} onChange={(event) => onFieldChange("profileWebsite", event.target.value)} placeholder="https://..." readOnly={readOnly} />}
      </Field>
    </details>
  );
}
