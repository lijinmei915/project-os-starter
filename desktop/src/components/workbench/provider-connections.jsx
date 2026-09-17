import { Plus, X } from "lucide-react";
import { Notice } from "../ui/notice";

export function ProviderConnections({ activeProfileId, disabled = false, onCreate, onDelete, onEdit, profiles, providerError, profileLabel }) {
  return (
    <div className="providerSavedConnections" aria-label="已保存连接">
      <div className="providerSectionTitle">
        <span>已保存连接</span>
      </div>
      {profiles.length ? (
        <div className="providerConnectionList">
          {profiles.map((profile) => {
            const active = profile.id === activeProfileId;
            return (
              <div className={`providerConnectionItem${active ? " active" : ""}`} key={profile.id}>
                <button className="providerConnectionMain" disabled={disabled} type="button" onClick={() => onEdit(profile)}>
                  <strong>{profileLabel(profile)}</strong>
                </button>
                <button
                  className="tileRemoveButton providerConnectionRemove"
                  type="button"
                  onClick={() => onDelete(profile)}
                  aria-label={`删除连接 ${profileLabel(profile)}`}
                  disabled={disabled}
                >
                  <X strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            );
          })}
          <button className="providerConnectionItem providerConnectionAdd" disabled={disabled} type="button" onClick={onCreate} aria-label="新建连接">
            <Plus strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button className="providerConnectionItem providerConnectionAdd providerConnectionAdd-empty" disabled={disabled} type="button" onClick={onCreate}>
          <Plus strokeWidth={2.25} aria-hidden="true" />
          <span>新建连接</span>
        </button>
      )}
      {providerError ? <Notice className="providerError providerConnectionError" variant="danger">{providerError}</Notice> : null}
    </div>
  );
}
