!macro customUnInstall
  ; Clean up model files and user data on uninstall
  RMDir /r "$APPDATA\TingMo"
!macroend
