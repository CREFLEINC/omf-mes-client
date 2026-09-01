import { useRef } from 'react';

import {
  stampSubmission,
  toMaterialIssueRequestBody,
  type MaterialIssueRequestInput,
  type SubmissionStamp,
} from './material-issue-request-body';
import type { MaterialIssueRequestCreate } from './types';

/**
 * 제출 순간을 고정한 채 본문을 만든다 — **`stampSubmission` 과 `toMaterialIssueRequestBody` 를
 * 잇는 유일한 자리.**
 *
 * ⭐ **이 파일이 있는 이유는 「배선」을 시험 가능한 것으로 만들기 위해서다.** 앞 회차에는 이
 * 두 줄이 `screen.tsx` 의 `publish()` 안에 그대로 있었고, 그 자리에서 `stamp.at` 을 `new Date()`
 * 로 바꿔도 **16,856개 시험이 전부 통과했다**(검증 발견 1). 감지기 둘이 각각 순수 함수와 공통
 * 훅만 보고 있어 **정작 결함이 사는 이음매가 비어 있었다.**
 *
 * 이음매가 끊기면 재시도마다 본문의 `businessDate`·`occurredAt` 이 달라져 공통 쓰기 훅의 지문이
 * 갈리고 **새 `Idempotency-Key`** 가 나간다. 서버는 중복 요청을 막지 않고(스펙 §6) 이 화면에는
 * 취소 경로가 없으므로, 같은 자재 요청 전표가 둘 쌓인다. 화면에는 아무 이상이 보이지 않는다.
 *
 * ⛔ **`screen.tsx` 가 이 훅을 거치지 않고 본문을 직접 조립하지 않는다.** 직접 조립하면 이
 * 파일의 감지기 밖으로 나간다.
 *
 * ⛔ **도장을 손으로 버리는 자리를 두지 않는다.** 「값이 달라졌는가」의 유일한 판정자는
 * `stampSubmission` 의 지문이다. 상태가 바뀔 때마다 ref 를 비우면, 사용자가 값을 고쳤다가
 * **되돌렸을 때** 보낼 값이 첫 시도와 완전히 같은데도 새 키가 나간다(검증 발견 3).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export interface PublishSubmission {
  /**
   * 지금 초안으로 보낼 본문. 채워지지 않은 자리가 있으면 `null` 이다.
   *
   * 같은 값으로 다시 부르면 **앞서 찍은 순간이 그대로 실려** 같은 본문이 나온다.
   */
  build: (input: MaterialIssueRequestInput) => MaterialIssueRequestCreate | null;
}

export const usePublishSubmission = (): PublishSubmission => {
  const stampRef = useRef<SubmissionStamp | null>(null);

  return {
    build: (input) => {
      const stamp = stampSubmission(stampRef.current, input, new Date());

      stampRef.current = stamp;

      return toMaterialIssueRequestBody(input, stamp.at);
    },
  };
};
