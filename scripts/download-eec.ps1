$ErrorActionPreference = 'Stop'
$source = [uri]'https://eec.eaeunion.org/comission/department/catr/ett/'
$output = Join-Path (Split-Path $PSScriptRoot -Parent) '.tnved-source'
$page = Invoke-WebRequest -UseBasicParsing -Uri $source -TimeoutSec 30
$groups = @{}
foreach ($link in $page.Links) {
    $url = [uri]::new($source, $link.href)
    if ($url.Scheme -ne 'https' -or $url.Host -ne $source.Host) { continue }
    if ($url.AbsolutePath -notmatch '/ru\.(\d{2})[_\-.][^/]*\.pdf$') { continue }
    $number = $Matches[1]
    if ($groups.ContainsKey($number) -and $groups[$number] -ne $url.AbsoluteUri) {
        throw "Duplicate official files for group $number"
    }
    $groups[$number] = $url.AbsoluteUri
}
if ($groups.Count -lt 90) { throw "Only $($groups.Count) group links found. Check the official index before proceeding." }
New-Item -ItemType Directory -Force -Path $output | Out-Null
$manifest = foreach ($number in ($groups.Keys | Sort-Object)) {
    $file = Join-Path $output "$number.pdf"
    Invoke-WebRequest -UseBasicParsing -Uri $groups[$number] -OutFile $file -TimeoutSec 45
    $stream = [IO.File]::OpenRead($file)
    try {
        $signature = [byte[]]::new(5)
        if ($stream.Read($signature,0,5) -ne 5 -or [Text.Encoding]::ASCII.GetString($signature) -ne '%PDF-') {
            throw "Group $number response is not a PDF"
        }
    } finally { $stream.Dispose() }
    [pscustomobject]@{ group=$number; file="$number.pdf"; source=$groups[$number]; sha256=(Get-FileHash -LiteralPath $file).Hash.ToLowerInvariant() }
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $output 'manifest.json')
Write-Output "Downloaded $($groups.Count) official group PDFs."
