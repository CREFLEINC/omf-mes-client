import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { isShotCountExceeded, type CurrentMold } from './mold';
import type { ReferenceLabels } from './reference-labels';
import type { CurrentInputView } from './types';

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
 * 《현재 생산LOT》 구획은 이 아래에 따로 선다(`current-lot.tsx`) — 원천이 다르다.
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
              {/*
               * ⭐ **값 위에 이름을 둔다**(사용자 제안 시안 2026-09-11). 코드와 수량이 무엇의
               *    코드이고 무엇의 수량인지 화면이 스스로 말한다 — 값만 늘어놓으면 옆 화면을
               *    아는 사람만 읽을 수 있다.
               */}
              <span className="pop-rc-pair pop-rc-input-main">
                <span className="field-label">{t.current.itemCodeLabel}</span>
                <span className="pop-rc-input-item">{labels.describeItem(row.itemId)}</span>
              </span>
              <span className="pop-rc-pair pop-rc-input-side">
                <span className="field-label">{t.current.inputQtyLabel}</span>
                {/*
                 * ⭐ 수와 단위를 «두 칸»으로 가른다(사용자 제안 시안 2026-09-11) — 눈이 먼저
                 *    잡아야 하는 것은 수이고, 단위는 그 수가 무엇인지 밝히는 꼬리다. 크기로
                 *    가른다. ⛔ 값은 그대로다.
                 */}
                <span className="pop-rc-input-qty">
                  <span className="pop-rc-input-qty-value">{row.inputQty}</span>
                  <span className="pop-rc-input-qty-uom">{labels.describeUom(row.uomId)}</span>
                </span>
              </span>
              <span className="pop-rc-input-lot">{labels.describeLot(row.lotId)}</span>
            </li>
          ))}
        </ul>
      )}

      {/*
       * 지금 물린 금형(스펙 §4-B). **읽기 전용이다** — 교체 등록 본문에 담지 않는다.
       *
       * ⚠ 세션에 금형이 없는 것과 못 읽은 것을 다르게 말한다. 앞은 정상이고 뒤는 조치가 있다.
       */}
      {/*
       * ⭐ **금형은 자기 표제를 갖는다**(사용자 제안 시안 2026-09-11). 투입 목록 끝에 한 줄로
       *    붙여 두었더니 마지막 자재의 딸린 정보처럼 읽혔다. 아래 《현재 생산LOT》과 같은
       *    층으로 세운다 — 새 상자를 만드는 것이 아니라 이미 있는 표제 형태를 쓴다.
       */}
      <h3 className="pane-title pop-rc-mold-title">{t.current.moldSectionLabel}</h3>
      <p className="pop-rc-mold">
        {moldFailed && <span>{t.current.moldUnknown}</span>}
        {/* 「없다」와 「알 수 없다」를 가른다 — 세션이 없으면 물린 금형을 물어볼 자리가 없다. */}
        {!moldFailed && mold === null && (
          <span>{hasSession ? t.current.moldNone : t.current.moldNoSession}</span>
        )}
        {!moldFailed && mold !== null && (
          <>
            {/*
             * 번호·이름·타발수를 «각자 이름을 단 칸»으로 가른다(사용자 제안 시안 2026-09-11).
             * 한 줄에 값만 늘어놓으면 어느 숫자가 타발수이고 어느 것이 잔여인지 매번 읽어야 한다.
             */}
            <span className="pop-rc-pair">
              <span className="field-label">{t.current.moldNoLabel}</span>
              <span className="pop-rc-mold-no">{mold.moldCode}</span>
            </span>
            <span className="pop-rc-pair">
              <span className="field-label">{t.current.moldNameLabel}</span>
              <span className="pop-rc-mold-name">{mold.moldName}</span>
            </span>
            <span className="pop-rc-pair">
              <span className="field-label">{t.current.shotCountLabel}</span>
              <span className="pop-rc-mold-shot">
                {t.current.moldShotCount(mold.currentShotCount)}
              </span>
            </span>
            <span className="pop-rc-pair">
              <span className="field-label">{t.current.shotRemainingLabel}</span>
              <span className="pop-rc-mold-shot">
                {mold.availableShotCount === null
                  ? t.current.moldShotRemainingUnknown
                  : t.current.moldShotRemaining(mold.availableShotCount)}
              </span>
            </span>
            {/*
             * ⚠ **넘어도 막지 않는다**(스펙 §6 — 경고). 차단을 만들면 설계가 정한 적 없는
             * 규칙이 현장에 굳는다.
             */}
            {isShotCountExceeded(mold) && (
              <Chip variant="status" size="md" status="warning">
                {t.current.moldShotExceeded}
              </Chip>
            )}
          </>
        )}
      </p>
    </>
  );
};
