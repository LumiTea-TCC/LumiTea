# ============================================================
#  LumiTEA - servidor HTTP estatico (PowerShell puro)
#  Nao precisa de Python/Node/PHP. Roda direto no Windows.
# ============================================================

param(
    [int]$Port = 8080,
    [string]$Root = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Web

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".webp" = "image/webp"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
    ".otf"  = "font/otf"
    ".webmanifest" = "application/manifest+json"
    ".txt"  = "text/plain; charset=utf-8"
    ".md"   = "text/markdown; charset=utf-8"
    ".pdf"  = "application/pdf"
    ".mp3"  = "audio/mpeg"
    ".mp4"  = "video/mp4"
}

$listener = [System.Net.HttpListener]::new()
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host ""
    Write-Host "[ERRO] Nao foi possivel abrir a porta $Port. Outra coisa esta usando?" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host ""
Write-Host " ============================================================" -ForegroundColor Cyan
Write-Host "  LumiTEA rodando em $prefix" -ForegroundColor Cyan
Write-Host "  Pasta servida: $Root" -ForegroundColor Cyan
Write-Host "  Pressione Ctrl+C para parar." -ForegroundColor Cyan
Write-Host " ============================================================" -ForegroundColor Cyan
Write-Host ""

try { Start-Process "${prefix}index.html" -ErrorAction SilentlyContinue } catch {}

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response

        try {
            $path = [System.Web.HttpUtility]::UrlDecode($req.Url.AbsolutePath)
            if ($path -eq "/" -or $path -eq "") { $path = "/index.html" }

            $rel = $path.TrimStart("/").Replace("/", "\")
            if ([string]::IsNullOrEmpty($rel)) { $rel = "index.html" }
            $full = [System.IO.Path]::Combine($Root, $rel)

            $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd("\") + "\"
            $resolved = [System.IO.Path]::GetFullPath($full)
            if (-not $resolved.ToLower().StartsWith($rootFull.ToLower())) {
                $res.StatusCode = 403
                $res.Close()
                Write-Host "[403] $path" -ForegroundColor Yellow
                continue
            }

            if (Test-Path $resolved -PathType Container) {
                $resolved = Join-Path $resolved "index.html"
            }

            if (Test-Path $resolved -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($resolved).ToLower()
                $ct = $mime[$ext]
                if (-not $ct) { $ct = "application/octet-stream" }
                $bytes = [System.IO.File]::ReadAllBytes($resolved)
                $res.ContentType = $ct
                $res.ContentLength64 = $bytes.Length
                $res.Headers["Cache-Control"] = "no-cache"
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host "[200] $path" -ForegroundColor Green
            } else {
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - $path nao encontrado")
                $res.StatusCode = 404
                $res.ContentType = "text/plain; charset=utf-8"
                $res.ContentLength64 = $msg.Length
                $res.OutputStream.Write($msg, 0, $msg.Length)
                Write-Host "[404] $path" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "[ERR] $($_.Exception.Message)" -ForegroundColor Red
            try { $res.StatusCode = 500 } catch {}
        } finally {
            try { $res.Close() } catch {}
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
