import type { ApiClient, EtagStore } from '@omf-mes/api-client';

import { runRequest } from '../../patterns/request';
import type { WorkOrderReleaseBody } from './issue-request';

/**
 * 낙관적 잠금 토큰을 꺼낼 자리. 보관소가 응답 URL 의 경로로 키를 잡으므로 같은 모양을 만든다.
 *
 * ⚠ **이 경로가 필요한 것은 「토큰을 들고 있지 않은」 W/O 뿐이다.** 발행 응답이 토큰을 직접
 * 주므로 방금 만든 W/O 는 상세를 부르지 않는다. 이어받기로 되찾은 W/O 는 만들어진 순간을
 * 이 화면이 보지 못했으니 토큰이 없고, 그때만 여기로 온다.
 */
export const workOrderDetailPath = (workOrderId: number): string =>
  `/production/work-orders/${String(workOrderId)}`;

/**
 * 배포가 어디서 멈췄는가.
 *
 * ⭐ **이 구분이 사용자에게 하는 말을 바꾼다.**
 *
 * | 값 | 무슨 일이 있었나 | 화면이 할 말 |
 * | --- | --- | --- |
 * | `notSent` | 토큰을 못 얻어 **배포를 보내지도 못했다** | 「배포되지 않았습니다」 — 단언해도 된다 |
 * | `unknown` | 배포를 **보냈는데 답을 못 받았다** | 「확인되지 않았습니다」 — 단언하면 거짓일 수 있다 |
 *
 * ⛔ **상태 코드로 가르지 않는다.** 오류 정규화가 계약 형태의 본문을 만나면 **상태를 버리므로**
 * 400(거부)과 500(불명)이 화면에서 같은 모양이 된다(다른 화면도 같은 자리에서 막혔다). 그래서
 * **어디까지 갔는지**로 가른다 — 그것은 화면이 스스로 아는 사실이라 잃어버릴 수가 없다.
 */
export type ReleaseFailureStep = 'notSent' | 'unknown';

export class ReleaseFailure extends Error {
  readonly step: ReleaseFailureStep;
  readonly cause: unknown;

  constructor(step: ReleaseFailureStep, cause: unknown) {
    super(`배포 실패 (${step})`);
    this.name = 'ReleaseFailure';
    this.step = step;
    this.cause = cause;
  }
}

/**
 * 배포의 멱등 키를 들고 있는 자리. 대상마다 하나다.
 *
 * ⛔ **재시도마다 새 키를 내면** 「같은 키로 안전하게 다시 누른다」가 성립하지 않아 **이중
 * 배포**가 열린다. 반대로 **대상이 바뀌었는데 키를 물려주면** 다른 W/O 의 배포가 앞 응답으로
 * 대체된다 — 서버가 계약대로 실행 없이 앞 응답을 되돌려 주기 때문이다. 그래서 키와 대상
 * 식별자를 **함께** 들고 다닌다.
 */
export interface ReleaseKeyHolder {
  current: { workOrderId: number; key: string } | null;
}

export const releaseKeyFor = (holder: ReleaseKeyHolder, workOrderId: number): string => {
  if (holder.current === null || holder.current.workOrderId !== workOrderId) {
    holder.current = { workOrderId, key: crypto.randomUUID() };
  }

  return holder.current.key;
};

export interface ReleaseStepInput {
  client: ApiClient['client'];
  etags: EtagStore;
  workOrderId: number;
  body: WorkOrderReleaseBody;
  keyHolder: ReleaseKeyHolder;
  /**
   * 이미 들고 있는 낙관적 잠금 토큰. 없으면(`null`) 상세를 불러 얻는다.
   *
   * ⭐ **방금 발행한 W/O 는 값이 있다** — 발행 응답이 토큰을 직접 준다. **이어받기로 되찾은
   * W/O 는 없다** — 만들어진 순간을 이 화면이 보지 못했다. 두 경우가 여기서 갈린다.
   */
  ifMatch: string | null;
}

/**
 * 배포 한 걸음 — **토큰을 갖추고 배포를 낸다.**
 *
 * ```
 * (토큰이 없을 때만) GET  /production/work-orders/{id}
 *                    POST /production/work-orders/{id}:release  (멱등 키 · If-Match)
 * ```
 *
 * ⭐ **발행 직후에는 조회가 없다.** 발행 응답이 토큰을 주므로 호출이 셋에서 둘로 준다 —
 * 줄어든 한 걸음만큼 「만들어졌는데 배포가 안 끝나는」 창도 좁아진다.
 *
 * 발행에서 떼어 둔 이유는 **이것이 다시 시도되는 단위**이기 때문이다.
 */
export const releaseWorkOrder = async (input: ReleaseStepInput): Promise<void> => {
  let ifMatch = input.ifMatch ?? undefined;

  if (ifMatch === undefined) {
    try {
      /* 상세를 받아 두면 보관소에 토큰이 들어온다. 응답 값 자체는 여기서 쓰지 않는다. */
      await runRequest(() =>
        input.client.GET('/production/work-orders/{workOrderId}', {
          params: { path: { workOrderId: input.workOrderId } },
        }),
      );
      ifMatch = input.etags.ifMatch(workOrderDetailPath(input.workOrderId));
    } catch (cause) {
      throw new ReleaseFailure('notSent', cause);
    }
  }

  /*
   * ⛔ **빈 토큰으로 보내지 않는다.** 계약이 요구하는 헤더라 서버가 거부하고, 그 거부는
   * 「배포가 반려됐다」로 읽힌다 — 실제로는 **물어보지도 못한 것**이다.
   */
  if (ifMatch === undefined) throw new ReleaseFailure('notSent', undefined);

  try {
    await runRequest(() =>
      input.client.POST('/production/work-orders/{workOrderId}:release', {
        params: {
          path: { workOrderId: input.workOrderId },
          header: {
            'Idempotency-Key': releaseKeyFor(input.keyHolder, input.workOrderId),
            'If-Match': ifMatch,
          },
        },
        body: input.body,
      }),
    );
  } catch (cause) {
    /*
     * ⛔ **거부인지 불명인지 화면은 모른다** — 위 표를 참고. 되돌릴 수 없는 쓰기라 **모르는
     * 쪽으로 말한다.** 「안 됐다」고 단언했다가 실제로 됐으면 사용자가 두 번 발행한다.
     */
    throw new ReleaseFailure('unknown', cause);
  }
};
