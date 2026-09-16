/**
 * P-04-05 의 쓰기 — 생성 · 상자 넣기 · 빼기 · 마감.
 *
 * ⛔⛔ **마감은 되돌릴 수 없다**(설계 §4-6 — 취소·해체 경로를 두지 않는다). 그래서 이 파일의
 *    규율은 「막는 것」에 쏠려 있다 — 한 번에 하나만 나가고, 판 번호를 늘 갱신하고, 거절을
 *    다섯 갈래로 갈라 담당이 **할 수 있는 조치**를 말한다.
 *
 * ⚠ **판 번호를 쓰기마다 갱신한다.** `:add-box`·`DELETE` 도 버전을 올린다(서버 확정
 *   2026-09-17). 생성할 때 받은 ETag 를 들고 있으면 마감이 409 로 막힌다.
 */

import { createIdempotencyKey } from '@omf-mes/api-client';
import { useCallback, useRef } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequestWithResponse } from '../../patterns/request';

import { toAddBoxRejection } from './add-box-rejection';
import type { ShippingUnitSnapshot } from './queries';
import type { AddBoxRejection, ShippingUnitDetail, ShippingUnitSummary } from './types';

export type AddBoxOutcome =
  | { kind: 'added'; snapshot: ShippingUnitSnapshot }
  | { kind: 'rejected'; rejection: AddBoxRejection };

const snapshotOf = (data: ShippingUnitDetail, response: Response): ShippingUnitSnapshot => ({
  unit: data,
  etag: response.headers.get('ETag'),
});

/**
 * 갓 만든 단위 — **상세가 아니다.**
 *
 * ⛔ **빈 `boxes`·`itemTotals` 를 지어 넣지 않는다.** 계약이 201 에 요약(`ShippingUnit`)을
 *    돌려주는 것은 새 단위에 아직 담긴 것이 없어서다. 화면이 거기에 빈 배열을 붙여 상세인 척
 *    만들면, 언젠가 계약이 「생성 직후에도 무언가 실린다」로 바뀌었을 때 그 사실을 아무도 못
 *    알아챈다. 상세는 상세 조회가 읽는다.
 */
export interface ShippingUnitCreated {
  unit: ShippingUnitSummary;
  etag: string | null;
}

export interface ShippingUnitWrites {
  createUnit: (shipmentId: number, typeCode: string) => Promise<ShippingUnitCreated>;
  addBox: (shippingUnitId: number, handlingUnitNo: string) => Promise<AddBoxOutcome>;
  removeBox: (shippingUnitId: number, handlingUnitId: number) => Promise<ShippingUnitSnapshot>;
  closeUnit: (shippingUnitId: number, etag: string) => Promise<ShippingUnitSnapshot>;
}

/**
 * 쓰기 넷.
 *
 * ⚠ **사번을 모르면 부르지 않는다**(공유계약 D-5). 빈 문자열로 떨어뜨리면 서버에 「사번이
 *   있다」로 나가고, 거절이 화면이 아니라 서버에서 난다.
 */
