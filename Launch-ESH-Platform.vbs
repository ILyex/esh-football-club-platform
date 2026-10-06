Option Explicit

' Hidden one-click launcher: the administrator sees only the browser.
Dim shell, fso, root, batPath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = fso.BuildPath(root, "Launch-ESH-Platform.bat")

If Not fso.FileExists(batPath) Then
  shell.Popup "ملف تشغيل المنصة غير موجود.", 5, "منصة النادي الرياضي", 16
  WScript.Quit 1
End If

' WindowStyle 0 = hidden, WaitOnReturn False = leave the browser/server running.
shell.Run "cmd.exe /c """ & batPath & """", 0, False
