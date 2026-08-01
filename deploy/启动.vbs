Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "http://127.0.0.1:8000"
WshShell.Run """DeviceManager.exe""", 0, False
