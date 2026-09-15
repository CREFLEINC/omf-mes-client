; POP 설치본의 **기본 설치 경로**(#1145).
;
; electron-builder 의 NSIS 대상에는 기본 경로를 정하는 설정 항목이 없다. 설치기가 경로를
; 정하기 «전»에 레지스트리의 설치 위치를 미리 적어 두면, 그 값이 그대로 기본값이 된다 —
; 공식 문서가 안내하는 방법이다.
;
; ⚠ **막는 것이 아니라 채워 두는 것이다.** `allowToChangeInstallationDirectory` 는 켜 둔
;   그대로라 설치 담당자가 그 자리에서 다른 경로로 바꿀 수 있다. 단말 구성이 다른 현장이
;   있으므로 기본값 하나로 못박지 않는다.
;
; ⚠ **32비트·64비트 양쪽에 적는다.** 설치기가 어느 쪽 레지스트리를 보는지는 빌드 대상과
;   OS 조합이 정하므로, 한쪽만 적으면 조용히 예전 기본값으로 돌아간다.
!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Users\Crefle\OMF-MES POP"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Users\Crefle\OMF-MES POP"
  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Users\Crefle\OMF-MES POP"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Users\Crefle\OMF-MES POP"
!macroend

; 설치·삭제 전에 **켜져 있는 POP 을 강제로 끈다**(사용자 지시 2026-09-15).
;
; ⭐ **왜 기본 동작을 갈아 끼우는가.** electron-builder 는 먼저 «창 닫기»로 끄기를 청하는데,
;   POP 은 키오스크 잠금으로 창 닫기를 막는다(`src/main/index.ts` 의 `close` 막기). 실기에서
;   「OMF-MES POP cannot be closed」가 떠 기존 앱을 손으로 지워야 했다(실기 2026-09-15).
;
; ⚠ **처음부터 강제 종료한다.** 정상 종료를 기다려도 잠금이 막으므로 얻는 것이 없다. 미전송
;   대기열은 쓸 때마다 디스크에 내리므로(`outbox:enqueue`) 강제 종료로 잃지 않는다.
; ⚠ **이미지 이름으로 모든 사용자의 것을 끈다.** 설치 경로·사용자로 거르면 다른 계정이 띄운
;   키오스크 앱이나 옛 경로의 앱을 놓친다.
; ⛔ 끝내 못 끄면(권한 없음 등) 기본과 같은 재시도 창을 띄운다 — 켜진 채로 파일을 덮지 않는다.
!macro popCloseRunningApp
  StrCpy $R1 0
  popKillLoop:
    nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    Sleep 1500
    nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
    Pop $R0
    StrCmp $R0 0 0 popKillDone
    IntOp $R1 $R1 + 1
    IntCmp $R1 5 0 popKillLoop 0
    ; ⭐ 못 끈 «이유»를 창에 싣는다 — 같은 문구의 창을 옛 삭제기도 띄워 어느 쪽인지 가를 수
    ;   없었다(실기 2026-09-15). 「[POP 설치기]」 머리가 붙어 있으면 이 코드의 창이다.
    nsExec::ExecToStack `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    Pop $R2
    nsExec::ExecToStack `"$SYSDIR\cmd.exe" /C tasklist /V /FO LIST /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    Pop $R3
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "[POP 설치기] $(appCannotBeClosed)$\r$\n$\r$\n강제 종료 결과:$\r$\n$R2$\r$\n남은 프로세스:$\r$\n$R3" /SD IDCANCEL IDRETRY popKillLoop
    Quit
  popKillDone:
!macroend

; 기본 검사 자리 — 설치 절차 첫머리와 삭제기(`Uninstall OMF-MES POP.exe`)가 부른다.
!macro customCheckAppRunning
  !insertmacro popCloseRunningApp
!macroend

; ⭐ **설치 진행 화면 바로 앞에서 앱을 끄고, 옛 판을 «우리가» 먼저 지운다.**
;
; ## 왜 (실기 2026-09-15 · 세 번째 판에서 가렸다)
;
; 「OMF-MES POP cannot be closed」는 앱 검사가 띄운 창이 아니었다. electron-builder 설치기는
;   «이전에 설치된 판의 삭제기»를 `--updated` 로 부르고(`installUtil.nsh` 의 `uninstallOldVersion`),
;   그 삭제기가 설치 폴더의 파일을 하나라도 옮기지 못하면 실패 코드로 끝난다. 설치기는 다섯 번
;   다시 부른 뒤 **같은 문구의 창**을 띄운다 — 문구와 달리 앱이 켜져 있어서가 아니다.
;   (근거: 앞 판에 넣은 「[POP 설치기]」 머리가 창에 없었다. 어느 파일이 막혔는지는 아직 모른다.)
;
; ## 무엇을 하는가
;
; 1. 앱을 강제로 끈다(`popCloseRunningApp`).
; 2. 옛 삭제기를 **임시 폴더로 복사해** 같은 인자로 한 번 부른다. 성공하면 설치기가 지울 것이 남지 않는다.
;    ⛔ 제자리에서 부르지 않는다 — 옛 삭제기의 앱 검사는 «설치 폴더에서 도는 프로세스»를 전부
;       끄는데 자기 자신을 빼지 않아, 제자리 실행이면 스스로를 끄고 실패 코드로 끝난다(리뷰 지적 ·
;       electron-builder 도 같은 이유로 `$PLUGINSDIR` 에 복사해 부른다, `installUtil.nsh`).
; 3. 실패하면 **옛 판의 삭제 등록을 걷어** 설치기가 옛 삭제기를 다시 부르지 않게 한다 — 새 판은 같은
;    폴더에 덮어 설치된다. 막힌 파일이 정말 쓰기 중이면 그때 NSIS 가 **그 파일 이름**을 댄다.
;    결과는 `C:\ProgramData\OMF-MES POP\install.log` 에 남긴다.
;
; ⛔ 옛 폴더를 `RMDir /r` 로 지우지 않는다 — 경로가 레지스트리에서 오고, 틀리면 남의 파일이 지워진다.
; ⚠ 보이지 않는 페이지로 돌리고 곧바로 넘긴다 — 페이지와 설치 절차는 같은 설치기 안에서 돈다.
!macro customPageAfterChangeDir
  Page custom popPrepareInstall
  Function popPrepareInstall
    !insertmacro popCloseRunningApp

    Push $0
    Push $R4
    Push $R5
    Push $R6
    Push $R7
    Push $R8
    Push $R9
    ReadRegStr $R4 HKLM "${UNINSTALL_REGISTRY_KEY}" UninstallString
    ReadRegStr $R5 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
    StrCmp $R4 "" popPrepareDone

    ; `"<삭제기 경로>" <인자>` 에서 경로($R7)와 인자($R9)를 가른다. 따옴표가 없으면 통째로 경로다.
    StrCpy $R7 $R4
    StrCpy $R9 ""
    StrCpy $R8 $R4 1
    StrCmp $R8 '"' 0 popSplitDone
    StrCpy $R6 1
    popSplitLoop:
      StrCpy $R8 $R4 1 $R6
      StrCmp $R8 "" popSplitDone
      StrCmp $R8 '"' popSplitFound
      IntOp $R6 $R6 + 1
      Goto popSplitLoop
    popSplitFound:
      IntOp $R8 $R6 - 1
      StrCpy $R7 $R4 $R8 1
      IntOp $R6 $R6 + 1
      StrCpy $R9 $R4 "" $R6
    popSplitDone:

    InitPluginsDir
    ClearErrors
    CopyFiles /SILENT /FILESONLY "$R7" "$PLUGINSDIR\pop-old-uninstaller.exe"
    IfErrors 0 popRunCopy
      StrCpy $R6 "copy-failed"
      Goto popPrepareLog
    popRunCopy:
    ClearErrors
    ExecWait '"$PLUGINSDIR\pop-old-uninstaller.exe"$R9 /S /KEEP_APP_DATA --updated _?=$R5' $R6
    IfErrors 0 +2
      StrCpy $R6 "not-launched"

    popPrepareLog:

    SetShellVarContext all
    CreateDirectory "$APPDATA\OMF-MES POP"
    FileOpen $0 "$APPDATA\OMF-MES POP\install.log" a
    FileSeek $0 0 END
    ; ⚠ 영문으로 적는다 — FileWrite 는 ANSI 라 한글이 단말 코드페이지에 따라 깨진다.
    FileWrite $0 "old uninstaller=$R4 dir=$R5 exit=$R6$\r$\n"

    StrCmp $R6 0 popPrepareClosed
    ; 실패 — 설치기가 옛 삭제기를 다시 부르지 않게 등록을 걷는다. 새 판이 설치를 마치면 다시 적힌다.
    DeleteRegValue HKLM "${UNINSTALL_REGISTRY_KEY}" UninstallString
    DeleteRegValue HKCU "${UNINSTALL_REGISTRY_KEY}" UninstallString
    !ifdef UNINSTALL_REGISTRY_KEY_2
      DeleteRegValue HKLM "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
      DeleteRegValue HKCU "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
    !endif
    FileWrite $0 "old uninstall registration removed; installing over it$\r$\n"

    popPrepareClosed:
    FileClose $0

    popPrepareDone:
    Pop $R9
    Pop $R8
    Pop $R7
    Pop $R6
    Pop $R5
    Pop $R4
    Pop $0
    Abort
  FunctionEnd
!macroend
