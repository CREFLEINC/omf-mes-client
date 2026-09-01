import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export interface PopHeaderProps {
  /**
   * 이 단말의 번호. **셸이 아는 값**이라 화면은 받기만 한다 — 채우는 곳이 아직 없어 기본은
   * 「모른다」다.
   */
  terminalNo?: string;
  /**
   * 서버에 닿았는가. **아직 모르면 `undefined`** — 그때는 아무 말도 하지 않는다.
   *
   * ⛔ **브라우저의 온라인 여부로 판정하지 않는다.** 랜선이 빠져도 같은 기기의 서버에는
   * 닿고(산업용 패널 PC), 반대로 브라우저가 온라인이라도 서버가 죽어 있을 수 있다.
   */
  isConnected?: boolean;
}

/**
 * POP 상단 띠 — 제품명 · 화면 이름 · **지금 어느 단말 앞이고 서버에 닿아 있는지**.
 *
 * ⭐ **단말과 연결을 상시 보인다.** 현장에는 같은 화면을 띄운 단말이 여럿이고, 어느 단말에서
 * 한 일인지가 기록의 귀속을 가른다. 연결이 끊긴 것을 모르면 목록이 비었을 때 「긴급 지시가
 * 없다」로 읽는다.
 *
 * ⛔ **모르는 것을 빈칸으로 두지 않는다.** 비워 두면 단말이 하나뿐인 것처럼 읽힌다.
 */
export const PopHeader = ({ terminalNo, isConnected }: PopHeaderProps) => {
  const t = messages.emergencyWorkOrderField;

  return (
    <header className="pop-header">
      {/*
       * ⭐ **어느 프로그램 앞인지부터 말한다.** 이 셸에는 사이드바도 주소창도 없어(설치형
       * 키오스크) 화면 이름만 있으면 «무슨 시스템의» 화면인지 알 길이 없다. 관리웹이
       * 상단 바에 이름을 두는 것과 같은 자리이며, 이름은 설치형 앱의 제품명과 맞춘다.
       */}
      <strong className="pop-brand">OMF-MES POP</strong>
      <h1>
        <Chip status="error" size="md">
          {t.list.emergencyBadge}
        </Chip>{' '}
        {t.title}
      </h1>
      <span className="field-note">
        {terminalNo === undefined || terminalNo.trim() === ''
          ? t.header.terminalUnknown
          : t.header.terminalLabel(terminalNo)}
      </span>
      {isConnected !== undefined && (
        <Chip status={isConnected ? 'success' : 'error'} size="sm">
          {isConnected ? t.header.connected : t.header.disconnected}
        </Chip>
      )}
    </header>
  );
};
