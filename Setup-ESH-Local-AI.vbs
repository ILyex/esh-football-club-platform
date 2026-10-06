Option Explicit

Dim shell, fso, root, scriptPath, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
scriptPath = fso.BuildPath(root, "Setup-ESH-Local-AI.ps1")

If Not fso.FileExists(scriptPath) Then
  shell.Popup "ملف تجهيز الذكاء المحلي غير موجود.", 8, "منصة النادي الرياضي", 16
  WScript.Quit 1
End If

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptPath & """"
shell.Run command, 1, True
If Err.Number = 0 Then shell.Popup "اكتمل تجهيز الذكاء المحلي. يمكنك الآن تشغيل المنصة من الأيقونة.", 6, "منصة النادي الرياضي", 64
