@echo off
setlocal
set "URL=https://samadalam481470sa-cmd.github.io/sammyyyy/"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" (
  echo Microsoft Edge is required to install Newport CRM.
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Newport CRM.lnk'); $s.TargetPath='%EDGE%'; $s.Arguments='--app=%URL%'; $s.Description='Newport CRM'; $s.Save()"
start "" "%EDGE%" --app="%URL%"
