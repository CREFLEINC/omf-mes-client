import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { isShotCountExceeded, type CurrentMold } from './mold';
import type { ReferenceLabels } from './reference-labels';
import { replacedIds, type CurrentInputView } from './types';

const t = messages.runningChange;

export interface CurrentInputsProps {
  rows: readonly CurrentInputView[];
  isPending: boolean;
  hasWorkOrder: boolean;
  mold: CurrentMold | null;
  moldFailed: boolean;
  hasSession: boolean;
  labels: ReferenceLabels;
}

/**
 * 《현재 투입》 — 스펙 §3 좌단. **읽기 전용 구획**이고, 오른쪽 교체 대상 목록의 모집단이다.
 *
 * ⚠ **《현재 생산LOT》 구획은 아직 없다.** 스펙 §3 이 그 자리를 그렸으나 「지금 이 생산LOT」을
 * 고를 축이 계약에 없어(선발행 슬롯이 여럿이고 진척은 상세에만 붙는다) 설계팀에 검토를
 * 요청했다(omf-mes#397 ①). **모르는 것을 지어내 채우지 않는다** — 회신이 오면 이 구획 옆에
 * 붙는다.
 *
 * ⛔ **비어 있음과 불러오지 못함을 같은 모양으로 두지 않는다.** 「투입이 없다」로 보이면
 * 작업자는 교체할 것이 없다고 읽고 화면을 떠난다 — 조회 실패는 화면 위 배너가 따로 말한다.
 */
export const CurrentInputs = ({
  rows,
  isPending,
  hasWorkOrder,
  mold,
  moldFailed,
  hasSession,
  labels,
}: CurrentInputsProps) => {
  /* 이미 다른 줄이 이어받은 투입. **내리지 않고 표시만 한다** — 같은 부품을 두 번 갈 수 있다. */
  const alreadyReplaced = replacedIds(rows);

  return (
    <>
      {!hasWorkOrder && <p className="pane-lead">{t.current.noWorkOrder}</p>}
      {hasWorkOrder && isPending && <p className="pane-lead">{t.current.loading}</p>}
      {hasWorkOrder && !isPending && rows.length === 0 && (
        <p className="pane-lead">{t.current.empty}</p>
      )}

      {rows.length > 0 && (
        <ul className="pop-rc-inputs">
          {rows.map((row) => (
            <li key={row.materialConsumptionId} className="pop-rc-input">
              <span className="pop-rc-input-item">{labels.describeItem(row.itemId)}</span>
              <span className="pop-rc-input-lot">{labels.describeLot(row.lotId)}</span>
              <span className="pop-rc-input-qty">
                {`${row.inputQty} ${labels.describeUom(row.uomId)}`.trim()}
              </span>
              {alreadyReplaced.includes(row.materialConsumptionId) && (
                <Chip variant="status" size="sm" status="info">
                  {t.current.replacedBadge}
                </Chip>
              )}
            </li>
          ))}
        </ul>
      )}

      {/*
       * 지금 물린 금형(스펙 §4-B). **읽기 전용이다** — 교체 등록 본문에 담지 않는다.
       *
       * ⚠ 세션에 금형이 없는 것과 못 읽은 것을 다르게 말한다. 앞은 정상이고 뒤는 조치가 있다.
       */}
      <p className="pop-rc-mold">
        <span className="pop-rc-mold-label">{t.current.moldLabel}</span>
        {moldFailed && <span>{t.current.moldUnknown}</span>}
        {/* 「없다」와 「알 수 없다」를 가른다 — 세션이 없으면 물린 금형을 물어볼 자리가 없다. */}
        {!moldFailed && mold === null && (
          <span>{hasSession ? t.current.moldNone : t.current.moldNoSession}</span>
        )}
        {!moldFailed && mold !== null && (
          <>
            <span>{`${mold.moldCode} ${mold.moldName}`}</span>
            <span>{t.current.moldShotCount(mold.currentShotCount)}</span>
            <span>
              {mold.availableShotCount === null
                ? t.current.moldShotRemainingUnknown
                : t.current.moldShotRemaining(mold.availableShotCount)}
            </span>
            {/*
             * ⚠ **넘어도 막지 않는다**(스펙 §6 — 경고). 차단을 만들면 설계가 정한 적 없는
             * 규칙이 현장에 굳는다.
             */}
            {isShotCountExceeded(mold) && (
              <Chip variant="status" size="sm" status="warning">
                {t.current.moldShotExceeded}
              </Chip>
            )}
          </>
        )}
      </p>

      {/* 스펙 §3 이 좌단에 상시 세워 둔 안내 둘. 교체가 무엇을 «하지 않는지»를 말한다. */}
      <p className="field-note">{t.notices.equipmentKeepsRunning}</p>
    </>
  );
};
