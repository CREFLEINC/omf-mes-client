import { messages } from '@omf-mes/i18n';

import type { InspectionRequestDetail } from './types';

/**
 * 헤더 — 화면 스펙 §3 의 위쪽 64 다. **도면이 그린 대로 그린다.**
 *
 * ```
 * 제품 검사   WO-…013 · ABC-123 · 사출        LOT …0031   POP-L1 ●
 * ```
 *
 * ⛔ **§4-A 를 표시 목록으로 읽지 않는다.** 그 표는 `quality.inspection_request` 의 «필드»
 * 표이고 「필수」 칸은 `UNIQUE`·`NOT NULL`·`CHECK > 0` 같은 **데이터 제약**이다 — 무엇을
 * 어디에 그리는지는 §3 도면이 정한다. 여덟 칸을 늘어놓았다가 되돌린 자리다.
 *
 * ⚠ **도면의 여섯 중 셋은 그릴 자료가 없다** — 공정은 검사 의뢰 응답에 아예 없고, 단말명·
 * 온라인 표시는 단말 컨텍스트가 이 저장소에 서지 않았다. 지어내지 않고 비워 둔다.
 *
 * ⚠ **번호가 아니라 식별자를 그린다** — 계약이 품목·LOT·W/O 를 정수로만 주고 코드 문자열을
 * 주지 않는다. 이름을 채우는 참조 조회는 이 슬라이스가 두지 않기로 한 것이다.
 *
 * ⚠ 검사기준 버전과 샘플 수는 도면이 **좌측 구획 머리**에 두었으므로 그쪽에 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.pqcInspection.detail;
const empty = messages.pqcInspection.emptyValue;

export interface TargetHeaderProps {
  detail: InspectionRequestDetail;
}

export const TargetHeader = ({ detail }: TargetHeaderProps) => {
  const items = [
    {
      key: 'workOrder',
      label: t.fields.workOrderId,
      value: detail.workOrderId === null ? empty : String(detail.workOrderId),
    },
    { key: 'item', label: t.fields.itemId, value: String(detail.itemId) },
    {
      key: 'lot',
      label: t.fields.lotId,
      value: detail.lotId === null ? empty : String(detail.lotId),
    },
  ];

  return (
    <section aria-label={t.heading}>
      <dl className="filter-bar">
        {items.map((item) => (
          <div className="field-cell" key={item.key}>
            <dt className="field-label">{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
