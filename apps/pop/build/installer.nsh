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
