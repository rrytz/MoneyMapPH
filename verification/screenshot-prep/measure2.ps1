Add-Type -AssemblyName System.Drawing
$pairs = @(
  @{ id = 'file_0d850ad7-5aa4-4c43-8571-b9ba2b93e3b8'; label = 'mobileShot(390x844 requested)' },
  @{ id = 'file_56d4b1d9-3b03-4b81-b851-75e7cb36a4a2'; label = 'desktopShot(fullPage)' }
)
$srcDir = 'C:\Users\RITZ\AppData\Local\Temp\opencode-browser-client-45cf2cc2-9d89-4b58-be76-ac1b950c2fcc'
$tmp = 'C:\Users\RITZ\AppData\Local\Temp\opencode\shot-measure'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
foreach ($p in $pairs) {
  $src = Join-Path $srcDir $p.id
  if (Test-Path $src) {
    $dst = Join-Path $tmp ($p.id + '.png')
    Copy-Item $src $dst -Force
    $img = [System.Drawing.Image]::FromFile($dst)
    "$($p.label): dims=$($img.Width)x$($img.Height) bytes=$((Get-Item $dst).Length) magic=$(([System.Text.Encoding]::ASCII.GetString((Get-Content -Path $dst -Encoding Byte -TotalCount 8))))"
    $img.Dispose()
  } else { "$($p.label): MISSING" }
}