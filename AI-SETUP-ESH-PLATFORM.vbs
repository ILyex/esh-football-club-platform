Option Explicit
Dim shell, fso, root, target
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
target = fso.BuildPath(root, ".platform\Setup-ESH-Local-AI.vbs")
If Not fso.FileExists(target) Then
  shell.Popup "Local AI setup files are missing from this package.", 8, "ESH Football Platform", 16
  WScript.Quit 1
End If
shell.Run "wscript.exe """ & target & """", 1, True
