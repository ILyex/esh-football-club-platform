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
  ' Copy the package contents into the destination. CopyFolder(sourceRoot,
  ' installRoot) would create installRoot\.platform and break the launcher.
  Dim sourceFolder, entry, destination, copyExit
  Set sourceFolder = fso.GetFolder(sourceRoot)
  For Each entry In sourceFolder.Files
    destination = fso.BuildPath(installRoot, entry.Name)
    fso.CopyFile entry.Path, destination, True
  Next
  For Each entry In sourceFolder.SubFolders
    destination = fso.BuildPath(installRoot, entry.Name)
    If Not fso.FolderExists(destination) Then fso.CreateFolder destination
    copyExit = shell.Run("robocopy.exe """ & entry.Path & """ """ & destination & """ /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS", 0, True)
    If copyExit > 7 Then
      shell.Popup "Platform files could not be copied. Extract the package to a local folder and try again.", 8, "ESH Football Platform", 16
      WScript.Quit 1
    End If
  Next
End If

If Not fso.FileExists(targetVbs) Then
  shell.Popup "Installation files are incomplete. Extract the full package and try again.", 8, "ESH Football Platform", 16
  WScript.Quit 1
End If

desktopPath = shell.SpecialFolders("Desktop")
Set shortcut = shell.CreateShortcut(fso.BuildPath(desktopPath, "ESH Football Platform.lnk"))
shortcut.TargetPath = shell.ExpandEnvironmentStrings("%WINDIR%\System32\wscript.exe")
shortcut.Arguments = """" & targetVbs & """"
shortcut.WorkingDirectory = installRoot
Dim iconPath
iconPath = fso.BuildPath(installRoot, ".next\standalone\public\branding\esh-logo.ico")
If Not fso.FileExists(iconPath) Then iconPath = fso.BuildPath(installRoot, "public\branding\esh-logo.ico")
If fso.FileExists(iconPath) Then shortcut.IconLocation = iconPath
shortcut.Description = "Launch ESH Football Platform"
shortcut.Save

shell.Popup "Installation completed. Use the ESH Football Platform shortcut on the desktop.", 6, "ESH Football Platform", 64
shell.Run shortcut.TargetPath & " " & shortcut.Arguments, 0, False
