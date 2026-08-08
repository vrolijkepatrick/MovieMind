@echo off
setlocal
title MovieMind Studio lokale server
cd /d "%~dp0"

echo ==========================================
echo        MovieMind Studio lokale server
echo ==========================================
echo.
echo Servermap:
echo %CD%
echo.
echo BELANGRIJK:
echo Dit bestand moet in de HOOFDMAP MovieMind staan.
echo In diezelfde map moeten o.a. game, data en MovieMind Studio staan.
echo.
echo De lokale server start op:
echo http://localhost:8000/
echo.
echo Laat het zwarte servervenster open zolang je de Studio gebruikt.
echo.

set "PSFILE=%TEMP%\moviemind_static_server.ps1"

> "%PSFILE%" echo param([string]$Root)
>>"%PSFILE%" echo $ErrorActionPreference = 'Stop'
>>"%PSFILE%" echo $listener = New-Object System.Net.HttpListener
>>"%PSFILE%" echo $listener.Prefixes.Add('http://localhost:8000/')
>>"%PSFILE%" echo try {
>>"%PSFILE%" echo     $listener.Start()
>>"%PSFILE%" echo     Write-Host 'MovieMind server actief op http://localhost:8000/' -ForegroundColor Green
>>"%PSFILE%" echo     Write-Host ('Map: ' + $Root)
>>"%PSFILE%" echo     Write-Host 'Sluiten met Ctrl+C.'
>>"%PSFILE%" echo     while ($listener.IsListening) {
>>"%PSFILE%" echo         $context = $listener.GetContext()
>>"%PSFILE%" echo         $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
>>"%PSFILE%" echo         if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = 'index.html' }
>>"%PSFILE%" echo         $localPath = Join-Path $Root ($requestPath -replace '/', '\')
>>"%PSFILE%" echo         if (Test-Path $localPath -PathType Container) { $localPath = Join-Path $localPath 'index.html' }
>>"%PSFILE%" echo         $rootFull = [System.IO.Path]::GetFullPath($Root)
>>"%PSFILE%" echo         $fileFull = [System.IO.Path]::GetFullPath($localPath)
>>"%PSFILE%" echo         if (-not $fileFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
>>"%PSFILE%" echo             $context.Response.StatusCode = 403
>>"%PSFILE%" echo             $context.Response.Close()
>>"%PSFILE%" echo             continue
>>"%PSFILE%" echo         }
>>"%PSFILE%" echo         if (Test-Path $fileFull -PathType Leaf) {
>>"%PSFILE%" echo             $ext = [System.IO.Path]::GetExtension($fileFull).ToLowerInvariant()
>>"%PSFILE%" echo             $mime = switch ($ext) {
>>"%PSFILE%" echo                 '.html' { 'text/html; charset=utf-8' }
>>"%PSFILE%" echo                 '.htm'  { 'text/html; charset=utf-8' }
>>"%PSFILE%" echo                 '.js'   { 'application/javascript; charset=utf-8' }
>>"%PSFILE%" echo                 '.css'  { 'text/css; charset=utf-8' }
>>"%PSFILE%" echo                 '.json' { 'application/json; charset=utf-8' }
>>"%PSFILE%" echo                 '.png'  { 'image/png' }
>>"%PSFILE%" echo                 '.jpg'  { 'image/jpeg' }
>>"%PSFILE%" echo                 '.jpeg' { 'image/jpeg' }
>>"%PSFILE%" echo                 '.webp' { 'image/webp' }
>>"%PSFILE%" echo                 '.svg'  { 'image/svg+xml' }
>>"%PSFILE%" echo                 '.mp3'  { 'audio/mpeg' }
>>"%PSFILE%" echo                 '.wav'  { 'audio/wav' }
>>"%PSFILE%" echo                 default { 'application/octet-stream' }
>>"%PSFILE%" echo             }
>>"%PSFILE%" echo             $bytes = [System.IO.File]::ReadAllBytes($fileFull)
>>"%PSFILE%" echo             $context.Response.StatusCode = 200
>>"%PSFILE%" echo             $context.Response.ContentType = $mime
>>"%PSFILE%" echo             $context.Response.ContentLength64 = $bytes.Length
>>"%PSFILE%" echo             $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
>>"%PSFILE%" echo         } else {
>>"%PSFILE%" echo             $body = [System.Text.Encoding]::UTF8.GetBytes('404 - Bestand niet gevonden')
>>"%PSFILE%" echo             $context.Response.StatusCode = 404
>>"%PSFILE%" echo             $context.Response.ContentType = 'text/plain; charset=utf-8'
>>"%PSFILE%" echo             $context.Response.ContentLength64 = $body.Length
>>"%PSFILE%" echo             $context.Response.OutputStream.Write($body, 0, $body.Length)
>>"%PSFILE%" echo         }
>>"%PSFILE%" echo         $context.Response.OutputStream.Close()
>>"%PSFILE%" echo     }
>>"%PSFILE%" echo } finally {
>>"%PSFILE%" echo     if ($listener.IsListening) { $listener.Stop() }
>>"%PSFILE%" echo     $listener.Close()
>>"%PSFILE%" echo }

start "MovieMind lokale server" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PSFILE%" -Root "%CD%"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000/MovieMind%%20Studio/"

echo.
echo Browser geopend.
echo Als je een foutpagina ziet, wacht 2 seconden en druk op F5.
echo.
echo Je mag DIT venster sluiten.
echo Het andere zwarte venster met 'MovieMind server actief' moet open blijven.
echo.
pause >nul
endlocal
