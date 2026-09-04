import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export interface PopHeaderProps {
  /** 표제와 본문을 잇는 id. 셸이 없는 화면이라 표제가 본문의 이름이 된다. */
  titleId: string;
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
 * POP 상단 띠 — **화면 이름 · 지금 어느 단말 앞이고 서버에 닿아 있는지**.
 *
 * ⛔ **제품명을 넣지 않는다.** 설계가 제품명을 그린 자리는 셸에 처음 들어설 때 보는 진입
 * 화면(`P-CO-01`·`M-CO-01`)뿐이고, POP·모바일의 업무 화면은 모두 **화면 이름으로 시작**한다.
 * 셸 안에 이미 들어와 있는 사람에게 매 화면 시스템 이름을 되풀이하면, 정작 64픽셀짜리
 * 띠에서 「지금 무슨 화면인가」가 밀린다.
 *
 * ⭐ **단말과 연결을 상시 보인다.** 현장에는 같은 화면을 띄운 단말이 여럿이고, 어느 단말에서
 * 한 일인지가 기록의 귀속을 가른다. 연결이 끊긴 것을 모르면 목록이 비었을 때 「긴급 지시가
 * 없다」로 읽는다.
 *
 * ⛔ **모르는 것을 빈칸으로 두지 않는다.** 비워 두면 단말이 하나뿐인 것처럼 읽힌다.
 */
export const PopHeader = ({ titleId, terminalNo, isConnected }: PopHeaderProps) => {
  const t = messages.emergencyWorkOrderField;

  return (
    <header className="pop-header">
      <h1 id={titleId} className="pop-title">
        {t.title}
      </h1>

      <p className="pop-context pop-context-right">
        <span>
          {terminalNo === undefined || terminalNo.trim() === ''
            ? t.header.terminalUnknown
            : t.header.terminalLabel(terminalNo)}
        </span>

        {isConnected !== undefined && (
          <Chip variant="status" size="sm" status={isConnected ? 'success' : 'error'}>
            {isConnected ? t.header.connected : t.header.disconnected}
          </Chip>
        )}
      </p>
    </header>
  );
};
