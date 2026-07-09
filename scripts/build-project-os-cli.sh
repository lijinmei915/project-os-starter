#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="$root/bin"

mkdir -p "$out_dir"
cargo build --manifest-path "$root/cli/Cargo.toml" --release
cp "$root/cli/target/release/project-os" "$out_dir/project-os"
chmod +x "$out_dir/project-os"

echo "Project OS CLI built: $out_dir/project-os"
