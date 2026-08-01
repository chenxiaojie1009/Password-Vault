# 设备管理器 - 守护脚本
# 每 30 秒检测一次，服务未运行则自动启动

$exePath = Join-Path $PSScriptRoot "DeviceManager.exe"
$logFile = Join-Path $PSScriptRoot "watchdog.log"

function Write-Log($msg) {
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$time $msg" | Out-File $logFile -Append -Encoding utf8
}

Write-Log "Watchdog started, watching: $exePath"

while ($true) {
    $running = Get-Process -Name "DeviceManager" -ErrorAction SilentlyContinue
    
    if (-not $running) {
        Write-Log "Service not running, starting..."
        try {
            Start-Process $exePath -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
            Write-Log "Service started"
        } catch {
            Write-Log "Failed to start: $_"
        }
    }
    
    Start-Sleep -Seconds 30
}
