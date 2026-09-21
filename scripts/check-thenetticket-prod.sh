#!/usr/bin/env bash
# Smoke checks against production TheNetTicket (no auth).
set -euo pipefail
BASE="${1:-https://ticket.thenetvr.com}"
fail=0

echo "== Checking $BASE =="

html=$(curl -fsSL "$BASE/")
if echo "$html" | grep -q 'appUrl:"http://localhost:3000"'; then
  echo "FAIL B2: public.appUrl is http://localhost:3000 on $BASE/"
  fail=1
else
  app=$(echo "$html" | grep -o 'appUrl:"[^"]*"' | head -1 || true)
  echo "OK   B2: appUrl not localhost ($app)"
fi

sw=$(curl -fsSL "$BASE/sw.js")
if echo "$sw" | grep -q 'createHandlerBoundToURL("/scan")'; then
  if echo "$sw" | grep -qE 'url:"/?scan"'; then
    echo "OK   B1: /scan appears in SW precache"
  else
    echo "FAIL B1: navigateFallback=/scan but /scan HTML not in precache manifest"
    fail=1
  fi
else
  echo "INFO B1: no createHandlerBoundToURL(/scan) in sw.js"
fi

dash=$(curl -sI "$BASE/dashboard" | tr -d '\r')
if echo "$dash" | grep -qi 'location:.*sign-in'; then
  echo "OK   dashboard redirects to sign-in when signed out"
else
  echo "WARN dashboard redirect check inconclusive"
  echo "$dash" | head -15
fi

scan=$(curl -fsSL "$BASE/scan")
if echo "$scan" | grep -q 'data-ssr="false"'; then
  echo "INFO B3: /scan is client-only (ssr=false)"
fi

exit "$fail"
