import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { toRoutingOperationOptions } from './routing-operation-options';

type RoutingOperation = components['schemas']['RoutingOperation'];

const operation = (overrides: Partial<RoutingOperation> = {}): RoutingOperation => ({
  routingOperationId: 8001,
  routingId: 9001,
  operationSeq: 10,
  processId: 3001,
  operationName: '합성 공정 A',
  mesManaged: true,
  materialInputManaged: false,
  productionResultManaged: true,
  inspectionManaged: false,
  outputLotRequired: false,
  equipmentRequired: false,
  moldRequired: false,
  standardCycleTimeSec: null,
  standardYieldRate: null,
  ...overrides,
});

/**
 * M32 — **Rev 여럿을 한 목록으로 편다.**
 *
 * 최신 Rev만 쓰면 구성품이 가리키는 옛 Rev의 줄이 선택칸에서 사라져
 * 사용자가 값을 잃은 줄 안다.
 */
describe('toRoutingOperationOptions', () => {
  it('Rev가 없으면 선택지도 없다', () => {
    expect(toRoutingOperationOptions([])).toEqual({ entries: [], incomplete: false });
  });

  it('Rev 하나의 공정을 위치 번호와 함께 낸다', () => {
    const options = toRoutingOperationOptions([
      {
        routingVersion: 3,
        operations: [
          operation({ routingOperationId: 8001, operationName: '합성 공정 A' }),
          operation({ routingOperationId: 8002, operationName: '합성 공정 B' }),
        ],
      },
    ]);

    expect(options.entries.map((entry) => entry.label)).toEqual([
      'Rev 3 · 1. 합성 공정 A',
      'Rev 3 · 2. 합성 공정 B',
    ]);
    expect(options.entries.map((entry) => entry.value)).toEqual(['8001', '8002']);
  });

  /* **최신 Rev만 쓰면 여기서 잡힌다.** */
  it('Rev 여럿의 공정을 모두 담는다', () => {
    const options = toRoutingOperationOptions([
      { routingVersion: 3, operations: [operation({ routingOperationId: 8001 })] },
      { routingVersion: 2, operations: [operation({ routingOperationId: 8002 })] },
      { routingVersion: 1, operations: [operation({ routingOperationId: 8003 })] },
    ]);

    expect(options.entries).toHaveLength(3);
    expect(options.entries.map((entry) => entry.value)).toEqual(['8001', '8002', '8003']);
  });

  /* 받은 순서를 지킨다 — 화면이 다시 정렬하면 서버가 정한 순서와 둘이 생긴다. */
  it('받은 Rev 순서를 바꾸지 않는다', () => {
    const options = toRoutingOperationOptions([
      { routingVersion: 1, operations: [operation({ routingOperationId: 8003 })] },
      { routingVersion: 3, operations: [operation({ routingOperationId: 8001 })] },
    ]);

    expect(options.entries.map((entry) => entry.label)).toEqual([
      'Rev 1 · 1. 합성 공정 A',
      'Rev 3 · 1. 합성 공정 A',
    ]);
  });

  /* 각 Rev 안에서 위치를 새로 센다 — 앞 Rev의 개수가 이어지면 사용자가 화면에서 찾지 못한다. */
  it('위치 번호를 Rev마다 1부터 다시 센다', () => {
    const options = toRoutingOperationOptions([
      {
        routingVersion: 2,
        operations: [
          operation({ routingOperationId: 8001 }),
          operation({ routingOperationId: 8002 }),
        ],
      },
      { routingVersion: 1, operations: [operation({ routingOperationId: 8003 })] },
    ]);

    expect(options.entries[2]?.label).toBe('Rev 1 · 1. 합성 공정 A');
  });

  /* 계약이 「이 값을 그대로 보여주지 않는다」고 못 박았다 — 채번 방식은 화면이 알 자료가 아니다. */
  it('서버 채번 순서 값을 라벨에 담지 않는다', () => {
    const options = toRoutingOperationOptions([
      { routingVersion: 1, operations: [operation({ operationSeq: 70 })] },
    ]);

    expect(options.entries[0]?.label).toBe('Rev 1 · 1. 합성 공정 A');
    expect(options.entries[0]?.label).not.toContain('70');
  });

  /**
   * **받지 못한 Rev와 공정이 없는 Rev는 다른 사실이다.**
   * 뭉치면 조회 실패가 「공정이 없다」로 조용히 읽힌다.
   */
  it('받지 못한 Rev가 있으면 불완전으로 표시한다', () => {
    const options = toRoutingOperationOptions([
      { routingVersion: 2, operations: [operation({ routingOperationId: 8001 })] },
      { routingVersion: 1, operations: null },
    ]);

    expect(options.entries).toHaveLength(1);
    expect(options.incomplete).toBe(true);
  });

  it('공정이 없는 Rev는 불완전이 아니다', () => {
    const options = toRoutingOperationOptions([
      { routingVersion: 2, operations: [] },
      { routingVersion: 1, operations: [operation()] },
    ]);

    expect(options.entries).toHaveLength(1);
    expect(options.incomplete).toBe(false);
  });
});
