$ErrorActionPreference = "Stop"

$outputPath = Join-Path (Get-Location) "project-knowledge.txt"

$manualFiles = @(
  ".env.example",
  ".eslintrc.json",
  ".gitignore",
  "README.md",
  "package.json",
  "next.config.mjs",
  "postcss.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "next-env.d.ts",
  "docs/project-documentation.md",
  "docs/ai-advice-brief.md",
  "docs/architecture.md",
  "docs/database-schema.sql"
)

$codeFiles = @(rg --files src scripts)
$files = @($manualFiles + $codeFiles) |
  Where-Object { Test-Path $_ } |
  Where-Object { $_ -ne "project-knowledge.txt" } |
  Sort-Object -Unique

$header = @(
  "# AffiliateAutomationSystem - Project Knowledge Bundle",
  "",
  "Generated for AI Project Knowledge.",
  "Heavy, generated, binary, local data, sessions, database, build output, node_modules, and secrets are intentionally excluded.",
  "",
  "Excluded examples: node_modules, .git, .next, dist, out, data, package-lock.json, .env, SQLite files, Threads session/profile, video assets/exports.",
  "",
  "Included files:",
  ($files | ForEach-Object { "- $_" })
) -join "`r`n"

Set-Content -Path $outputPath -Value $header -Encoding UTF8

foreach ($file in $files) {
  Add-Content -Path $outputPath -Value ("`r`n`r`n===== FILE: $file =====`r`n") -Encoding UTF8
  Add-Content -Path $outputPath -Value (Get-Content -Raw -Encoding UTF8 $file) -Encoding UTF8
}

$bundle = Get-Item $outputPath
Write-Host "Created $($bundle.FullName)"
Write-Host "Size: $([Math]::Round($bundle.Length / 1KB, 1)) KB"
