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
;   POP 은 키오스크 잠금으로 창 닫기를 막는다(`src/main/index.ts` 의 `close` 막기). 설치기가
;   그 뒤 강제 종료로 넘어가는 길도 실행 경로·사용자 조건이 맞아야만 타서, 실기에서
;   「OMF-MES POP cannot be closed」가 떠 기존 앱을 손으로 지워야 했다(실기 2026-09-15).
;
; ⚠ **처음부터 강제 종료한다.** 정상 종료를 기다려도 잠금이 막으므로 얻는 것이 없다. 미전송
;   대기열은 쓸 때마다 디스크에 내리므로(`outbox:enqueue`) 강제 종료로 잃지 않는다.
; ⚠ **이미지 이름으로 모든 사용자의 것을 끈다.** 설치 경로·사용자로 거르면 다른 계정이 띄운
;   키오스크 앱이나 옛 경로의 앱을 놓친다.
; ⛔ 끝내 못 끄면(권한 없음 등) 기본과 같은 재시도 창을 띄운다 — 켜진 채로 파일을 덮지 않는다.
!macro customCheckAppRunning
  StrCpy $R1 0
  popKillLoop:
    nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    Sleep 1000
    nsExec::Exec `"$CmdPath" /C tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
    Pop $R0
    StrCmp $R0 0 0 popKillDone
    IntOp $R1 $R1 + 1
    IntCmp $R1 5 0 popKillLoop 0
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY popKillLoop
    Quit
  popKillDone:
!macroend
