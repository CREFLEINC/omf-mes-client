import { messages } from '@omf-mes/i18n';

import { screenPathOf, type ScreenRouteTable } from './screen-routes';
import { readableName, type ApprovalTarget } from './types';

/**
 * 대상 「열기」의 판정과 대상 이름.
 *
 * **이 회차의 대상 구획은 잠정이다.** 스펙은 이 자리에 대상 LOT의 수량·현재 상태·입하·
 * 공급사를 그리라고 적었으나, 그 값을 얻는 길이 계약에 정해지지 않았다(질문 게시 중).
 * 지금 할 수 있는 일은 **이름을 내고 원 화면을 여는 것** 둘뿐이며, 열 수 없으면
 * **왜 못 여는지**를 말한다. 길이 정해지면 이 구획에 값이 붙는다.
 *
 * **`targetTypeCode`로 분기하지 않는다.** 유형을 보고 화면을 고르는 매핑표는 계약이 명시적으로
 * 금지했다(그 판정은 서버가 `screenId`·`openable`로 이미 내려 준다). 이 파일에도, 이 슬라이스
 * 어디에도 그 코드로 갈리는 줄이 없다 — 유형 코드는 **읽고 판단하는 값이 아니라 옮기는 값**이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.iqcSkipApproval;

/**
 * 열기가 어떤 상태인가 — **열림 하나와 잠김 셋**이다.
 *
 * | 갈래 | 무엇이 사실인가 | 누가 풀 수 있는가 |
 * | --- | --- | --- |
 * | `open` | 열 수 있고 갈 곳도 안다 | — |
 * | `notOpenable` | 계약이 **열 수 없다고 내려 줬다** | 서버(대상 쪽 사정이다) |
 * | `noScreenId` | 열 수 있다는데 **어느 화면인지 오지 않았다** | 계약·규약(§5.4-5의 질문) |
 * | `unmapped` | 화면은 아는데 **이 앱에 그 화면이 없다** | 이 저장소(`screen-routes.ts`에 줄을 더한다) |
 *
 * 셋을 한 갈래로 뭉개지 않는 이유는 **사용자가 할 조치가 다르기 때문**이다. 「열 수 없습니다」
 * 하나만 내면 담당자에게 물어야 할 사람과 기다려야 할 사람이 구분되지 않는다.
 */
export type TargetOpenBlock =
  { kind: 'notOpenable' } | { kind: 'noScreenId' } | { kind: 'unmapped' };

export type TargetOpenState = { kind: 'open'; path: string } | TargetOpenBlock;

/**
 * 이 대상을 열 수 있는가.
 *
 * **차례가 곧 우선순위다.** 계약이 「열 수 없다」고 말했으면 화면 ID가 실려 왔더라도 그 말이
 * 이긴다 — 서버가 권한·상태를 보고 내린 판정이고 화면은 그 근거를 갖고 있지 않다.
 *
 * 매핑표를 **인자로 받는다.** 자리표시를 읽는 자리를 한 곳으로 묶어야 「표를 채우면 열린다」를
 * 시험이 실제로 잴 수 있다 — 판정 안에 표를 박아 넣으면 그 전환이 죽은 가지가 된다.
 */
export const judgeTargetOpen = (
  target: ApprovalTarget,
  routes: ScreenRouteTable,
): TargetOpenState => {
  if (!target.openable) return { kind: 'notOpenable' };

  const screenId = target.screenId ?? '';

  if (screenId === '') return { kind: 'noScreenId' };

  const path = screenPathOf(screenId, routes);

  return path === null ? { kind: 'unmapped' } : { kind: 'open', path };
};

/**
 * 잠긴 사유.
 *
 * **열린 갈래를 인자로 받지 않는다.** 받으면 「사유 없음」을 뜻하는 널이 반환 타입에 생기고,
 * 그리는 자리가 그 널을 빈 글자로 메우는 죽은 가지를 갖게 된다 — 타입이 그 자리를 막는다.
 */
export const describeOpenBlock = (block: TargetOpenBlock): string => {
  switch (block.kind) {
    case 'notOpenable':
      return t.target.blockedNotOpenable;
    case 'noScreenId':
      return t.target.blockedNoScreenId;
    case 'unmapped':
      return t.target.blockedUnmapped;
  }
};

/**
 * 대상 이름 — **서버가 만든 표시명 그대로다.**
 *
 * 비어 오면 사실을 적는다. **`targetId`도 `targetTypeCode`도 대신 내지 않는다**(`omf-mes#44`) —
 * 번호는 사용자에게 아무 뜻이 없고, 유형 코드로 이름을 지어내면 그것이 곧 금지된 매핑표다.
 *
 * 「비어 있다」의 판정은 이 슬라이스의 이름 자리가 함께 쓰는 것 하나다(`readableName`).
 */
export const describeTargetName = (target: ApprovalTarget): string =>
  readableName(target.displayName, t.values.unknownTarget);
