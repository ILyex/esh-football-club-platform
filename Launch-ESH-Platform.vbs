Option Explicit

' Hidden one-click launcher: the administrator sees only the browser.
Dim shell, fso, root, batPath, serverPath, envPath, nodePath, nodeCheck
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = fso.BuildPath(root, "Launch-ESH-Platform.bat")
serverPath = fso.BuildPath(root, ".next\standalone\server.js")
envPath = fso.BuildPath(root, ".env.local")
If Not fso.FileExists(envPath) Then envPath = fso.BuildPath(root, ".env")
nodePath = fso.BuildPath(root, "runtime\node.exe")

If Not fso.FileExists(batPath) Then
  shell.Popup "The platform launcher is missing.", 5, "ESH Football Platform", 16
  WScript.Quit 1
End If

' The administrator must never wait for npm or a production build. These
' checks keep the one-click shortcut limited to an already prepared package.
If Not fso.FileExists(serverPath) Then
  shell.Popup "The platform package is not prepared. Ask the technician to prepare it once.", 8, "ESH Football Platform", 48
  WScript.Quit 1
End If

If Not fso.FileExists(envPath) Then
  shell.Popup "The platform configuration file is missing. Ask the technician to prepare .env.local.", 8, "ESH Football Platform", 48
  WScript.Quit 1
End If

nodeCheck = 0
If Not fso.FileExists(nodePath) Then nodeCheck = shell.Run("cmd.exe /c where node >nul 2>&1", 0, True)
If nodeCheck <> 0 Then
  shell.Popup "The bundled runtime is missing. Ask the technician to prepare this computer once.", 8, "ESH Football Platform", 48
  WScript.Quit 1
End If

' WindowStyle 0 = hidden, WaitOnReturn False = leave the browser/server running.
shell.Run "cmd.exe /c """ & batPath & """", 0, False
