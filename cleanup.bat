@echo off
echo ====================================
echo   FUSION ONE - Cleanup
echo ====================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Run as Administrator. Right-click this file - Run as administrator.
    pause
    exit /b 1
)

echo [1/4] Removing hosts entries...
findstr /V /C:"fusion.one" %SystemRoot%\System32\drivers\etc\hosts > %TEMP%\hosts.tmp
move /Y %TEMP%\hosts.tmp %SystemRoot%\System32\drivers\etc\hosts >nul
echo Done.

echo [2/4] Restoring DNS to DHCP...
powershell -Command "$adapter = (Get-NetAdapter | Where-Object {$_.Status -eq 'Up'}).Name; Set-DnsClientServerAddress -InterfaceAlias $adapter -ResetServerAddresses"
echo Done.

echo [3/4] Removing CoreDNS service...
sc stop CoreDNS >nul 2>&1
sc delete CoreDNS >nul 2>&1
echo Done.

echo [4/4] Flushing DNS cache...
ipconfig /flushdns >nul
echo Done.

echo.
echo ====================================
echo   All cleaned up.
echo ====================================
pause
