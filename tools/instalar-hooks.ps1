# ============================================================================
# LumiTEA — instala os hooks de git do projeto.
#
# Rode uma vez por clone (cada pessoa do grupo, em cada máquina):
#   powershell -ExecutionPolicy Bypass -File tools/instalar-hooks.ps1
#
# Hooks não são versionados pelo git, por isso precisam ser copiados à mão
# para dentro de .git/hooks/. É o que este script faz.
# ============================================================================

$raiz = Split-Path -Parent $PSScriptRoot
$origem = Join-Path $PSScriptRoot 'git-hooks'
$destino = Join-Path $raiz '.git\hooks'

if (-not (Test-Path $destino)) {
    Write-Host "Nao encontrei $destino. Rode este script de dentro do clone do repositorio." -ForegroundColor Red
    exit 1
}

Get-ChildItem -Path $origem -File | ForEach-Object {
    $alvo = Join-Path $destino $_.Name
    Copy-Item -Path $_.FullName -Destination $alvo -Force
    Write-Host "instalado: .git/hooks/$($_.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Pronto. O commit agora e bloqueado se houver chave de API nas mudancas." -ForegroundColor Cyan
Write-Host "Teste rapido: crie um arquivo com uma linha 'gsk_' + 30 caracteres e tente commitar."
