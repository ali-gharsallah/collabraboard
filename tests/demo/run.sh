#!/usr/bin/env bash
# Corpus exécutable des scénarios de paramétrage (B-01..B-07 / R93..R99).
set -e
cd "$(dirname "$0")"
node sandbox-scenarios.spec.mjs
