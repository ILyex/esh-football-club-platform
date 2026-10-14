Option Explicit

' Start the local health monitor without opening a PowerShell console at sign-in.
Dim shell, fso, root, supervisorPath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
supervisorPath = fso.BuildPath(root, "Start-Local-Platform-Supervisor.ps1")

If fso.FileExists(supervisorPath) Then
  shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & supervisorPath & """", 0, False
End If
