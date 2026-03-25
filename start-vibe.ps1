# start-vibe.ps1 - VibeMe Full Startup Script
$ErrorActionPreference = "SilentlyContinue"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   VibeMe Startup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Cleanup port 3001 if occupied
$old = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($old) {
    Write-Host "Freeing port 3001..." -ForegroundColor Yellow
    Stop-Process -Id $old.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# 2. Start backend in new window
Write-Host "Starting backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run start:dev"
Start-Sleep -Seconds 3

# 3. Start localtunnel in new window
Write-Host "Starting localtunnel..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx localtunnel --port 3001 --subdomain vibeme-final-v3-1941141175"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend running at http://localhost:3001" -ForegroundColor Green
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169' } | Select-Object -First 1).IPAddress
Write-Host "Network URL (for phones on same WiFi): http://$ip:3001" -ForegroundColor Green
Write-Host "Tunnel URL: https://vibeme-final-v3-1941141175.loca.lt" -ForegroundColor Green
Write-Host ""
Write-Host "📱 TO TEST ON YOUR PHYSICAL PHONE:" -ForegroundColor Yellow
Write-Host "  1. Connect your phone to the SAME WiFi network as this PC" -ForegroundColor White
Write-Host "  2. Run the following commands to build the APK:" -ForegroundColor White
Write-Host "       cd frontend" -ForegroundColor Gray
Write-Host "       npm run build:phone" -ForegroundColor Gray
Write-Host "       npx cap sync android" -ForegroundColor Gray
Write-Host "       cd android; .\gradlew assembleDebug" -ForegroundColor Gray
Write-Host "  3. Copy the APK from 'frontend\android\app\build\outputs\apk\debug\app-debug.apk'" -ForegroundColor White
Write-Host "     to your phone and install it." -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
