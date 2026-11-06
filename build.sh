#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  WarHutTV Build${NC}"
echo -e "${CYAN}========================================${NC}"

# 1. Clean
echo -e "\n${YELLOW}[1/5] Cleaning...${NC}"
rm -rf bin/ frontend/dist/ backend/frontend/
mkdir -p bin
echo -e "${GREEN}  Done${NC}"

# 2. Build frontend
echo -e "\n${YELLOW}[2/5] Building frontend...${NC}"
cd frontend
if ! pnpm run build; then
    echo -e "${RED}  Frontend build failed!${NC}"
    exit 1
fi
cd ..
echo -e "${GREEN}  Done${NC}"

# 3. Build backend
echo -e "\n${YELLOW}[3/5] Building backend...${NC}"
cd backend
mkdir -p frontend
rm -rf frontend/dist
cp -r ../frontend/dist frontend/dist

# Version is injected into the binary so /api/version works in release images
# (where the tracked `version` file may not be shipped). -trimpath keeps local
# absolute paths out of the binary.
VERSION=$(cat ../version 2>/dev/null | tr -d '[:space:]')
VERSION=${VERSION:-dev}
LDFLAGS="-s -w -X main.version=${VERSION}"

# Keep this list in sync with build.ps1 and the README platform table.
build_target() {
    local goos=$1 goarch=$2 out=$3
    echo -e "  Building ${goos}/${goarch}..."
    GOOS=$goos GOARCH=$goarch CGO_ENABLED=0 \
        go build -tags embed -trimpath -ldflags="$LDFLAGS" -o "../bin/${out}" .
}

build_target linux amd64 warhutv-linux-amd64
build_target linux arm64 warhutv-linux-arm64
build_target windows amd64 warhutv-windows-amd64.exe
build_target darwin amd64 warhutv-darwin-amd64
build_target darwin arm64 warhutv-darwin-arm64

rm -rf frontend
cd ..
echo -e "${GREEN}  Done${NC}"

# 4. Compress with UPX
echo -e "\n${YELLOW}[4/5] Compressing with UPX...${NC}"
if command -v upx &> /dev/null; then
    # Non-fatal: UPX does not support every format (e.g. darwin Mach-O with
    # --lzma), so a failure here must not abort an otherwise good build.
    for f in bin/*; do
        [ -f "$f" ] || continue
        echo -e "  Compressing $(basename "$f")..."
        upx --best --lzma "$f" 2>/dev/null || true
    done
    echo -e "${GREEN}  Done${NC}"
else
    echo -e "${YELLOW}  UPX not found, skipping compression${NC}"
fi

# 5. Result
echo -e "\n${YELLOW}[5/5] Build Complete!${NC}"
echo -e "${CYAN}========================================${NC}"

echo -e "\n${YELLOW}Output files:${NC}"
for f in bin/*; do
    if [ -f "$f" ]; then
        size=$(du -h "$f" | cut -f1)
        echo -e "  ${GREEN}${f}  ${size}${NC}"
    fi
done

echo ""
