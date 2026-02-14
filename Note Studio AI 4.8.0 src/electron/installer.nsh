!macro customInstall
  WriteRegStr HKCR "Directory\shell\AINote" "" "Open folder on AI Note"
  WriteRegStr HKCR "Directory\shell\AINote" "Icon" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  WriteRegStr HKCR "Directory\shell\AINote\command" "" '"$INSTDIR\${PRODUCT_FILENAME}.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCR "Directory\shell\AINote"
!macroend