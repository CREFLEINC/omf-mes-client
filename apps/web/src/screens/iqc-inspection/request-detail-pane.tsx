import { messages } from '@omf-mes/i18n';

import { formatDateTime, type InspectionRequestDetail } from './types';
import { withUom } from './uom-lookup';

/**
 * 고른 의뢰의 상세 — **스펙 §4-A 의 여섯 항목이다.**
 *
 * ⚠ **검사기준 버전을 감추지 않는다.** 검사 시점의 기준 버전이 그 검사에 고정되고, 이후
 * 기준이 바뀌어도 이 검사는 당시 버전으로 남는다. 버전이 보이지 않으면 검사자는 자기가 어느
 * 기준으로 재고 있는지 모르고, 나중에 결과를 읽는 사람도 알 수 없다. 숫자만 두지 않고 **왜
 * 중요한지도 한 줄로 밝힌다.**
 *
 * ⚠ **품목·자재 LOT 을 번호로 그린다.** 계약이 식별자만 주고 이름을 주지 않는다. 참조 조회를
 * 얹지 않는 이유는 `queries.ts` 머리에 적었다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.detail;
const empty = messages.iqcInspection.queue.emptyValue;

export interface RequestDetailPaneProps {
  detail: InspectionRequestDetail;
  /** 수량 옆에 붙일 단위 코드. 모르면 `null` — 숫자만 둔다 */
  uomCode: string | null;
}

export const RequestDetailPane = ({ detail, uomCode }: RequestDetailPaneProps) => {
  /* 식별에 쓰이는 넷(의뢰번호·품목·대상 LOT·검사수량)은 값을 조금 굵게 — 먼저 눈에 들어오게. */
  const items = [
    {
      key: 'no',
      label: t.fields.inspectionRequestNo,
      value: detail.inspectionRequestNo,
      emphasized: true,
    },
    { key: 'type', label: t.fields.inspectionTypeCode, value: detail.inspectionTypeCode },
    { key: 'item', label: t.fields.itemId, value: String(detail.itemId), emphasized: true },
    {
      key: 'lot',
      label: t.fields.lotId,
      value: detail.lotId === null ? empty : String(detail.lotId),
      emphasized: true,
    },
    {
      key: 'qty',
      label: t.fields.targetQty,
      value: withUom(String(detail.targetQty), uomCode),
      emphasized: true,
    },
    {
      key: 'plan',
      label: t.fields.inspectionPlanVersionId,
      /* client#589 — 없는 값(기준 미등록)과 모르는 값은 다른 모양이어야 한다(공유계약 G-9). */
      value:
        detail.inspectionPlanVersionId === null
          ? t.noPlanVersion
          : String(detail.inspectionPlanVersionId),
      /* 버전 숫자만 보이면 왜 중요한지 알 수 없다. 고정된다는 사실을 항목명 오른쪽 같은 줄에서 말한다. */
      hint: t.planVersionNote,
    },
    /* 값만 따로 두면 무슨 시각인지 모른다 — 필드(`requestedAt`) 이름을 붙인다. */
    { key: 'at', label: t.fields.requestedAt, value: formatDateTime(detail.requestedAt) },
  ];

  return (
    <section className="iqc-inspection-section" aria-label={t.heading}>
      <h3>{t.sectionTitle}</h3>
      <dl className="iqc-inspection-facts">
        {items.map((item) => (
          <div className="iqc-inspection-fact" key={item.key}>
            <dt className="field-label">
              {item.label}
              {item.hint !== undefined && (
                <span className="iqc-inspection-label-hint">{item.hint}</span>
              )}
            </dt>
            <dd className={item.emphasized === true ? 'iqc-inspection-fact-key' : undefined}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
