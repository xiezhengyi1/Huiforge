param(
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [Parameter(Mandatory=$true)][string]$SessionId
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$cookie = "huiju_session=$SessionId"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputDir = Join-Path 'test-results' "seedream5-validation-$stamp"
New-Item -ItemType Directory -Path $outputDir | Out-Null
$report = [ordered]@{ started_at=(Get-Date).ToUniversalTime().ToString('o'); base_url=$base; tests=@() }

function Save-Report {
  $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputDir 'report.json') -Encoding utf8
}

function Invoke-Json {
  param([string]$Method, [string]$Path, [string]$Body = '', [string]$IdempotencyKey = '')
  $arguments = @('--http1.1', '--fail', '--silent', '--show-error', '--max-time', '90', '-H', "Cookie: $cookie")
  if ($Method -eq 'POST') {
    $arguments += @('-X', 'POST', '-H', 'Content-Type: application/json', '-H', "Idempotency-Key: $IdempotencyKey", '--data', $Body)
  }
  $arguments += "$base$Path"
  $raw = & curl.exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "request_failed:$Path" }
  return $raw | ConvertFrom-Json
}

function Upload-Image {
  param([string]$Path, [string]$ContentType)
  $part = "image=@$((Resolve-Path -LiteralPath $Path).Path);type=$ContentType"
  $raw = & curl.exe --http1.1 --fail --silent --show-error --max-time 90 -H "Cookie: $cookie" -F $part "$base/api/v1/images/uploads"
  if ($LASTEXITCODE -ne 0) { throw 'image_upload_failed' }
  return $raw | ConvertFrom-Json
}

function Wait-Image {
  param([string]$JobId)
  for ($attempt = 1; $attempt -le 120; $attempt++) {
    Start-Sleep -Seconds 5
    $result = Invoke-Json -Method 'GET' -Path "/api/v1/images/jobs/$JobId"
    if ($result.status -in @('completed', 'failed', 'cancelled')) { return $result }
  }
  throw 'image_validation_timeout'
}

function Save-Images {
  param($Images, [string]$Name)
  $artifacts = @()
  $index = 0
  foreach ($image in $Images) {
    $index++
    $path = Join-Path $outputDir "$Name-$index.png"
    & curl.exe --http1.1 --fail --silent --show-error --max-time 180 -H "Cookie: $cookie" -o $path "$base$($image.url)"
    if ($LASTEXITCODE -ne 0) { throw 'image_artifact_download_failed' }
    $artifacts += $path
  }
  return $artifacts
}

function Run-ImageTest {
  param([string]$Name, [hashtable]$Payload)
  $row = [ordered]@{ kind='image'; model='seedream_5_0'; operation=$Name; status='submitted' }
  $report.tests += $row
  Save-Report
  try {
    $job = Invoke-Json -Method 'POST' -Path '/api/v1/images/generations' -Body ($Payload | ConvertTo-Json -Compress) -IdempotencyKey "seedream5-image-$stamp"
    $row.job_id = $job.request_id
    $result = Wait-Image -JobId $job.request_id
    if ($result.status -ne 'completed') { throw $result.status }
    $row.image_count = $result.images.Count
    $row.artifacts = Save-Images -Images $result.images -Name $Name
    $row.status = 'passed'
  } catch {
    $row.status = 'failed'
    $row.error = $_.Exception.Message
  }
  Save-Report
  Write-Output "$($row.status) image $Name"
}

function Run-ToolTest {
  param([string]$UploadId)
  $row = [ordered]@{ kind='image_tool'; model='seedream_5_0'; operation='multiview'; status='submitted' }
  $report.tests += $row
  Save-Report
  try {
    $payload = [ordered]@{ model='seedream_5_0'; upload_id=$UploadId; resolution='720p'; quality='standard'; views=3; annotations=@(); operation='multiview'; prompt='生成同一白色陶瓷茶罐的正面、左侧 45 度和俯视三视角产品展示，材质、标签位置与光线保持一致。' } | ConvertTo-Json -Compress
    $job = Invoke-Json -Method 'POST' -Path '/api/v1/images/tools' -Body $payload -IdempotencyKey "seedream5-tool-$stamp"
    $row.job_id = $job.request_id
    $result = Wait-Image -JobId $job.request_id
    if ($result.status -ne 'completed') { throw $result.status }
    $row.image_count = $result.images.Count
    $row.artifacts = Save-Images -Images $result.images -Name 'multiview'
    $row.status = 'passed'
  } catch {
    $row.status = 'failed'
    $row.error = $_.Exception.Message
  }
  Save-Report
  Write-Output "$($row.status) image_tool multiview"
}

$source = Upload-Image -Path 'test-results/live-model-validation-2026-09-04T07-38-44-171Z/image-qwen_image-1.jpg' -ContentType 'image/jpeg'
Run-ImageTest -Name 'text_to_image' -Payload @{ model='seedream_5_0'; prompt='一张无品牌精品茶叶的电商主视觉：白色陶瓷茶罐置于浅色胡桃木桌面，窗边晨光从左侧照入，罐旁有三片新鲜茶叶，留出右上角干净留白，写实产品摄影，画面无水印、无商标。'; aspect_ratio='4:5'; quality='standard'; resolution='720p'; style='editorial'; count=1; output_mode='independent' }
Run-ToolTest -UploadId $source.upload_id
$report.finished_at = (Get-Date).ToUniversalTime().ToString('o')
Save-Report
