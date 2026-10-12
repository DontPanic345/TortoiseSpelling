# Registers the Jogging run with Task Scheduler: four times a day, waking the PC,
# catching up after a missed start. Run once from PowerShell:
#   powershell -ExecutionPolicy Bypass -File jogging\install-task.ps1

$repo = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "jogging\jog.mjs run" -WorkingDirectory $repo
$triggers = '00:20', '06:20', '12:20', '18:20' | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 5) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'TortoiseSpelling Jogging' -Action $action -Trigger $triggers `
    -Settings $settings -Force
