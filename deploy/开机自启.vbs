' 设备管理器 - 开机自启守护脚本
' 将此文件快捷方式放入 shell:startup 即可开机自动运行

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 先启动主服务
WshShell.Run """" & scriptDir & "\DeviceManager.exe" & """", 0, False

' 等待 5 秒
WScript.Sleep 5000

' 启动浏览器
WshShell.Run "cmd /c start http://127.0.0.1:8000", 0, False

' 持续守护：每 30 秒检测一次，挂了就重启
Do While True
    WScript.Sleep 30000
    Set wmi = GetObject("winmgmts:\\.\root\cimv2")
    Set procs = wmi.ExecQuery("SELECT Name FROM Win32_Process WHERE Name='DeviceManager.exe'")
    If procs.Count = 0 Then
        WshShell.Run """" & scriptDir & "\DeviceManager.exe" & """", 0, False
    End If
Loop
