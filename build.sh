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
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}  Frontend build failed!${NC}"
    exit 1
fi
cd ..
echo -e "${GREEN}  Done${NC}"

# 3. Build backend
echo -e "\n${YELLOW}[3/5] Building backend...${NC}"
cd backend
cp -r ../frontend/dist frontend/dist

echo -e "  Building Linux amd64..."
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o ../bin/warhutv-linux-amd64 .
LIN_OK=$?

echo -e "  Building Linux arm64..."
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -o ../bin/warhutv-linux-arm64 .
LIN_ARM_OK=$?

echo -e "  Building Windows amd64..."
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o ../bin/warhutv-windows-amd64.exe .
WIN_OK=$?

echo -e "  Building Darwin amd64..."
GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o ../bin/warhutv-darwin-amd64 .
DARWIN_OK=$?

echo -e "  Building Darwin arm64..."
GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -o ../bin/warhutv-darwin-arm64 .
DARWIN_ARM_OK=$?

rm -rf frontend
cd ..

if [ $LIN_OK -ne 0 ] || [ $LIN_ARM_OK -ne 0 ] || [ $WIN_OK -ne 0 ] || [ $DARWIN_OK -ne 0 ] || [ $DARWIN_ARM_OK -ne 0 ]; then
    echo -e "${RED}  Backend build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}  Done${NC}"

# 4. Compress with UPX
echo -e "\n${YELLOW}[4/5] Compressing with UPX...${NC}"
if command -v upx &> /dev/null; then
    echo -e "  Compressing Linux amd64..."
    upx --best --lzma bin/warhutv-linux-amd64 2>/dev/null || true
    echo -e "  Compressing Linux arm64..."
    upx --best --lzma bin/warhutv-linux-arm64 2>/dev/null || true
    echo -e "  Compressing Windows amd64..."
    upx --best --lzma bin/warhutv-windows-amd64.exe 2>/dev/null || true
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
