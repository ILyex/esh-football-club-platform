Option Explicit
Dim shell, fso, root, target
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
target = fso.BuildPath(root, ".platform\Install-ESH-Platform.vbs")
If Not fso.FileExists(target) Then
  shell.Popup "حزمة المنصة غير مكتملة. أعد فك الضغط كاملًا.", 8, "منصة النادي الرياضي", 16
  WScript.Quit 1
End If
shell.Run "wscript.exe """ & target & """", 1, True
