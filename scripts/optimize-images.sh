#!/usr/bin/env bash
# Convierte PNG/JPG a WebP en un directorio dado.
# Uso: ./scripts/optimize-images.sh [directorio]
# Por defecto procesa images/tratamientos/
#
# Requiere: cwebp (instalar con: brew install webp / apt install webp)

set -euo pipefail

DIR="${1:-images/tratamientos}"

if ! command -v cwebp &>/dev/null; then
  echo "Error: cwebp no encontrado. Instala con: brew install webp (macOS) o apt install webp (Linux)"
  exit 1
fi

echo "Optimizando imágenes en: $DIR"
count=0

for img in "$DIR"/*.{png,jpg,jpeg,PNG,JPG,JPEG}; do
  [ -f "$img" ] || continue
  base="${img%.*}"
  webp_out="${base}.webp"

  if [ -f "$webp_out" ]; then
    echo "  skip (ya existe): $webp_out"
    continue
  fi

  cwebp -q 85 "$img" -o "$webp_out" 2>/dev/null
  original_size=$(wc -c < "$img")
  webp_size=$(wc -c < "$webp_out")
  pct=$(( (original_size - webp_size) * 100 / original_size ))
  echo "  ✓ $(basename "$img") → $(basename "$webp_out") (-${pct}%)"
  ((count++))
done

echo ""
echo "Listo. $count imagen(es) convertida(s)."
