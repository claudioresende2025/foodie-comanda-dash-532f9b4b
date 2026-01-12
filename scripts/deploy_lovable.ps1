<#
PowerShell deploy script for Lovable (Supabase production)
Usage (run in repo root):
  .\scripts\deploy_lovable.ps1 -ProjectRef zlwpxflqtyhdwanmupgy -DbUrl "postgresql://postgres:PASS@db.host.supabase.co:5432/postgres"

Notes:
- Requires `supabase` CLI installed and authenticated.
- You must provide a valid `DbUrl` (service role connection string) to run migrations.
- The script will deploy all functions under `supabase/functions` and execute .sql files under `supabase/migrations` in filename sort order.
- Do NOT store secrets in the repo. Use env vars or a protected secrets file.
#>
param(
  [Parameter(Mandatory=$true)] [string] $ProjectRef,
  [Parameter(Mandatory=$true)] [string] $DbUrl,
  [string] $FunctionsDir = "supabase/functions",
  [string] $MigrationsDir = "supabase/migrations",
  [switch] $DryRun
)

function Exec($cmd) {
  Write-Host ">" $cmd -ForegroundColor Cyan
  if (-not $DryRun) {
    $proc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -Command $cmd" -NoNewWindow -Wait -PassThru
    if ($proc.ExitCode -ne 0) { throw "Command failed: $cmd" }
  }
}

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Error "supabase CLI not found. Install it: https://supabase.com/docs/guides/cli"
  exit 1
}

Write-Host "Linking project $ProjectRef"
Exec "supabase link --project-ref $ProjectRef"

# Deploy functions
if (Test-Path $FunctionsDir) {
  Get-ChildItem -Path $FunctionsDir -Directory | ForEach-Object {
    $name = $_.Name
    Write-Host "Deploying function: $name"
    Exec "supabase functions deploy $name"
  }
} else { Write-Warning "$FunctionsDir not found" }

# Apply migrations
if (Test-Path $MigrationsDir) {
  $files = Get-ChildItem -Path $MigrationsDir -Filter '*.sql' | Sort-Object Name
  foreach ($f in $files) {
    Write-Host "Applying migration: $($f.Name)"
    $sql = Get-Content $f.FullName -Raw
    # Escape double quotes for passing as argument
    $esc = $sql.Replace('"','`"')
    Exec "supabase db query --db-url \"$DbUrl\" \"$esc\""
  }
} else { Write-Warning "$MigrationsDir not found" }

Write-Host "Deploy completed. Verify functions and database in Supabase Dashboard." -ForegroundColor Green
