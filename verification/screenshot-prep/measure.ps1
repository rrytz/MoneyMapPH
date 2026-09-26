Add-Type -AssemblyName System.Drawing
$files = @(
  'C:\Users\RITZ\AppData\Local\Temp\opencode-browser-client-45cf2cc2-9d89-4b58-be76-ac1b950c2fcc\file_0d850ad7-5aa4-4c43-8571-b9ba2b93e3b8.png',
  'C:\Users\RITZ\AppData\Local\Temp\opencode-browser-client-45cf2cc2-9d89-4b58-be76-ac1b950c2fcc\file_56d4b1d9-3b03-4b81-b851-75e7cb36a4a2.png'
)
foreach ($f in $files) {
  if (Test-Path $f) {
    $img = [System.Drawing.Image]::FromFile($f)
    $size = "$($img.Width)x$($img.Height)"
    $img.Dispose()
    "$f => $size ($((Get-Item $f).Length) bytes)"
  } else {
    "MISSING: $f"
  }
}