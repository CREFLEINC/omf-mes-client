import type { components } from '@omf-mes/api-client';

import { toBusinessDate, toOccurredAt } from './issue-request';
import type { IssueView } from './types';

/**
 * 전기 요청의 본문을 만드는 **유일한 자리**.
 *
 * 이 화면의 쓰기 셋 가운데 **재고를 실제로 움직이는 것**이 이것이다 — 전표 생성은 장부에
 * 아무것도 하지 않고(`postImmediately: false`), 상신은 결재를 시작할 뿐이며, 원장이 바뀌는
 * 순간은 여기다. 그래서 본문을 만드는 자리를 따로 두고, 무엇이 실리는지가 한눈에 읽히게 한다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | **`businessDate`** | **그 전표의 출고 일시에서 뗀 날짜** | 산출 규칙(야간조 경계 등)이 정의돼 있지 않다. 실행 시각의 날짜를 쓰면 어제 낸 전표를 오늘 처리할 때 **원장이 오늘 자로 잡힌다** — 전표가 정본이다(감지기 M71) |
 * | **`occurredAt`** | **제출 순간** | 공유계약 C-1. 영업일과 갈라 싣는다 — 어제 낸 전표를 오늘 처리하면 두 값이 실제로 갈린다 |
 * | 그 밖의 값 | **싣지 않는다** | 계약의 `PostRequest`가 두 값뿐이다. 전표의 내용은 이미 서버에 있고 이 조작은 그것을 원장에 반영할 뿐이다 |
 * | **`If-Match`·`Idempotency-Key`** | **싣지 않는다** | 헤더는 `queries.ts`가 만든다(계획 결정 13) |
 *
 * **두 파생을 전표 생성과 같은 파일에서 가져온다**(`issue-request.ts`). 「영업일은 출고 일시의
 * 날짜다」·「발생 시각은 제출 순간이다」는 **한 규칙**이라 자리를 둘로 두면 한쪽만 고쳐진다 —
 * 그때 같은 전표가 생성과 전기에서 서로 다른 영업일로 원장에 남는다.
 *
 * **막는 가지를 두지 않는다.** 전표 생성 본문(`toGoodsIssueRequest`)은 사용자가 친 값을 다루므로
 * 채워지지 않은 자리를 마지막으로 걸렀지만, 여기 들어오는 값은 **전부 서버가 준 전표에서 온다** —
 * 사용자가 고칠 칸이 없으니 화면이 막을 자리도 없다. 형식 가지를 만들면 닿을 수 없는 안전망이
 * 된다(계획 §12-18 · `validation.ts`가 날짜 형식을 재지 않는 것과 같은 논거).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type PostRequest = components['schemas']['PostRequest'];

export interface PostRequestInput {
  /**
   * 전기할 전표. **출고 일시 하나만 쓴다** — 나머지 값은 서버가 이미 들고 있고, 넘겨받으면
   * 「본문에 실리지 않는 값을 왜 받는가」가 생긴다.
   */
  issue: Pick<IssueView, 'issuedAt'>;
  /**
   * 제출 순간의 시각. **인자로 받는다** — 함수 안에서 `new Date()`를 부르면 순수하지 않아
   * 영업일이 어디서 나오는지를 고정 시각으로 검사할 수 없다.
   */
  now: Date;
}

export const toPostRequest = (input: PostRequestInput): PostRequest => ({
  businessDate: toBusinessDate(input.issue.issuedAt),
  occurredAt: toOccurredAt(input.now),
});
