#!/usr/bin/env sh
cd "$(dirname "$0")"
printf 'APURA 26 - Criado por Rodrigo Bahiense\nhttp://localhost:8765\n'
python3 -m http.server 8765
