import { messages } from '@omf-mes/i18n';

import { formatDateTime, type InspectionRequestDetail } from './types';

/**
 * 고른 의뢰의 대상 정보 — **스펙 §4-A 다.**
 *
 * ⚠ **적용 기준(검사기준 버전)을 감추지 않는다.** 검사 시점의 기준 버전이 그 검사에 고정되고,
 * 이후 기준이 바뀌어도 이 검사는 당시 버전으로 남는다. 버전이 보이지 않으면 검사자는 자기가 어느
 * 기준으로 재고 있는지 모르고, 나중에 결과를 읽는 사람도 알 수 없다. 숫자만 두지 않고 **왜
 * 중요한지도 한 줄로 밝힌다.**
 *
 * ⭐ **기준이 비면 전용 문구를 쓴다.** 일반 빈 값 표시(`—`)와 **다른 글자**여야 한다 —
 * 「기준이 등록되지 않았다」와 「값을 못 읽었다」는 사용자가 할 일이 다르다(공유계약 G-9).
 *
 * ⚠ **대상 유형을 코드 그대로 보인다.** 유형 코드 ↔ 대상 대응표가 아직 정해지지 않았다 —
 * 표시명을 지어내면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * ⚠ **수량을 단위 없이 그린다.** 계약이 단위를 정수로만 주고 표시명을 주지 않는다. 이름 조회를
 * 얹으면 그 실패가 이 창을 통째로 비게 만든다 — 그 사실을 한 줄로 밝힌다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.oqcInspection.detail;
const empty = messages.oqcInspection.queue.emptyValue;

export interface RequestDetailPaneProps {
  detail: InspectionRequestDetail;
}

export const RequestDetailPane = ({ detail }: RequestDetailPaneProps) => {
  const items = [
    { key: 'no', label: t.fields.inspectionRequestNo, value: detail.inspectionRequestNo },
    { key: 'type', label: t.fields.inspectionTypeCode, value: detail.inspectionTypeCode },
    { key: 'targetType', label: t.fields.targetTypeCode, value: detail.targetTypeCode },
    { key: 'targetId', label: t.fields.targetId, value: String(detail.targetId) },
    {
      key: 'lot',
      label: t.fields.lotId,
      value: detail.lotId === null ? empty : String(detail.lotId),
    },
    { key: 'item', label: t.fields.itemId, value: String(detail.itemId) },
    { key: 'qty', label: t.fields.targetQty, value: String(detail.targetQty) },
    {
      key: 'plan',
      label: t.fields.inspectionPlanVersionId,
      /* 없는 값(기준 미등록)과 모르는 값은 다른 모양이어야 한다(공유계약 G-9 · client#589). */
      value:
        detail.inspectionPlanVersionId === null
          ? t.noPlanVersion
          : String(detail.inspectionPlanVersionId),
    },
    { key: 'requestedAt', label: t.fields.requestedAt, value: formatDateTime(detail.requestedAt) },
  ];

  return (
    <section aria-label={t.heading}>
      <h3>{t.heading}</h3>
      <dl className="filter-bar">
        {items.map((item) => (
          <div className="field-cell" key={item.key}>
            <dt className="field-label">{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      {/* 버전 숫자만 보이면 왜 중요한지 알 수 없다. 고정된다는 사실을 화면이 말한다. */}
      <p className="field-note">{t.planVersionNote}</p>
      <p className="field-note">{t.uomNote}</p>
    </section>
  );
};
