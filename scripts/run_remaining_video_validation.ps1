param(
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [Parameter(Mandatory=$true)][string]$SessionId,
  [string]$SkipModels = ''
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$cookie = "huiju_session=$SessionId"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputDir = Join-Path 'test-results' "live-video-validation-curl-$stamp"
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

function Upload-Media {
  param([string]$Path, [string]$ContentType)
  $part = "media=@$((Resolve-Path -LiteralPath $Path).Path);type=$ContentType"
  $raw = & curl.exe --http1.1 --fail --silent --show-error --max-time 90 -H "Cookie: $cookie" -F $part "$base/api/v1/media/uploads"
  if ($LASTEXITCODE -ne 0) { throw 'media_upload_failed' }
  return $raw | ConvertFrom-Json
}

function Wait-Video {
  param([string]$JobId)
  for ($attempt = 1; $attempt -le 120; $attempt++) {
    Start-Sleep -Seconds 5
    $result = Invoke-Json -Method 'GET' -Path "/api/v1/videos/jobs/$JobId"
    if ($result.status -in @('completed', 'failed', 'cancelled')) { return $result }
  }
  throw 'video_validation_timeout'
}

function Save-Video {
  param([string]$Url, [string]$Name)
  $path = Join-Path $outputDir "$Name.mp4"
  & curl.exe --http1.1 --fail --silent --show-error --max-time 180 -H "Cookie: $cookie" -o $path "$base$Url"
  if ($LASTEXITCODE -ne 0) { throw 'video_artifact_download_failed' }
  return $path
}

function Run-Video {
  param([string]$Model, [string]$Operation, [string]$Prompt, [string[]]$UploadIds, [string]$Resolution, [int]$Duration, [int]$StyleId = 0, [bool]$RightsConfirmed = $false)
  if ($SkipModels.Split(',', [System.StringSplitOptions]::RemoveEmptyEntries) -contains $Model) {
    Write-Output "skipped video $Model $Operation"
    return
  }
  $row = [ordered]@{ kind='video'; model=$Model; operation=$Operation; status='submitted' }
  $report.tests += $row
  Save-Report
  try {
    $payload = [ordered]@{ model=$Model; operation=$Operation; prompt=$Prompt; upload_ids=$UploadIds; ratio='16:9'; resolution=$Resolution; duration=$Duration; style_id=$StyleId; rights_confirmed=$RightsConfirmed } | ConvertTo-Json -Compress
    $safeModel = $Model -replace '[^A-Za-z0-9_-]', '-'
    $job = Invoke-Json -Method 'POST' -Path '/api/v1/videos/generations' -Body $payload -IdempotencyKey "curl-video-$safeModel-$stamp"
    $row.job_id = $job.request_id
    Save-Report
    $result = Wait-Video -JobId $job.request_id
    $row.provider_status = $result.provider_status
    if ($result.status -ne 'completed') { throw ($result.error ?? $result.status) }
    $row.charged_credits = $result.charged_credits
    $row.artifact = Save-Video -Url $result.url -Name "video-$safeModel"
    $row.status = 'passed'
  } catch {
    $row.status = 'failed'
    $row.error = $_.Exception.Message
    $stopAfterRow = $row.error -like 'request_failed:/api/v1/videos/jobs/*'
  }
  Save-Report
  Write-Output "$($row.status) video $Model $Operation"
  if ($stopAfterRow) { throw $row.error }
}

$product = Upload-Image -Path 'test-results/live-model-validation-2026-09-04T07-38-44-171Z/image-qwen_image-1.jpg' -ContentType 'image/jpeg'
$sourcePortrait = Upload-Image -Path 'frontend/static/showcase/v167/plaza/red-dancer.webp' -ContentType 'image/webp'
$replacementPortrait = Upload-Image -Path 'test-results/live-model-validation-continued-2026-09-04T08-12-40-743Z/replacement-portrait.jpg' -ContentType 'image/jpeg'
$sourceVideo = Upload-Media -Path 'frontend/static/showcase/v167/plaza/ocean-cliff-motion.mp4' -ContentType 'video/mp4'
$portraitVideo = Upload-Media -Path 'test-results/live-video-validation-2026-09-04T08-20-25-509Z/video-wan2.7-i2v-2026-04-25.mp4' -ContentType 'video/mp4'
$sourceAudio = Upload-Media -Path 'test-results/live-model-validation-continued-2026-09-04T08-12-40-743Z/audio-qwen3-tts-flash.bin' -ContentType 'audio/x-wav'

Run-Video -Model 'seedance_2_0' -Operation 'reference_to_video' -Prompt '参考输入视频的海岸悬崖、海浪和电影机位，生成镜头缓慢向前推进的自然风景视频。' -UploadIds @($sourceVideo.upload_id) -Resolution '720P' -Duration 4
Run-Video -Model 'seedance_2_0_mini' -Operation 'reference_to_video' -Prompt '参考产品图的主体与构图，生成短促稳定的产品展示镜头，光线自然变化。' -UploadIds @($product.upload_id) -Resolution '720P' -Duration 4
Run-Video -Model 'seedance_2_0_fast' -Operation 'reference_to_video' -Prompt '参考人物肖像，生成轻微转头、眨眼和呼吸的自然人物短片，背景保持简洁。' -UploadIds @($sourcePortrait.upload_id) -Resolution '720P' -Duration 4
Run-Video -Model 'seedance_2_5' -Operation 'reference_to_video' -Prompt '参考输入视频的海岸悬崖场景，生成连贯的航拍式前推进镜头，海浪和薄雾具有真实运动。' -UploadIds @($sourceVideo.upload_id) -Resolution '720P' -Duration 4
Run-Video -Model 'wan2.7-videoedit' -Operation 'video_edit' -Prompt '保留悬崖和海面运动，将整体调色改为日落金色时刻，阴影保留细节。' -UploadIds @($sourceVideo.upload_id) -Resolution '720P' -Duration 2
Run-Video -Model 'wanx2.1-vace-plus' -Operation 'video_extension' -Prompt '从原视频末尾自然延展五秒：镜头继续平稳前进，海浪运动连续，悬崖轮廓不跳变。' -UploadIds @($sourceVideo.upload_id) -Resolution '720P' -Duration 5
Run-Video -Model 'video-style-transform' -Operation 'video_style' -Prompt '将原视频转为细腻水彩插画风格，保留镜头运动、海岸结构和时间连续性。' -UploadIds @($sourceVideo.upload_id) -Resolution '480P' -Duration 2 -StyleId 3
Run-Video -Model 'videoretalk' -Operation 'lip_sync' -Prompt '让输入视频中的人物与普通话音频自然同步口型，保持面部身份和背景稳定。' -UploadIds @($portraitVideo.upload_id, $sourceAudio.upload_id) -Resolution '480P' -Duration 2
Run-Video -Model 'wan2.2-animate-mix' -Operation 'character_swap_video' -Prompt '将输入视频中的人物替换为参考肖像人物，保持原视频动作、镜头和服装运动节奏。' -UploadIds @($portraitVideo.upload_id, $replacementPortrait.upload_id) -Resolution '480P' -Duration 2 -RightsConfirmed $true
Run-Video -Model 'wan2.2-s2v' -Operation 'digital_human' -Prompt '让参考肖像以自然站姿完成品牌旁白，口型与中文音频同步，表情克制专业。' -UploadIds @($replacementPortrait.upload_id, $sourceAudio.upload_id) -Resolution '480P' -Duration 2

$report.finished_at = (Get-Date).ToUniversalTime().ToString('o')
$report.summary = @{}
foreach ($item in $report.tests) { $report.summary[$item.status] = 1 + [int]($report.summary[$item.status] ?? 0) }
Save-Report
$report.summary | ConvertTo-Json -Compress
