<#
  Deploys the fruit counter (vision-service) to Google Cloud Run, with the trained models.

  Before the first run, once:
    1. A Google Cloud project with billing turned on (set a budget alert in the console).
    2. gcloud auth login

  Run:
    powershell -File scripts\deploy-counter-cloudrun.ps1 -Project YOUR_PROJECT_ID -EnvFile C:\path\2-fruit-counter.env
    (-Region defaults to africa-south1, Johannesburg; -Service defaults to cropmanager-counter)

  The env file holds FRUIT_COUNTER_TOKEN and HF_TOKEN (a read token of the account that owns the private model repo).
  They are stored in Secret Manager, never in the image or the repository. The script prints the address to put in
  FRUIT_COUNTER_URL on the CropManager server.
#>
param(
  [Parameter(Mandatory = $true)][string]$Project,
  [Parameter(Mandatory = $true)][string]$EnvFile,
  [string]$Region = 'africa-south1',
  [string]$Service = 'cropmanager-counter',
  [string]$ModelRepo = 'enockstack/greenhouse-fruit-yolo11x'
)
$ErrorActionPreference = 'Stop'
$gcloud = (Get-Command gcloud -ErrorAction SilentlyContinue).Source
if (-not $gcloud) { $gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" }
function G { & $gcloud @args; if ($LASTEXITCODE -ne 0) { throw "gcloud failed: $($args -join ' ')" } }

$vals = @{}
Get-Content $EnvFile | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { $k, $v = $_ -split '=', 2; $vals[$k] = $v }
foreach ($k in 'FRUIT_COUNTER_TOKEN', 'HF_TOKEN') { if (-not $vals[$k]) { throw "$k is missing from $EnvFile" } }

if (-not (& $gcloud auth list --filter=status:ACTIVE --format='value(account)')) { throw 'Not signed in. Run: gcloud auth login' }
G config set project $Project

Write-Host '1/6 Turning on the Google services the counter needs'
G services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

Write-Host '2/6 Creating the private image store'
& $gcloud artifacts repositories describe counter --location $Region *> $null
if ($LASTEXITCODE -ne 0) { G artifacts repositories create counter --repository-format=docker --location $Region --description 'CropManager fruit counter' }

Write-Host '3/6 Saving the secrets in Secret Manager'
foreach ($name in 'FRUIT_COUNTER_TOKEN', 'HF_TOKEN') {
  $secret = "cm-$($name.ToLower().Replace('_','-'))"
  $tmp = New-TemporaryFile
  try {
    [IO.File]::WriteAllText($tmp, $vals[$name])
    & $gcloud secrets describe $secret *> $null
    if ($LASTEXITCODE -ne 0) { G secrets create $secret --data-file=$tmp --replication-policy=automatic } else { G secrets versions add $secret --data-file=$tmp }
  } finally { Remove-Item $tmp -Force }
}
$number = (& $gcloud projects describe $Project --format='value(projectNumber)')
$runner = "$number-compute@developer.gserviceaccount.com"
foreach ($secret in 'cm-fruit-counter-token', 'cm-hf-token') {
  G secrets add-iam-policy-binding $secret --member "serviceAccount:$runner" --role roles/secretmanager.secretAccessor | Out-Null
}
G projects add-iam-policy-binding $Project --member "serviceAccount:$runner" --role roles/cloudbuild.builds.builder | Out-Null

Write-Host '4/6 Building the counter with the trained models (about 10 minutes the first time)'
$image = "$Region-docker.pkg.dev/$Project/counter/$Service`:latest"
Push-Location (Join-Path $PSScriptRoot '..\vision-service')
try { G builds submit . --config cloudbuild.yaml --substitutions "_IMAGE=$image" } finally { Pop-Location }

Write-Host '5/6 Starting the service'
G run deploy $Service --image $image --region $Region --platform managed `
  --cpu 2 --memory 4Gi --cpu-boost --min-instances 0 --max-instances 3 --concurrency 4 --timeout 300 `
  --allow-unauthenticated `
  --set-env-vars "FRUIT_YOLO_HF_REPO=$ModelRepo,FRUIT_YOLO_CONF=0.30,FRUIT_YOLO_IOU=0.50,FRUIT_YOLO_IMGSZ=800,FRUIT_YOLO_MIN_MAP=0.35" `
  --set-secrets 'FRUIT_COUNTER_TOKEN=cm-fruit-counter-token:latest,HF_TOKEN=cm-hf-token:latest'

Write-Host '6/6 Checking it'
$url = (& $gcloud run services describe $Service --region $Region --format='value(status.url)')
Write-Host "Address: $url"
try {
  $h = Invoke-RestMethod "$url/health" -TimeoutSec 180
  Write-Host ("health: " + ($h | ConvertTo-Json -Compress -Depth 4))
} catch { Write-Warning "The health check did not answer yet: $($_.Exception.Message). Open $url/health in a browser in a minute." }
Write-Host ''
Write-Host "Put this on the CropManager server:  FRUIT_COUNTER_URL=$url"
Write-Host "and keep FRUIT_COUNTER_TOKEN the same as in $EnvFile"
