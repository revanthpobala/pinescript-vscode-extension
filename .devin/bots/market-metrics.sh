#!/usr/bin/env bash
# market-metrics.sh — snapshot Pine Script Pro install counts + competitor versions.
# Appends one row to metrics.csv. Run weekly (Scout's sweep) or ad hoc:
#   ./.devin/bots/market-metrics.sh
# Optional: COMPETITORS="jpantsjoha/pinescript-v6-extension hoox-sh/pyne" ./.devin/bots/market-metrics.sh
set -euo pipefail

CSV="${CSV:-$(dirname "$0")/metrics.csv}"
COMPETITORS="${COMPETITORS:-jpantsjoha/pinescript-v6-extension}"
DATE="$(date -u +%Y-%m-%d)"

py() { python3 -c "$1"; }

# --- VS Code Marketplace (flags=914 includes statistics) ---
read -r MS_INSTALLS MS_RATING MS_RATINGCOUNT MS_VERSION <<<"$(
curl -s -X POST 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=7.2-preview.1' \
  -H 'Content-Type: application/json' -H 'Accept: application/json;api-version=7.2-preview.1' \
  -d '{"filters":[{"criteria":[{"filterType":7,"value":"revanthpobala.pine-script-pro"}]}],"flags":914}' \
  | python3 -c "
import json,sys
try:
    ext=json.load(sys.stdin)['results'][0]['extensions'][0]
    s={x['statisticName']:x['value'] for x in ext.get('statistics',[])}
    print(round(s.get('install',0)), round(s.get('averagerating',0),2), int(s.get('ratingcount',0)),
          ext.get('versions',[{}])[0].get('version','?'))
except Exception:
    print('NA NA NA NA')
")"

# --- Open VSX: us + competitors ---
ovsx() { # $1 = namespace/name  -> "downloads version" or "NA NA"
  curl -s "https://open-vsx.org/api/$1" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print(d.get('downloadCount','NA'), d.get('version','NA'))
except Exception:
    print('NA NA')
"
}
read -r OVSX_DL OVSX_VER <<<"$(ovsx revanthpobala/pine-script-pro)"

COMP_COLS=""
for c in $COMPETITORS; do
  read -r c_dl c_ver <<<"$(ovsx "$c")"
  COMP_COLS+="${c_dl},${c_ver},"
done

if [ ! -f "$CSV" ]; then
  mkdir -p "$(dirname "$CSV")"
  COMP_HDR=""; for c in $COMPETITORS; do COMP_HDR+="${c//\//_}_dl,${c//\//_}_ver,"; done
  echo "date,ms_installs,ms_rating,ms_rating_count,ms_version,openvsx_downloads,openvsx_version,${COMP_HDR%,}" > "$CSV"
fi
echo "$DATE,$MS_INSTALLS,$MS_RATING,$MS_RATINGCOUNT,$MS_VERSION,$OVSX_DL,$OVSX_VER,${COMP_COLS%,}" >> "$CSV"
echo "appended -> $CSV"
tail -1 "$CSV"
