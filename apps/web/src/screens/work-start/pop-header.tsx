import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export interface PopHeaderProps {
  /** 표제와 본문을 잇는 id. 셸이 없는 화면이라 표제가 본문의 이름이 된다. */
  titleId: string;
  /** 이 단말의 코드. 못 받았으면 `null`. */
  terminalCode: string | null;
  /** 이 단말에 매핑된 설비. 모르거나 없으면 `null` — 타이틀 옆 자리를 비운다. */
  equipmentCode: string | null;
  equipmentName: string | null;
  /** 확인이 끝난 사번. 아직이면 `null`. */
  workerNo: string | null;
  /** 작업자 이름. 모르면 `null`이고 사번만 보인다. */
  workerName?: string | null;
  /**
   * 서버에 닿았는가. **아직 모르면 `undefined`** — 그때는 아무 말도 하지 않는다.
   *
   * ⛔ **브라우저의 온라인 여부로 판정하지 않는다.** 랜선이 빠져도 같은 기기의 서버에는 닿고,
   * 반대로 브라우저가 온라인이라도 서버가 죽어 있을 수 있다.
   */
  isConnected?: boolean;
}

/**
 * POP 머리줄(C-11). 화면 이름, 설비(스테이션), 단말 코드, 작업자, 통신 상태. 설비와 작업자는
 * 「이름 (코드)」로 보인다(C-10). 현재 W/O와 공정은 이 화면에서 아직 정해지지 않아 두지 않는다.
 *
 * 셸이 머리줄 오른쪽에 [화면 이동], [사용자 전환]을 앉힌다. 머리줄을 셸 공용으로 옮기는 일은
 * POP 화면 전체의 작업이라 이번 범위 밖이다(omf-all-around#169).
 *
 * ⛔ **제품명을 넣지 않는다.** 셸 안에 이미 들어와 있는 사람에게 매 화면 시스템 이름을
 * 되풀이하면, 64픽셀짜리 띠에서 「지금 무슨 화면인가」가 밀린다.
 *
 * ⛔ **모르는 것을 빈칸으로 두지 않는다.** 설비를 비워 두면 단말이 하나뿐인 것처럼 읽히고,
 * 사번을 비워 두면 누구로 기록되는지 모르는 채 시작하게 된다.
 */
export const PopHeader = ({
  titleId,
  terminalCode,
  equipmentCode,
  equipmentName,
  workerNo,
  workerName = null,
  isConnected,
}: PopHeaderProps) => {
  const t = messages.workStart;

  return (
    <header className="pop-header">
      <h1 id={titleId} className="pop-title">
        {t.title}
      </h1>

      {/* ⭐ 무엇 앞에 서 있는가(설비)는 타이틀 옆, 단말·사번·연결은 오른쪽(사용자 지시 2026-09-14). */}
      {equipmentCode !== null && equipmentCode.trim() !== '' && (
        <p className="pop-context">{t.header.equipmentLabel(equipmentCode, equipmentName ?? '')}</p>
      )}

      <p className="pop-context pop-context-right">
        <span>
          {terminalCode === null || terminalCode.trim() === ''
            ? t.header.terminalUnknown
            : t.header.terminalLabel(terminalCode)}
        </span>

        <span>
          {workerNo === null || workerNo.trim() === ''
            ? t.header.workerUnset
            : t.header.workerLabel(workerNo, workerName)}
        </span>

        {isConnected !== undefined && (
          <Chip variant="status" size="md" status={isConnected ? 'success' : 'error'}>
            {isConnected ? t.header.connected : t.header.disconnected}
          </Chip>
        )}
      </p>
    </header>
  );
};
