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

; ⭐ **설치 진행 화면 바로 앞에서도 끈다.**
;
; 위 검사만 넣은 판에서 실기에 같은 창이 그대로 떴다(2026-09-15). 원인은 아직 가르지 못했다 —
;   ① 이 코드의 강제 종료가 실패했거나 ② 설치 중에 불리는 «이전에 설치된 판의 삭제기»(이 코드가
;   없는 옛 판)가 띄운 것이다. 옛 삭제기보다 먼저 앱을 끄는 자리를 하나 더 두고, 실패하면 위
;   창이 이유를 보인다 — 「[POP 설치기]」 머리가 없는 창이면 ②다.
;
; 보이지 않는 페이지로 끄고 곧바로 넘긴다 — 페이지와 설치 절차는 같은 설치기 안에서 돈다.
!macro customPageAfterChangeDir
  Page custom popCloseBeforeInstall
  Function popCloseBeforeInstall
    !insertmacro popCloseRunningApp
    Abort
  FunctionEnd
!macroend
