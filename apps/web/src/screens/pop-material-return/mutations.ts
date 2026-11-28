import { createIdempotencyKey } from '@omf-mes/api-client';
import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { isRejected } from '../../patterns/outbox-policy';
import { toReceiveBody, type MaterialReturnReceive, type ReturnLine } from './lines';
import {
  enqueueMaterialReturn,
  postMaterialReturn,
  type MaterialReturn,
  type MaterialReturnOutboxEntry,
} from './outbox';

export type ReceiveOutcome =
  | { kind: 'received'; result: MaterialReturn }
  /** 연결이 없거나 응답을 못 받아 대기열에 넣었다 — 연결되면 같은 멱등 키로 나간다. */
  | { kind: 'queued' };

export interface ReceiveInput {
  lines: readonly ReturnLine[];
  workerNo: string;
}

/** 같은 시도인가를 가르는 값 — LOT · 수량 · 고른 W/O. */
const targetOf = (lines: readonly ReturnLine[]): string =>
  JSON.stringify(
    lines.map((line) => [line.lotId, line.qtyText.trim(), line.pickedWorkOrderId] as const),
  );

/**
 * [반납 입고 (n건)] — 담은 줄을 한 건으로 보낸다(FR-002 · 시안 「POP 목록 한 번에 보내기」).
 *
 * ⭐ **멱등 키는 한 시도에 하나**(`docs/decisions.md` 결정 10). 응답을 못 받아 다시 누르면 같은 키 · 같은 본문(누른
 *    순간의 업무일 · 발생 시각)으로 보내 두 번 들어가지 않게 한다. 줄 · 수량이 바뀌면 새 시도다.
 * ⭐ 연결이 없거나 기다리면 풀리는 실패면 대기열에 넣는다 — 다른 POP 화면과 같다(`outbox.ts`).
 * ⛔ 서버가 거절한 것(400 · 403 · 409)은 대기열에 넣지 않고 던진다 — 화면이 서버 문구를 그대로 보인다.
 */
export const useReceiveMaterialReturn = () => {
  const { client } = useApiClient();
  const attempt = useRef<{ target: string; key: string; body: MaterialReturnReceive } | null>(null);

  const entryFor = (input: ReceiveInput): MaterialReturnOutboxEntry => {
    const target = targetOf(input.lines);
    if (attempt.current === null || attempt.current.target !== target) {
      attempt.current = {
        target,
        key: createIdempotencyKey(),
        body: toReceiveBody(input.lines, new Date()),
      };
    }

    return {
      idempotencyKey: attempt.current.key,
      workerNo: input.workerNo,
      body: attempt.current.body,
    };
  };

  return useMutation({
    mutationFn: async (input: ReceiveInput): Promise<ReceiveOutcome> => {
      const entry = entryFor(input);

      if (!globalThis.navigator.onLine) {
        enqueueMaterialReturn(entry);
        attempt.current = null;
        return { kind: 'queued' };
      }

      try {
        const result = await postMaterialReturn(client, entry);
        attempt.current = null;
        return { kind: 'received', result };
      } catch (error) {
        if (isRejected(error)) throw error;
        enqueueMaterialReturn(entry);
        attempt.current = null;
        return { kind: 'queued' };
      }
    },
  });
};
