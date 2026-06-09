@echo off
REM ============================================================
REM  LumiTEA - servidor local
REM  Sobe um HTTP server em http://localhost:8080 usando
REM  PowerShell puro (nao precisa de Python/Node/PHP).
REM ============================================================

cd /d "%~dp0"

set PORT=8080
set URL=http://localhost:%PORT%/index.html

echo.
echo  ============================================================
echo   LumiTEA - Iniciando servidor local na porta %PORT%
echo  ============================================================
echo.

where powershell >nul 2>nul
if %ERRORLEVEL%==0 (
    echo [OK] Usando PowerShell (sem dependencias externas)
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port %PORT%
    goto :EOF
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
    echo [OK] Usando Python (py -3)
    start "" "%URL%"
    py -3 -m http.server %PORT%
    goto :EOF
)

where node >nul 2>nul
if %ERRORLEVEL%==0 (
    echo [OK] Usando Node (npx http-server)
    start "" "%URL%"
    npx --yes http-server -p %PORT% -c-1 .
    goto :EOF
)

echo.
echo [ERRO] Nem PowerShell nem Python nem Node encontrados.
pause
