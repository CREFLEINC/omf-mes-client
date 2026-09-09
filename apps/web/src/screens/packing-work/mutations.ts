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
 * 사람이 누르는 쓰기 **셋**.
 *
 * | 언제 | 무엇 | 오프라인 |
 * | --- | --- | --- |
 * | 첫 줄을 담을 때 | `POST /inventory/handling-units` — 포장 단위를 만든다 | ⛔ 성립하지 않는다 |
 * | 확정 | `POST …/{handlingUnitId}:pack` — 내용물과 함께 닫는다 | ✅ 큐가 받는다 |
 * | 담다가 그만둘 때 | `DELETE …/{handlingUnitId}` — 빈 포장을 거둔다 | ⛔ 온라인에서만 |
 *
 * ⭐ **왜 오프라인에서 시작할 수 없나** — 포장번호를 서버가 매기고(스펙 §4-A 「자동」) 확정이
 * 그 번호를 **경로 인자**로 받는다. 단말이 만들 수 없는 값이라 큐에 담을 수조차 없다
 * (스펙 §6 · C-5 온라인 전용 표준형 4항 준용).
 *
 * ⚠ **사번 헤더가 필요하다**(공유계약 D-5). 인증이 아니라 귀속이며, 없으면 서버가 거부한다.
 */

/**
 * ⛔ **인라인으로 낼 자리가 없다.** `knownFields` 는 「이 화면에 그 오류를 놓을 칸이 있다」는
 * 선언이라, 없는 칸을 적으면 서버가 준 사유가 배너에서도 빠져 **어디에도 표시되지 않는다.**
 * 유형은 목록에서 고르고 수량은 담기 전에 화면이 먼저 막으므로, 이 단계에서 칸으로 돌아갈
 * 오류가 없다.
 */
const NO_INLINE_FIELDS: readonly string[] = [];

export interface CreateOptions {
  workerNo: string;
  onSuccess: (unit: HandlingUnit) => void;
}

/**
 * 담기 시작 — **첫 줄을 담을 때 한 번 부른다.**
 *
 * ⭐ **번호를 서버가 매기므로 화면이 지어낼 수 없다**(스펙 §4-A 「자동」). 이 응답이 와야
 * §3 도면의 포장 번호 자리가 채워지고, 확정이 부를 경로가 생긴다.
 *
 * ⛔ **낙관적 잠금을 걸지 않는다**(`etagPath: null`). 새 행을 만드는 쓰기라 잠글 대상이 없다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 통신이 끊긴 뒤 다시 누르면 서버가 다른 쓰기로 보고
 * **빈 포장을 두 개 만든다.**
 *
 * ⚠ **이 자리에 「확정 전 취소를 두지 않는다」가 적혀 있었다**(`#953`). 그 판단은 화면이 한 번
 * 호출이던 때의 것이고 — 지울 대상이 생기지 않으니 맞는 말이었다 — 두 호출로 돌아오면서
 * 전제가 사라졌다. 취소는 아래 `useHandlingUnitDiscard` 가 갖는다. 함께 적혀 있던 걱정
 * (「되돌리면 오프라인 포장 시작이 무너진다」)은 그대로 실현됐고, **그것을 알고 고른 것이다**
 * (사용자 결정 2026-09-09 · 얻은 것은 자정 넘김 이중 적재 차단 · C-8).
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
  workerNo: string;
  /** 확정할 포장 단위. 담기 시작이 만들어 준 값이다 — 없으면 부를 수 없다. */
  handlingUnitId: number | null;
  onSuccess: () => void;
}

/**
 * 확정 — **담은 것을 통째로 실어 포장을 닫는다.**
 *
 * ⛔ **`If-Match` 를 싣지 않는다**(C-9). 이 쓰기는 오프라인 대상이라 큐에 밀릴 수 있고, 담긴
 * 뒤 서버의 포장이 앞서 나가면 토큰이 낡아 **기다렸다는 이유로 거부된다.**
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 되돌릴 화면이 없는 쓰기다(스펙 §8-4). 통신이 끊긴
 * 뒤 다시 누르면 서버가 다른 쓰기로 보고 같은 포장을 두 번 닫으려 한다.
 */
export const useHandlingUnitPack = ({
  workerNo,
  handlingUnitId,
  onSuccess,
}: PackOptions): MasterWriteResult<HandlingUnitPack> => {
  const { client } = useApiClient();

  return useMasterWrite<HandlingUnitPack, HandlingUnitDetailResponse>({
    request: (body, headers) =>
      client.POST('/inventory/handling-units/{handlingUnitId}:pack', {
        params: {
          path: { handlingUnitId: handlingUnitId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [packingWorkKeys.parents],
    knownFields: NO_INLINE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: () => {
      onSuccess();
    },
  });
};

export interface DiscardOptions {
  workerNo: string;
  handlingUnitId: number | null;
  onSuccess: () => void;
}

/**
 * 확정 전 취소 — **담다가 그만둔 빈 포장을 거둔다**(스펙 §5-7 · 공유계약 B-8-1③).
 *
 * ⭐ **이 화면이 이 경로를 갖는 이유** — 호출이 둘로 갈리면서 「포장 단위는 만들어졌고 내용물은
 * 아직 없는」 상태가 생겼다. 그대로 두면 번호만 있고 아무것도 담기지 않은 포장이 쌓인다.
 *
 * ⛔ **확정 뒤에는 이 경로로 지우지 않는다** — 서버가 409 로 막는다(§5-7). 확정 후 해체는
 * 화면이 없다(§8-4 · 이 화면 범위 밖).
 */
export const useHandlingUnitDiscard = ({
  workerNo,
  handlingUnitId,
  onSuccess,
}: DiscardOptions): MasterWriteResult<Record<string, never>> => {
  const { client } = useApiClient();

  return useMasterWrite<Record<string, never>, unknown>({
    request: (_body, headers) =>
      client.DELETE('/inventory/handling-units/{handlingUnitId}', {
        params: {
          path: { handlingUnitId: handlingUnitId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
      }),
    etagPath: null,
    invalidateKeys: [packingWorkKeys.parents],
    knownFields: NO_INLINE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: () => {
      onSuccess();
    },
  });
};
