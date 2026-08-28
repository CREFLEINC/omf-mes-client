import { messages } from '@omf-mes/i18n';

import type { InspectionRequestDetail } from './types';

/**
 * 헤더 — 화면 스펙 §3 의 위쪽 64 다. **도면이 그린 대로 그린다.**
 *
 * ```
 * 제품 검사   WO-…013 · ABC-123 · 사출        LOT …0031   POP-L1 ●
 * ```
 *
 * ⭐ **라벨을 붙이지 않는다.** 도면은 값만 가운뎃점으로 잇고, LOT 만 앞에 표를 단다. 라벨을
 * 붙인 격자로 그렸다가 되돌린 자리다 — UI 구성은 설계가 정하고 화면은 그대로 따른다.
 *
 * ⛔ **§4-A 를 표시 목록으로 읽지 않는다.** 그 표는 `quality.inspection_request` 의 «필드»
 * 표이고 「필수」 칸은 `UNIQUE`·`NOT NULL` 같은 **데이터 제약**이다.
 *
 * ⚠ **도면의 여섯 중 셋은 그릴 자료가 없다** — 공정은 검사 의뢰 응답에 아예 없고, 단말명·
 * 온라인 표시는 단말 컨텍스트가 이 저장소에 서지 않았다. 지어내지 않고 비워 둔다.
 *
 * ⚠ **번호가 아니라 식별자를 그린다** — 계약이 품목·LOT·W/O 를 정수로만 주고 코드 문자열을
 * 주지 않는다. 도면은 `WO-…013`·`ABC-123` 처럼 서로 다른 형태의 코드를 전제한다.
 *
 * ⚠ 눈에 보이는 라벨은 없지만 **읽어 주는 이름은 남긴다**(`aria-label`) — 화면에 보이는
 * 모양은 도면 그대로이고, 소리로 듣는 사람에게 숫자 셋이 구분되지 않는 것은 별개 문제다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.pqcInspection.detail;
const empty = messages.pqcInspection.emptyValue;

export interface TargetHeaderProps {
  detail: InspectionRequestDetail;
}

export const TargetHeader = ({ detail }: TargetHeaderProps) => (
  <section className="pop-target-header" aria-label={t.heading}>
    <p className="pop-target-line">
      <span aria-label={t.fields.workOrderId}>
        {detail.workOrderId === null ? empty : detail.workOrderId}
      </span>
      {' · '}
      <span aria-label={t.fields.itemId}>{detail.itemId}</span>
    </p>

    {/* 도면이 LOT 에만 앞표를 단다 — 오른쪽 묶음이라 무엇인지 가릴 단서가 필요해서다. */}
    <p className="pop-target-line" aria-label={t.fields.lotId}>
      {t.lotPrefix} {detail.lotId === null ? empty : detail.lotId}
    </p>
  </section>
);
