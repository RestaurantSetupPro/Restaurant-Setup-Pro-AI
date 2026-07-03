@echo off
setlocal
cd /d "%~dp0"

echo Restaurant Setup Pro - Alpha Fix Sync
echo.
echo Staging the completed Module07 and Alpha fixes...
git add .
if errorlevel 1 goto :error

git diff --cached --quiet
if not errorlevel 1 goto :nothing

echo Creating the Git commit...
git commit -m "fix: complete Module07 alpha inquiry and quote workflow"
if errorlevel 1 goto :error

echo Pushing to GitHub main...
git push origin main
if errorlevel 1 goto :error

echo.
echo SUCCESS: The Alpha fixes are now on GitHub main.
echo Restart the app with: npm start
pause
exit /b 0

:nothing
echo.
echo There are no uncommitted changes to sync.
pause
exit /b 0

:error
echo.
echo The sync did not finish. Keep this window open and share the error shown above.
pause
exit /b 1
