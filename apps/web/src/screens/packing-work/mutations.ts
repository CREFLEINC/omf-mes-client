import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { packingWorkKeys } from './queries';
import type {
  HandlingUnit,
  HandlingUnitCreate,
  HandlingUnitDetailResponse,
  HandlingUnitPack,
} from './types';

/**
 * 사람이 누르는 쓰기 둘. **하나로 묶지 않는다** — 계약이 두 오퍼레이션으로 갈라 두었고
 * (`POST …/handling-units` 로 만들고 `:pack` 으로 닫는다), 그 경계가 곧 「번호를 언제 아는가」의
 * 자리다(스펙 §3 · §5-6).
 *
 * ⚠ **둘 다 사번 헤더가 필요하다**(공유계약 D-5). 인증이 아니라 귀속이며, 없으면 서버가
 * 거부한다 — 부르는 쪽이 값을 확보한 뒤에만 포장을 연다.
 *
 * ⛔ **낙관적 잠금을 걸지 않는다**(`etagPath: null`). 등록은 새 행을 만드는 쓰기라 잠글 대상이
 * 없고, 확정의 `If-Match` 는 계약이 **선택**으로 두었다. 이 화면은 자기가 방금 만든 포장만
 * 확정하므로 그사이 남이 고칠 자원이 아니다 — 겹치면 서버가 409 로 되돌린다.
 */

/**
 * ⛔ **인라인으로 낼 자리가 없다.** `knownFields` 는 「이 화면에 그 오류를 놓을 칸이 있다」는
 * 선언이라, 없는 칸을 적으면 서버가 준 사유가 배너에서도 빠져 **어디에도 표시되지 않는다.**
 * 유형은 목록에서 고르고 수량은 담기 전에 화면이 먼저 막으므로, 확정 단계에서 칸으로 돌아갈
 * 오류가 없다.
 */
const NO_INLINE_FIELDS: readonly string[] = [];

export interface CreateOptions {
  workerNo: string;
  onSuccess: (unit: HandlingUnit) => void;
}

/**
 * ① 취급 단위 등록 — **첫 내용물을 담을 때 부른다.**
 *
 * ⭐ **번호를 서버가 매기므로 화면이 지어낼 수 없다**(스펙 §4-A 「자동」). 스펙 §3 이 담는
 * 동안 번호를 보이라 해서 이 시점에 만든다.
 *
 * ⚠ **중단하면 빈 포장이 남는다** — 포장 해체 경로가 없다(스펙 §8-4). 설계 회신
 * (`omf-mes#392` ②)이 오면 이 호출의 시점이 바뀔 수 있다. 그때 바뀌는 것은 부르는 자리이지
 * 이 훅이 아니다.
 *
 * ⛔ **`contents` 를 여기 싣지 않는다.** 계약이 「초기 구성」으로 받아 주지만, 담는 동안
 * 내용물이 계속 바뀌므로 확정 한 번에 전량을 싣는 쪽이 집합 치환(A-5)과 어긋나지 않는다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 되돌릴 수 없는 쓰기다. 통신이 끊긴 뒤 다시 담으면
 * 서버가 다른 쓰기로 보고 **포장을 두 번 만든다.**
 */
export const useHandlingUnitCreate = ({
  workerNo,
  onSuccess,
}: CreateOptions): MasterWriteResult<HandlingUnitCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<HandlingUnitCreate, HandlingUnitDetailResponse>({
    request: (body, headers) =>
      client.POST('/inventory/handling-units', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: null,
    /* 새 포장이 생기면 상위 포장 후보가 늘어난다. */
    invalidateKeys: [packingWorkKeys.parents],
    knownFields: NO_INLINE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      onSuccess(data.handlingUnit);
    },
  });
};

export interface PackOptions {
  handlingUnitId: number | null;
  workerNo: string;
  onSuccess: () => void;
}

/**
 * ② 포장 확정 — 포장 단위와 내용물 N 행이 **한 트랜잭션**으로 닫힌다(스펙 §5-6 · 공유계약 B-8).
 *
 * ⛔ **되돌릴 수 없다.** 포장 해체 화면이 인벤토리에 없다(스펙 §8-4). 그래서 멱등 키 수명이
 * `until-applied` 이고, 담은 것이 바뀌면 지문이 새 키를 준다.
 *
 * ⚠ **내용물이 비면 400, 이미 확정된 포장이면 409 다**(계약). 둘은 사용자가 할 일이 갈리므로
 * 배너에서 따로 말한다(`error-banner.ts`).
 */
export const useHandlingUnitPack = ({
  handlingUnitId,
  workerNo,
  onSuccess,
}: PackOptions): MasterWriteResult<HandlingUnitPack> => {
  const { client } = useApiClient();

  return useMasterWrite<HandlingUnitPack, HandlingUnitDetailResponse>({
    request: (body, headers) => {
      if (handlingUnitId === null) {
        throw new Error('포장 단위가 없으면 확정하지 않습니다.');
      }

      return client.POST('/inventory/handling-units/{handlingUnitId}:pack', {
        params: {
          path: { handlingUnitId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      });
    },
    etagPath: null,
    invalidateKeys: [packingWorkKeys.parents],
    knownFields: NO_INLINE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
