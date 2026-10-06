Option Explicit

' One-time, non-technical installer for the club computer.
Dim shell, fso, sourceRoot, installRoot, desktopPath, shortcut, targetVbs
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

sourceRoot = fso.GetParentFolderName(WScript.ScriptFullName)
installRoot = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\ESH Football Platform"
targetVbs = fso.BuildPath(installRoot, "Launch-ESH-Platform.vbs")

If LCase(fso.GetAbsolutePathName(sourceRoot)) <> LCase(fso.GetAbsolutePathName(installRoot)) Then
  If Not fso.FolderExists(installRoot) Then fso.CreateFolder installRoot
  fso.CopyFolder sourceRoot, installRoot, True
End If

If Not fso.FileExists(targetVbs) Then
  shell.Popup "تعذر تثبيت ملفات المنصة. تأكد من فك الضغط كاملًا ثم أعد المحاولة.", 8, "منصة النادي الرياضي", 16
  WScript.Quit 1
End If

desktopPath = shell.SpecialFolders("Desktop")
Set shortcut = shell.CreateShortcut(fso.BuildPath(desktopPath, "منصة النادي الرياضي.lnk"))
shortcut.TargetPath = shell.ExpandEnvironmentStrings("%WINDIR%\System32\wscript.exe")
shortcut.Arguments = """" & targetVbs & """"
shortcut.WorkingDirectory = installRoot
shortcut.IconLocation = fso.BuildPath(installRoot, "public\branding\esh-logo.ico")
shortcut.Description = "تشغيل منصة إدارة النادي"
shortcut.Save

shell.Popup "تم تثبيت المنصة بنجاح. استخدم اختصار «منصة النادي الرياضي» من سطح المكتب.", 6, "منصة النادي الرياضي", 64
shell.Run shortcut.TargetPath & " " & shortcut.Arguments, 0, False
