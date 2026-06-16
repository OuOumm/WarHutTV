@echo off
chcp 65001 >nul
echo ========================================
echo   WarHutTV 构建脚本
echo ========================================

REM 1. 清理旧构建
echo.
echo [1/4] 清理旧构建...
if exist bin rmdir /s /q bin
if exist frontend\dist rmdir /s /q frontend\dist
mkdir bin 2>nul

REM 2. 构建前端
echo.
echo [2/4] 构建前端...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo 前端构建失败!
    exit /b 1
)
cd ..

REM 3. 构建后端
echo.
echo [3/4] 构建后端...
cd backend

REM Windows版本
echo   构建 Windows amd64...
set GOOS=windows
set GOARCH=amd64
go build -o ..\bin\warhutv-windows-amd64.exe -ldflags="-s -w" .
if %errorlevel% neq 0 (
    echo Windows构建失败!
    exit /b 1
)

REM Linux版本
echo   构建 Linux amd64...
set GOOS=linux
set GOARCH=amd64
go build -o ..\bin\warhutv-linux-amd64 -ldflags="-s -w" .
if %errorlevel% neq 0 (
    echo Linux构建失败!
    exit /b 1
)

REM 恢复环境变量
set GOOS=
set GOARCH=

cd ..

REM 完成
echo.
echo ========================================
echo   构建完成!
echo ========================================
echo.
echo 输出文件:
dir /b bin
echo.
echo 配置文件: data\config.json
echo.
echo 使用方法:
echo   Windows: bin\warhutv-windows-amd64.exe
echo   Linux:   ./bin/warhutv-linux-amd64