export const useShippingUnitWrites = (workerNo: string | null): ShippingUnitWrites => {
  const { client } = useApiClient();

  /*
   * ⛔ **재시도에 새 멱등 키를 붙이지 않는다.** 키가 매번 달라지면 서버는 같은 명령인 줄 모르고
   *    **두 번째 단위를 만든다** — 타임아웃 뒤 다시 누르는 것이 곧 빈 단위 하나다. 명령이
   *    바뀌면(다른 출하·다른 유형) 그때 새 키를 낸다(전례 `patterns/master/use-master-write`).
   */
  const createKey = useRef<{ signature: string; key: string } | null>(null);

  const requireWorker = useCallback((): string => {
    if (workerNo === null) throw new Error('사번이 없어 출하 단위를 다룰 수 없습니다.');

    return workerNo;
  }, [workerNo]);

  const createUnit = useCallback(
    async (shipmentId: number, shippingUnitTypeCode: string): Promise<ShippingUnitCreated> => {
      const worker = requireWorker();
      const signature = `${String(shipmentId)}|${shippingUnitTypeCode}`;

      if (createKey.current?.signature !== signature) {
        createKey.current = { signature, key: createIdempotencyKey() };
      }

      const { data, response } = await runRequestWithResponse(() =>
        client.POST('/logistics/shipping-units', {
          params: { header: { 'Idempotency-Key': createKey.current!.key, 'X-Worker-No': worker } },
          body: { shipmentId, shippingUnitTypeCode },
        }),
      );

      /* 단위가 섰다 — 다음 생성은 같은 값이라도 «다른» 명령이다. */
      createKey.current = null;

      return { unit: data, etag: response.headers.get('ETag') };
    },
    [client, requireWorker],
  );

  /**
   * 상자를 넣는다.
   *
   * ⭐ **거절을 던지지 않고 값으로 돌려준다.** 다섯 갈래가 전부 「담당이 할 일이 다른」 정상
   *    상태다(설계 §5-3) — 예외로 다루면 화면이 한 덩어리 오류로 보이고, 그러면 스캐너를 든
   *    사람은 무엇을 해야 할지 모른다.
   *
   * ⚠ **같은 상자를 다시 읽는 것은 정상이다** — 서버가 멱등 200 으로 받는다(버전도 안 오른다).
   *   스캐너가 두 번 쏘는 일이 흔하다.
   */
  const addBox = useCallback(
    async (shippingUnitId: number, handlingUnitNo: string): Promise<AddBoxOutcome> => {
      const worker = requireWorker();

      try {
        const { data, response } = await runRequestWithResponse(() =>
          client.POST('/logistics/shipping-units/{shippingUnitId}:add-box', {
            params: {
              path: { shippingUnitId },
              header: {
                'Idempotency-Key': createIdempotencyKey(),
                'X-Worker-No': worker,
              },
            },
            body: { handlingUnitNo: handlingUnitNo.trim() },
          }),
        );

        return { kind: 'added', snapshot: snapshotOf(data, response) };
      } catch (cause) {
        return { kind: 'rejected', rejection: toAddBoxRejection(cause) };
      }
    },
    [client, requireWorker],
  );

  /**
   * 상자를 뺀다 — **마감 전에만**(설계 §5-6).
   *
   * ⚠ 계약이 204 가 아니라 **200 + 상세**를 돌려준다 — 화면이 목록과 품목별 합을 그 자리에서
   *   다시 그린다. `seq` 는 재부여하지 않는다.
   */
  const removeBox = useCallback(
    async (shippingUnitId: number, handlingUnitId: number): Promise<ShippingUnitSnapshot> => {
      const { data, response } = await runRequestWithResponse(() =>
        client.DELETE('/logistics/shipping-units/{shippingUnitId}/boxes/{handlingUnitId}', {
          params: { path: { shippingUnitId, handlingUnitId } },
        }),
      );

      return snapshotOf(data, response);
    },
    [client],
  );

  /**
   * 마감한다. **되돌릴 수 없다.**
   *
   * ⛔ **`If-Match` 는 «마지막 쓰기»가 준 값이어야 한다.** 생성 때 받은 것을 들고 있으면 상자를
   *    넣은 만큼 판이 올라 있어 409 로 막힌다 — 그때는 다시 읽어 새 값으로 건다.
   */
  const closeUnit = useCallback(
    async (shippingUnitId: number, etag: string): Promise<ShippingUnitSnapshot> => {
      const worker = requireWorker();

      const { data, response } = await runRequestWithResponse(() =>
        client.POST('/logistics/shipping-units/{shippingUnitId}:close', {
          params: {
            path: { shippingUnitId },
            header: {
              'If-Match': etag,
              'Idempotency-Key': createIdempotencyKey(),
              'X-Worker-No': worker,
            },
          },
        }),
      );

      return snapshotOf(data, response);
    },
    [client, requireWorker],
  );

  return { createUnit, addBox, removeBox, closeUnit };
};
