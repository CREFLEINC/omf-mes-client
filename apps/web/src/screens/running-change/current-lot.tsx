import { messages } from '@omf-mes/i18n';

import type { CurrentLotView } from './queries';

const t = messages.runningChange;

export interface CurrentLotProps {
  lot: CurrentLotView | null;
  isPending: boolean;
  isError: boolean;
  /** 주소가 생산LOT 을 실었는가. 안 실었으면 조회 자체가 나가지 않는다. */
  hasLot: boolean;
}

/**
 * 《현재 생산LOT》 — 스펙 §3 좌단. **읽기 전용 구획**이고 교체 등록 본문에 담기지 않는다.
 *
 * ⛔ **화면이 「지금 어느 LOT 인가」를 고르지 않는다.** 선발행 슬롯이 여럿이고 세션에 LOT 이
 * 없어 서버도 판정하지 못한다 — 넘겨 주는 화면이 주소에 실어 준 것만 믿는다(스펙 §3).
 *
 * ⛔ **없음·못 읽음·진척 없음을 한 모양으로 두지 않는다.** 셋 다 「320/500」이 안 보이는
 * 상태지만 작업자가 할 일이 다르다 — 앞 화면을 거쳐 다시 들어오거나, 다시 읽거나, 그대로
 * 진행하거나다.
 */
export const CurrentLot = ({ lot, isPending, isError, hasLot }: CurrentLotProps) => (
  <>
    {!hasLot && <p className="pane-lead">{t.currentLot.missing}</p>}
    {hasLot && isPending && <p className="pane-lead">{t.currentLot.loading}</p>}
    {hasLot && !isPending && isError && <p className="pane-lead">{t.currentLot.failed}</p>}

    {lot !== null && !isError && (
      <p className="pop-rc-lot">
        <span className="pop-rc-lot-no">{lot.lotNo}</span>
        <span className="pop-rc-lot-progress">
          {lot.goodQty === null
            ? t.currentLot.progressUnknown(lot.targetQty)
            : t.currentLot.progress(lot.goodQty, lot.targetQty)}
        </span>
      </p>
    )}
  </>
);
