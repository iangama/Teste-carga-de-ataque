#!/usr/bin/env bash
set -euo pipefail

UI="http://localhost:5173"
c() { curl -fsS --connect-timeout 2 --max-time 10 "$@"; }

echo "==[0] containers =="
docker compose ps

echo
echo "==[1] UI root (:5173) =="
c "$UI/" >/dev/null
echo "OK"

echo
echo "==[2] health (via UI proxy /api/*) =="
c "$UI/api/ingest/health" >/dev/null
c "$UI/api/observe/health" >/dev/null
c "$UI/api/diagnose/health" >/dev/null
echo "OK"

echo
echo "==[3] ingest input =="
ID=$(c -X POST "$UI/api/ingest/inputs" \
  -H 'content-type:application/json' \
  -d '{"source":"smoke","payload":"aaaaaaaaaaaa free promo click http://x.com"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).id')
echo "ID=$ID"
test -n "$ID"

echo
echo "==[4] observe run =="
c -X POST "$UI/api/observe/run" >/dev/null
echo "OK"

echo
echo "==[5] diagnose run + episodes =="
c -X POST "$UI/api/diagnose/run" | node -pe 'const o=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log("state",o.state,"conf",o.confidence,"unknowns",JSON.stringify(o.unknowns))'
c "$UI/api/diagnose/episodes" | node -pe 'const o=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log("episodes",o.episodes.length)'
echo "OK"

echo
echo "==[6] prom/grafana =="
c -o /dev/null "http://localhost:9090/-/ready"
c -o /dev/null "http://localhost:3000/api/health"
echo "OK"

echo
echo "==============================="
echo "ALL SMOKES PASSED — N26 OK"
echo "==============================="
