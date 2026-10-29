import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

export interface PopHeaderProps {
  /** 표제와 본문을 잇는 id. 셸이 없는 화면이라 표제가 본문의 이름이 된다. */
  titleId: string;
  /** 화면 이름 */
  title: string;
  /**
   * 이 단말의 코드. 못 받았으면 `null`. 넘기지 않으면(`undefined`) 단말 자리를 두지 않는다.
   * C-11 고정 항목에 단말이 없어, W/O와 공정을 보이는 작업 화면은 폭을 그쪽에 쓴다(PI-02).
   */
  terminalCode?: string | null;
  /** 이 단말에 매핑된 설비. 모르거나 없으면 `null` — 타이틀 옆 자리를 비운다. */
  equipmentCode: string | null;
  equipmentName: string | null;
  /** 확인이 끝난 사번. 아직이면 `null`. */
  workerNo: string | null;
  /** 작업자 이름. 모르면 `null`이고 사번만 보인다. */
  workerName?: string | null;
  /** 현재 W/O 번호. W/O를 정하기 전 화면(작업 시작)은 넘기지 않는다. */
  workOrderNo?: string | null;
  /** 현재 W/O의 공정 이름. 모르면 `null`이고 자리를 비운다. */
  processName?: string | null;
  /** 긴급 W/O면 W/O 번호 앞에 긴급 칩을 둔다. */
  isEmergency?: boolean;
  /** 이 작업에 지정한 금형 「이름 (코드)」. 없으면 자리를 두지 않는다(C-21, W/O 맥락). */
  moldText?: string | null;
  /** W/O에 계획 금형이 있는데 아직 지정하지 않았으면 예외 칩을 둔다. */
  isMoldMissing?: boolean;
  /**
   * 서버에 닿았는가. **아직 모르면 `undefined`** — 그때는 아무 말도 하지 않는다.
   *
   * ⛔ **브라우저의 온라인 여부로 판정하지 않는다.** 랜선이 빠져도 같은 기기의 서버에는 닿고,
   * 반대로 브라우저가 온라인이라도 서버가 죽어 있을 수 있다.
   */
  isConnected?: boolean;
  /** 아직 서버에 닿지 않은 기록 수. 0이거나 넘기지 않으면 칩을 두지 않는다. */
  unsentCount?: number;
  /**
   * 그 화면에서 언제든 쓸 수 있는 동작(예: 생산 작업의 [작업 중단]). 머리줄 오른쪽 끝, 셸의 [화면 이동] 바로
   * 앞에 선다. 테두리 버튼 하나를 넘기지 않는다(머리줄 폭).
   */
  actions?: ReactNode;
}

const hasText = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value.trim() !== '';

/**
 * POP 머리줄(C-11). 화면 이름, 설비(스테이션), 현재 W/O와 공정, 작업자, 통신 상태.
 * 설비는 이름(툴팁에 「이름 (코드)」), 작업자는 「이름 (사번)」으로 보인다(C-10, PI-02). 단말은 넘겼을 때만 내부 번호가 아니라 단말 코드로
 * 보인다(작업 시작). 폭이 모자라면 화면 이름, W/O, 오른쪽 덩어리는 그대로 두고 설비가 줄어든다.
 *
 * 작업 시작(P-02-01)과 자재 투입(P-02-03)이 쓴다. 셸이 머리줄 오른쪽에 [화면 이동], [사용자 전환]을
 * 앉힌다. 머리줄을 셸이 직접 그리는 일은 POP 화면 전체의 작업이라 범위 밖이다(omf-all-around#169).
 *
 * 미전송 건수는 통신 상태 옆 칩 하나로 둔다. 미전송이 없으면 칩을 두지 않는다(PG-24).
 */
export const PopHeader = ({
  titleId,
  title,
  terminalCode,
  equipmentCode,
  equipmentName,
  workerNo,
  workerName = null,
  workOrderNo = null,
  processName = null,
  isEmergency = false,
  moldText = null,
  isMoldMissing = false,
  isConnected,
  unsentCount = 0,
  actions,
}: PopHeaderProps) => {
  const t = messages.popChrome.header;

  return (
    <header className="pop-header">
      <h1 id={titleId} className="pop-title pop-header-title">
        {title}
      </h1>

      {/* 무엇 앞에 서 있는가(설비, W/O, 공정)는 타이틀 옆, 단말과 작업자와 연결은 오른쪽. */}
      {hasText(equipmentCode) && (
        /* 설비는 이름만 보이고 「이름 (코드)」는 툴팁이다(PI-02). 그래도 넘치면 줄임표로 줄어든다. */
        <p className="pop-context" title={t.equipmentTitle(equipmentCode, equipmentName ?? '')}>
          {t.equipmentLabel(equipmentCode, equipmentName ?? '')}
        </p>
      )}

      {hasText(workOrderNo) && (
        <p className="pop-context pop-header-work-order">
          {isEmergency && (
            <Chip variant="status" size="md" status="error">
              {t.emergency}
            </Chip>
          )}
          <span>{t.workOrderLabel(workOrderNo)}</span>
          {hasText(processName) && <span>{processName}</span>}
        </p>
      )}

      {/* 금형은 W/O 맥락이다. 지정했거나 W/O가 계획했는데 아직 없을 때만 선다(C-21). */}
      {(hasText(moldText) || isMoldMissing) && (
        <p className="pop-context pop-header-work-order">
          {hasText(moldText) ? (
            <span>{t.moldLabel(moldText)}</span>
          ) : (
            <Chip variant="status" size="md" status="warning">
              {t.moldMissing}
            </Chip>
          )}
        </p>
      )}

      <p className="pop-context pop-context-right">
        {terminalCode !== undefined && (
          <span>{hasText(terminalCode) ? t.terminalLabel(terminalCode) : t.terminalUnknown}</span>
        )}

        {hasText(workerNo) ? (
          <span title={t.workerTitle(workerNo, workerName)}>
            {t.workerLabel(workerNo, workerName)}
          </span>
        ) : (
          <span>{t.workerUnset}</span>
        )}

        {isConnected !== undefined && (
          <Chip variant="status" size="md" status={isConnected ? 'success' : 'error'}>
            {isConnected ? t.connected : t.disconnected}
          </Chip>
        )}

        {unsentCount > 0 && (
          <Chip variant="status" size="md" status="warning">
            {t.unsent(unsentCount)}
          </Chip>
        )}
      </p>

      {actions !== undefined && actions !== null && (
        <span className="pop-header-tools">{actions}</span>
      )}
    </header>
  );
};
