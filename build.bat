@echo off
setlocal
cd /d "%~dp0"
echo ==============================================
echo   FUSION-ONE - Build (Next.js production)
echo ==============================================
echo.
call npm run build
echo.
echo Build finished.
echo   - Start now:               start the app (npm start -> http://localhost:5262)
echo.
pause
