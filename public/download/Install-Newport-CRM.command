#!/bin/bash
set -euo pipefail
URL="https://samadalam481470sa-cmd.github.io/sammyyyy/"
if open -na "Microsoft Edge" --args --app="$URL"; then
  exit 0
fi
open -na "Google Chrome" --args --app="$URL"
