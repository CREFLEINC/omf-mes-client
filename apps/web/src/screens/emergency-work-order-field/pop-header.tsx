import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export interface PopHeaderProps {
  /**
   * 이 단말의 번호. **셸이 아는 값**이라 화면은 받기만 한다 — 채우는 곳이 아직 없어 기본은
   * 「모른다」다.
   */
  terminalNo?: string;
}

/**
 * POP 상단 띠 — 화면 이름과 **지금 어느 단말 앞인지**.
 *
 * ⭐ **단말을 상시 보인다.** 현장에는 같은 화면을 띄운 단말이 여럿이고, 어느 단말에서 한
 * 일인지가 기록의 귀속을 가른다 — 그 사실을 화면이 늘 말해야 사람이 옆 단말에 대고 일하지
 * 않는다.
 *
 * ⛔ **모르는 것을 빈칸으로 두지 않는다.** 비워 두면 단말이 하나뿐인 것처럼 읽힌다.
 */
export const PopHeader = ({ terminalNo }: PopHeaderProps) => {
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
    </header>
  );
};
