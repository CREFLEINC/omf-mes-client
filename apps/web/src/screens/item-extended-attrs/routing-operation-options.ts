import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { LookupEntry } from './types';

type RoutingOperation = components['schemas']['RoutingOperation'];

/**
 * 「등록 공정」 선택지 — **Rev 여럿을 한 목록으로 편다.**
 *
 * 계약이 이 값을 `routingOperationId`(공정 라인 한 줄)로 잡았는데, 그 줄은 Routing **Rev**에
 * 매달려 있다. 품목 하나에 Rev가 여럿이므로 조회가 2단이다 —
 * `GET /planning/routings?itemId=` 로 Rev 목록을 받고, Rev마다 `…/operations`를 받는다.
 *
 * **최신 Rev만 쓰지 않는다.** 구성품이 가리키는 공정이 옛 Rev의 줄일 수 있고, 그것을 목록에서
 * 빼면 지금 저장된 값이 선택칸에서 사라져 사용자가 값을 잃은 줄 안다.
 *
 * **Rev 상태로 거르지 않는다.** `Routing.statusCode`의 값 목록이 확정되지 않아 화면이
 * 「폐기」를 판정할 문자열을 갖고 있지 않다 — 값을 지어내지 않는다(결정 4·10과 같은 근거).
 *
 * **순서 값을 그대로 내지 않는다.** 계약이 「화면은 이 값을 그대로 보여주지 않고 목록 내 위치로
 * 1부터 연속 표시한다」고 못 박았다 — 서버 채번 방식(연번/간격)은 화면이 알 자료가 아니다.
 *
 * 이 파일은 **순수 함수만** 갖는다. 조회는 `lookups.ts`가 한다.
 */

const t = messages.itemExtendedAttrs.component;

/**
 * Rev 하나와 그 공정 목록.
 *
 * **`operations`가 `null`이면 「받지 못했다」**이고 빈 배열이면 「공정이 없는 Rev」다.
 * 둘을 같은 값으로 뭉치면 조회 실패가 「공정이 없다」로 조용히 읽힌다.
 */
export interface RoutingRevisionOperations {
  routingVersion: number;
  operations: readonly RoutingOperation[] | null;
}

export interface RoutingOperationOptions {
  entries: LookupEntry[];
  /**
   * 일부 Rev의 공정을 받지 못해 **선택지가 불완전하다.**
   * 이 목록에는 쪽 나눔이 없어(계약) 「잘렸다」는 상태가 이 갈래로만 생긴다.
   */
  incomplete: boolean;
}

const EMPTY_OPTIONS: RoutingOperationOptions = { entries: [], incomplete: false };

/**
 * Rev별 공정 목록을 선택지 한 벌로 편다.
 *
 * 받은 순서를 지킨다 — 계약이 Rev 목록을 `routingVersion` 내림차순(최신이 위)으로 주고,
 * 공정 목록을 `operationSeq` 오름차순으로 준다. 화면이 다시 정렬하면 서버가 정한 순서와
 * 화면이 정한 순서 둘이 생긴다.
 */
export const toRoutingOperationOptions = (
  revisions: readonly RoutingRevisionOperations[],
): RoutingOperationOptions => {
  if (revisions.length === 0) return EMPTY_OPTIONS;

  const entries: LookupEntry[] = [];
  let incomplete = false;

  for (const revision of revisions) {
    if (revision.operations === null) {
      incomplete = true;
      continue;
    }

    revision.operations.forEach((operation, index) => {
      entries.push({
        value: String(operation.routingOperationId),
        // 목록 내 위치(1부터)다. `operationSeq`를 그대로 내지 않는다.
        label: t.values.routingOperation(
          revision.routingVersion,
          index + 1,
          operation.operationName,
        ),
        /* 이 목록에 사용 여부라는 축이 없다 — 골라도 되는 줄만 서버가 준다. */
        isActive: true,
      });
    });
  }

  return { entries, incomplete };
};
