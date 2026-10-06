Option Explicit

Dim shell, fso, root, scriptPath, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
scriptPath = fso.BuildPath(root, "Setup-ESH-Local-AI.ps1")

If Not fso.FileExists(scriptPath) Then
  shell.Popup "The local AI setup file is missing.", 8, "ESH Football Platform", 16
  WScript.Quit 1
End If

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptPath & """"
shell.Run command, 1, True
If Err.Number = 0 Then shell.Popup "Local AI setup completed. You can now launch the platform.", 6, "ESH Football Platform", 64
