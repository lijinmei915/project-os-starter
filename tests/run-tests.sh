#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '[test] %s\n' "$*"
}

log "tracked state"
(
  cd "$root"
  node -e 'const fs=require("fs"); const files=["docs/data/doc-structure.manifest.json"]; if (fs.existsSync(".omnidesk/data/state.json")) files.push(".omnidesk/data/state.json"); for (const file of files) JSON.parse(fs.readFileSync(file, "utf8"));'
)

log "repository contracts"
bash "$root/scripts/check-frontmatter.sh" "$root"
bash "$root/scripts/check-doc-structure.sh" "$root"
OMNIDESK_ALLOW_EMPTY_PROVIDER_KEYS=1 bash "$root/scripts/check-secrets.sh" "$root"
node "$root/scripts/audit-repository-files.mjs" --check
node "$root/scripts/audit-schema-contracts.mjs" --check

log "desktop node regression"
npm --prefix "$root/desktop" test

log "desktop web build"
npm --prefix "$root/desktop" run web:build
npm --prefix "$root/desktop" run check:bundle

log "agent eval baseline"
npm --prefix "$root/desktop" run check:agent-eval

log "desktop runtime regression"
cargo test --manifest-path "$root/desktop/src-tauri/Cargo.toml"

log "diff integrity"
git -C "$root" diff --check

echo "[test] OmniDesk regression passed"
