import { messages } from '@omf-mes/i18n';

import type { InspectionRequestDetail } from './types';

/**
 * 헤더 — 화면 스펙 §3 의 위쪽 64 다.
 *
 * ```
 * 제품 검사   WO-…013 · ABC-123 · 사출        LOT …0031   POP-L1 ●
 * ```
 *
 * **스펙이 정한 것은 높이와 «무엇이 들어가는가»까지다.** 도면은 ASCII 스케치이고, §7 DS
 * 매핑 표에 헤더 항목이 없어 **라벨 유무·컴포넌트·배열은 정해져 있지 않다.** 스케치의
 * 가운뎃점을 「라벨 없이 이으라」로 읽었다가 되돌린 자리다 — 스케치는 그 말을 하지 않는다.
 *
 * 그래서 **POP 화면의 전례를 따른다** — 도면의 64 짜리 한 줄을 `pop-header` 안의
 * `pop-context-right` 로 그린다(`P-02-03`·`P-05-01` 과 같은 형태). 관리웹의 `PageHeader` +
 * `Breadcrumb` 는 쓰지 않는다: 이 화면은 셸 밖에 서고, 사이드바로 오가지 않아 돌아갈 경로가
 * 없다. 라벨을 값 앞에 붙이는 것도 그 전례를 따른다 — 도면의 가운뎃점은 라벨을 지우라는
 * 말이 아니고, 라벨이 없으면 정수 셋이 무엇인지 구분되지 않는다.
 *
 * ⛔ **§4-A 를 표시 목록으로 읽지 않는다.** 그 표는 `quality.inspection_request` 의 «필드»
 * 표이고 「필수」 칸은 `UNIQUE`·`NOT NULL` 같은 **데이터 제약**이다. 무엇을 그릴지는 도면이
 * 정하고, 도면의 헤더는 W/O·품목·공정·LOT·단말·온라인 여섯이다.
 *
 * ⚠ **그중 셋은 그릴 자료가 없다** — 공정은 검사 의뢰 응답에 아예 없고, 단말명·온라인은
 * 단말 컨텍스트가 이 저장소에 서지 않았다. 지어내지 않고 비워 둔다.
 *
 * ⚠ **번호가 아니라 식별자를 그린다** — 계약이 품목·LOT·W/O 를 정수로만 준다. 도면은
 * `WO-…013`·`ABC-123` 같은 코드를 전제하나 그 문자열이 응답에 없다. 이름을 채우는 참조
 * 조회는 이 슬라이스가 두지 않기로 한 것이다(`queries.ts` 머리).
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
    <div className="pop-context-right" aria-label={t.heading} role="group">
      {items.map((item) => (
        <span key={item.key}>{`${item.label} ${item.value}`}</span>
      ))}
    </div>
  );
};
