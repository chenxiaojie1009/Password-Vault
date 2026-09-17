' Device Manager launcher (ASCII only: wscript reads .vbs as ANSI without BOM)
' Desktop always opens plain HTTP on the loopback port; LAN/phone uses HTTPS.
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

port = WshShell.ExpandEnvironmentStrings("%DM_PORT%")
If port = "%DM_PORT%" Then port = "8000"

WshShell.Run "http://127.0.0.1:" & port
WshShell.Run """" & scriptDir & "\DeviceManager.exe""", 0, False
