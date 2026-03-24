; Custom NSIS uninstall hook — offers to remove user data on uninstall.
; electron-builder automatically includes this file when present at electron/installer.nsh.

!macro customUnInstall
  MessageBox MB_YESNO "Remove Mission Control data (settings, logs, encrypted keys)?$\nThis cannot be undone." /SD IDNO IDYES _removeData IDNO _keepData

  _removeData:
    RMDir /r "$APPDATA\MissionControl"
    Goto _done

  _keepData:
    ; User data preserved

  _done:
!macroend
