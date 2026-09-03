import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export interface PopHeaderProps {
  /** 표제와 본문을 잇는 id. 셸이 없는 화면이라 표제가 본문의 이름이 된다. */
  titleId: string;
  /** 이 단말이 붙어 있는 설비. 못 받았으면 `null`. */
  equipmentCode: string | null;
  equipmentName: string | null;
  /** 확인이 끝난 사번. 아직이면 `null`. */
  workerNo: string | null;
  /**
   * 서버에 닿았는가. **아직 모르면 `undefined`** — 그때는 아무 말도 하지 않는다.
   *
   * ⛔ **브라우저의 온라인 여부로 판정하지 않는다.** 랜선이 빠져도 같은 기기의 서버에는 닿고,
   * 반대로 브라우저가 온라인이라도 서버가 죽어 있을 수 있다.
   */
  isConnected?: boolean;
}

/**
 * POP 상단 띠(스펙 §4 헤더 64) — **화면 이름 · 어느 설비 앞인가 · 누구로 기록되는가 · 연결**.
 *
 * ⛔ **제품명을 넣지 않는다.** 셸 안에 이미 들어와 있는 사람에게 매 화면 시스템 이름을
 * 되풀이하면, 64픽셀짜리 띠에서 「지금 무슨 화면인가」가 밀린다.
 *
 * ⛔ **모르는 것을 빈칸으로 두지 않는다.** 설비를 비워 두면 단말이 하나뿐인 것처럼 읽히고,
 * 사번을 비워 두면 누구로 기록되는지 모르는 채 시작하게 된다.
 */
export const PopHeader = ({
  titleId,
  equipmentCode,
  equipmentName,
  workerNo,
  isConnected,
}: PopHeaderProps) => {
  const t = messages.workStart;

  return (
    <header className="pop-header">
      <h1 id={titleId} className="pop-title">
        {t.title}
      </h1>

      <p className="pop-context pop-context-right">
        <span>
          {equipmentCode === null || equipmentCode.trim() === ''
            ? t.header.equipmentUnknown
            : t.header.equipmentLabel(equipmentCode, equipmentName ?? '')}
        </span>

        <span>
          {workerNo === null || workerNo.trim() === ''
            ? t.header.workerUnset
            : t.header.workerLabel(workerNo)}
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
