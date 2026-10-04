@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  set PY=py
) else (
  set PY=python
)
echo.
echo APURA 26 - Criado por Rodrigo Bahiense
echo Iniciando em http://localhost:8765
echo Para encerrar, feche esta janela.
echo.
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8765"
%PY% -m http.server 8765
endlocal
