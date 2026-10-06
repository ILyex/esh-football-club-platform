Option Explicit

' Hidden one-click launcher: the administrator sees only the browser.
Dim shell, fso, root, batPath, serverPath, envPath, nodeCheck
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = fso.BuildPath(root, "Launch-ESH-Platform.bat")
serverPath = fso.BuildPath(root, ".next\standalone\server.js")
envPath = fso.BuildPath(root, ".env.local")
If Not fso.FileExists(envPath) Then envPath = fso.BuildPath(root, ".env")

If Not fso.FileExists(batPath) Then
  shell.Popup "ملف تشغيل المنصة غير موجود.", 5, "منصة النادي الرياضي", 16
  WScript.Quit 1
End If

' The administrator must never wait for npm or a production build. These
' checks keep the one-click shortcut limited to an already prepared package.
If Not fso.FileExists(serverPath) Then
  shell.Popup "نسخة التشغيل غير مجهزة بعد. يرجى تشغيل أداة التجهيز مرة واحدة بواسطة مسؤول التقنية.", 8, "منصة النادي الرياضي", 48
  WScript.Quit 1
End If

If Not fso.FileExists(envPath) Then
  shell.Popup "ملف إعدادات المنصة غير موجود. يرجى تجهيز ملف .env.local قبل التشغيل.", 8, "منصة النادي الرياضي", 48
  WScript.Quit 1
End If

nodeCheck = shell.Run("cmd.exe /c where node >nul 2>&1", 0, True)
If nodeCheck <> 0 Then
  shell.Popup "Node.js غير مثبت على هذا الجهاز. يرجى تجهيز الجهاز مرة واحدة بواسطة مسؤول التقنية.", 8, "منصة النادي الرياضي", 48
  WScript.Quit 1
End If

' WindowStyle 0 = hidden, WaitOnReturn False = leave the browser/server running.
shell.Run "cmd.exe /c """ & batPath & """", 0, False
