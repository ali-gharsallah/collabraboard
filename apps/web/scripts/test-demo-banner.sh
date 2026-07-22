#!/usr/bin/env bash
# Test léger du bandeau « mode démonstration » — compile à la volée (comme le harnais backend)
# puis exécute en Node. Aucun runner de test à installer.
set -e
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
npx tsc src/components/DemoModeBanner.tsx src/lib/api.ts src/components/demo-banner.spec.tsx \
  --jsx react --target es2020 --module commonjs --moduleResolution node --esModuleInterop \
  --skipLibCheck --noEmitOnError false --strict false --outDir "$OUT" 2>/dev/null || true
export NODE_PATH="$PWD/node_modules:$(cd ../.. && pwd)/node_modules"
node "$OUT/components/demo-banner.spec.js"
