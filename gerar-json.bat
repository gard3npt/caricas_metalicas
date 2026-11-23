@echo off
powershell -Command "Get-ChildItem -Path '.\caricas' -Recurse -Filter *.jpg | ForEach-Object { $_.BaseName } | Sort-Object | ConvertTo-Json | Set-Content caricas.json"
echo caricas.json atualizado!
pause