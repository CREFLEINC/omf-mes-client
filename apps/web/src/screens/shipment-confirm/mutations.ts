import type { components } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import {
  summarizeOutcomes,
  toFailureKind,
  type ConfirmOutcome,
  type ConfirmSummary,
} from './confirm-run';
import { shipmentConfirmKeys, shipmentDetailPath } from './queries';
import type { ShipmentRow } from './types';

type ShipmentCancelRequestBody = components['schemas']['ShipmentCancelRequest'];

/**
 * 이 화면의 쓰기.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** 서버가 준 구조화 코드. `message` 원문은 보지 않는다(공유계약 A-9 ⓑ). */
const codeOf = (error: unknown): string | undefined => {
  if (!isRecord(error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
};

export interface ConfirmRunState {
  isRunning: boolean;
  /** 아직 한 번도 돌지 않았으면 `null`. */
  summary: ConfirmSummary | null;
}

export interface ConfirmRunner extends ConfirmRunState {
  run: (rows: readonly ShipmentRow[]) => Promise<void>;
  reset: () => void;
}

/**
 * 다건 확정.
 *
 * ⭐⭐ **건별로 순차 실행하고 결과를 건별로 모은다**(§6). 확정은 되돌릴 수 없으므로 중간에
 * 실패해도 **앞서 확정된 건은 확정된 채로 남고**, 화면은 그것을 성공으로 보여야 한다.
 *
 * ⭐ **건마다 상세를 먼저 읽는다** — `If-Match` 가 필수인데 그 토큰은 **상세 GET 의 ETag**로만
 * 온다(계약 명시). 목록 응답에는 건별 토큰이 없다. 그래서 요청이 2N 번이 되고, 그 사실을
 * 줄이려면 계약이 목록에 판 번호를 싣거나 일괄 오퍼레이션을 내야 한다.
 *
 * ⭐ **멱등 키를 출하마다 붙들고 다시 시도해도 같은 키를 쓴다**(공유계약 C-1). 새로 만들면
 * 통신이 끊긴 뒤 재시도할 때 **같은 출하가 두 번 확정될 수 있다.**
 */
export const useConfirmRunner = (): ConfirmRunner => {
  const { client, etags } = useApiClient();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ConfirmRunState>({ isRunning: false, summary: null });
  /*
   * 출하별 멱등 키. **성공했을 때만 지운다** — 실패한 건은 키를 붙들고 있어야 다시 시도할 때
   * 같은 키가 나가고, 그래야 원장이 중복을 막는다.
   */
  const keys = useRef(new Map<number, string>());

  /**
   * 직전 결과만 지운다.
   *
   * ⛔ **멱등 키는 지우지 않는다.** 실패한 건을 다시 확정할 때 새 키가 나가면 **같은 출하가 두
   * 번 확정될 수 있다** — 앞 요청이 서버에 닿았는데 응답만 못 받은 경우가 그것이다(공유계약
   * C-1). 키는 **확정에 성공했을 때만** 버린다.
   */
  const reset = useCallback(() => {
    setState({ isRunning: false, summary: null });
  }, []);

  const run = useCallback(
    async (rows: readonly ShipmentRow[]) => {
      setState({ isRunning: true, summary: null });
      const outcomes: ConfirmOutcome[] = [];

      for (const row of rows) {
        const key = keys.current.get(row.shipmentId) ?? crypto.randomUUID();
        keys.current.set(row.shipmentId, key);

        /*
         * 상세를 읽어 ETag 를 보관소에 앉힌다. 실패하면 «확정을 시도하지 않는다» — 토큰 없이
         * 보내면 서버가 412 로 막을 뿐이고, 그 실패는 사용자가 고칠 수 있는 것이 아니다.
         */
        const detail = await client.GET('/logistics/shipments/{shipmentId}', {
          params: { path: { shipmentId: row.shipmentId } },
        });
        const ifMatch = etags.ifMatch(shipmentDetailPath(row.shipmentId));

        if (detail.error !== undefined || ifMatch === undefined) {
          outcomes.push({
            shipmentId: row.shipmentId,
            shipmentNo: row.shipmentNo,
            failure: 'lock-unavailable',
          });
          continue;
        }

        const result = await client.POST('/logistics/shipments/{shipmentId}:confirm', {
          params: {
            path: { shipmentId: row.shipmentId },
            header: { 'Idempotency-Key': key, 'If-Match': ifMatch },
          },
        });

        if (result.error === undefined) {
          /* 확정된 건의 키는 버린다 — 다음에 같은 출하를 다시 확정할 일은 없지만, 남겨 두면
           * 이 화면이 사는 동안 지문이 낡은 채로 붙어 있는다. */
          keys.current.delete(row.shipmentId);
          outcomes.push({ shipmentId: row.shipmentId, shipmentNo: row.shipmentNo, failure: null });
          continue;
        }

        outcomes.push({
          shipmentId: row.shipmentId,
          shipmentNo: row.shipmentNo,
          failure: toFailureKind(result.response.status, codeOf(result.error)),
        });
      }

      /* 한 건이라도 확정됐으면 목록이 낡았다 — 성공분이 목록에서 빠져야 재시도가 정확해진다. */
      await queryClient.invalidateQueries({ queryKey: shipmentConfirmKeys.all });
      setState({ isRunning: false, summary: summarizeOutcomes(outcomes) });
    },
    [client, etags, queryClient],
  );

  return { ...state, run, reset };
};

export interface CancelRequestOptions {
  /** 겨눈 출하. 잠금 토큰이 이 건의 상세에서 나온다 — 고르기 전에는 `null`이다. */
  shipmentId: number | null;
  onSuccess: () => void;
}

/**
 * 취소 «요청» — 결재로 올라간다(§5-8).
 *
 * ⛔ 이 호출이 취소를 «실행»하지 않는다. 승인된 뒤의 실행(`:cancel`)은 이 화면에 두지 않았다 —
 * 승인 완료를 가릴 축이 계약에 없어(G-2) 화면이 그 조건을 판정할 수 없다.
 *
 * ⭐ `keyLifetime: 'until-applied'` — 되돌리기 어려운 쓰기다. 결재가 두 벌 올라가면 승인자가
 * 무엇을 보는지 알 수 없다.
 */
export const useCancelRequestMutation = (
  options: CancelRequestOptions,
): MasterWriteResult<ShipmentCancelRequestBody> => {
  const { client } = useApiClient();
  const { shipmentId } = options;

  return useMasterWrite<ShipmentCancelRequestBody, unknown>({
    request: (body, headers) => {
      if (shipmentId === null) {
        throw new Error('출하를 고르기 전에는 취소 요청을 보내지 않습니다.');
      }

      return client.POST('/logistics/shipments/{shipmentId}:request-cancel', {
        params: {
          path: { shipmentId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            /* ⛔ 계약이 이 헤더를 필수로 둔다 — 없으면 빈 값을 채우지 않고 멈춘다. */
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      });
    },
    /* ⭐ 토큰은 «그 출하의 상세»가 내린다(공유계약 B-1). 고르기 전에는 열지 않는다. */
    etagPath: shipmentId === null ? null : shipmentDetailPath(shipmentId),
    invalidateKeys: [shipmentConfirmKeys.all],
    knownFields: ['reason'],
    keyLifetime: 'until-applied',
    onSuccess: options.onSuccess,
  });
};
