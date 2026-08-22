import { describe, expect, it } from 'vitest';

import {
  toConcessionCardinality,
  toConcessionCardView,
  toListReference,
  type ConditionReferenceStates,
  type ListReferenceSource,
} from './conditions';
import type { Concession, ConcessionListResponse } from './types';

const concession = (approvalRequestId = 31, concessionId = 501): Concession => ({
  concessionId,
  concessionNo: 'SYNTH-CN-501',
  nonconformanceId: 701,
  lotId: 801,
  approvedQty: 10,
  consumedQty: 2,
  uomId: 901,
  validFrom: '2026-08-22',
  approvalRequestId,
  statusCode: 'SYNTH-ACTIVE',
  usable: true,
});

const response = (items: Concession[], total: number): ConcessionListResponse => ({
  items,
  page: { page: 1, size: 2, total },
});

describe('toConcessionCardinality', () => {
  it('total과 items가 모두 0일 때만 연결 없음으로 판정한다', () => {
    expect(toConcessionCardinality(31, response([], 0))).toEqual({ kind: 'none' });
    expect(toConcessionCardinality(31, response([], 1))).toEqual({ kind: 'unsafe' });
    expect(toConcessionCardinality(31, response([concession()], 0))).toEqual({ kind: 'unsafe' });
  });

  it('정확히 한 건이고 요청 번호가 일치할 때만 특채 번호를 노출한다', () => {
    const source = response([concession()], 1);
    const before = structuredClone(source);

    expect(toConcessionCardinality(31, source)).toEqual({ kind: 'one', concessionId: 501 });
    expect(source).toEqual(before);
  });

  it.each([
    response([concession(99)], 1),
    response([concession(), concession(31, 502)], 2),
    response([concession()], 2),
  ])('불일치·중복·개수 모순은 안전하게 특정하지 않는다', (source) => {
    expect(toConcessionCardinality(31, source)).toEqual({ kind: 'unsafe' });
  });
});

const references: ConditionReferenceStates = {
  uom: { kind: 'named', name: 'EA' },
  workOrder: { kind: 'named', name: 'SYNTH-WO-001' },
  process: { kind: 'named', name: '합성 공정' },
  customer: { kind: 'named', name: '합성 고객' },
};

describe('toConcessionCardView', () => {
  it('조건 사실값과 참조 이름만 표시하고 내부 ID는 view로 운반하지 않는다', () => {
    const source: Concession = {
      ...concession(),
      concessionId: 99_501,
      nonconformanceId: 99_701,
      lotId: 99_801,
      uomId: 99_901,
      validTo: '2026-09-30',
      allowedWorkOrderId: 99_201,
      allowedProcessId: 99_301,
      allowedCustomerId: 99_401,
      remarks: '합성 비고',
      usable: false,
    };
    const before = structuredClone(source);

    const view = toConcessionCardView(source, references);

    expect(view).toEqual({
      concessionNo: 'SYNTH-CN-501',
      approvedQty: '10',
      consumedQty: '2',
      uom: 'EA',
      validity: '2026-08-22 – 2026-09-30',
      statusCode: 'SYNTH-ACTIVE',
      usable: '사용 불가',
      remarks: '합성 비고',
      workOrder: 'SYNTH-WO-001',
      process: '합성 공정',
      customer: '합성 고객',
    });
    expect(JSON.stringify(view)).not.toMatch(/\b(99501|99701|99801|99901|99201|99301|99401)\b/);
    expect(source).toEqual(before);
  });

  it('nullable 허용 축만 제한 없음으로 보고 vocabulary 없는 배열은 추측하지 않는다', () => {
    const source: Concession = {
      ...concession(),
      allowedWorkOrderId: 1_201,
      allowedCustomerId: 1_401,
      unrestrictedAxes: ['SYNTH-UNDEFINED-AXIS'],
    };
    const unavailable: ConditionReferenceStates = {
      uom: { kind: 'unknown' },
      workOrder: { kind: 'failed' },
      process: { kind: 'loading' },
      customer: { kind: 'truncated' },
    };

    expect(toConcessionCardView(source, unavailable)).toMatchObject({
      uom: '참조 이름을 확인할 수 없음',
      workOrder: '참조 이름 조회 실패',
      process: '제한 없음',
      customer: '참조 목록이 잘려 이름을 확인할 수 없음',
    });
  });

  it('참조 조회의 대기·실패·잘림·미확인과 공백 이름을 서로 구분한다', () => {
    const source: Concession = {
      ...concession(),
      allowedWorkOrderId: 1_201,
      allowedProcessId: 1_301,
      allowedCustomerId: 1_401,
    };

    expect(
      toConcessionCardView(source, {
        uom: { kind: 'loading' },
        workOrder: { kind: 'failed' },
        process: { kind: 'truncated' },
        customer: { kind: 'named', name: '   ' },
      }),
    ).toMatchObject({
      uom: '참조 이름 불러오는 중',
      workOrder: '참조 이름 조회 실패',
      process: '참조 목록이 잘려 이름을 확인할 수 없음',
      customer: '참조 이름을 확인할 수 없음',
    });
  });

  it('공백 사실값은 빈칸으로 노출하지 않고 usable은 서버 값을 재계산하지 않는다', () => {
    const source: Concession = {
      ...concession(),
      concessionNo: ' ',
      statusCode: '',
      approvedQty: 0,
      consumedQty: 20,
      validFrom: '2020-01-01',
      remarks: ' \n ',
      usable: true,
    };

    expect(toConcessionCardView(source, references)).toMatchObject({
      concessionNo: '특채번호 미제공',
      approvedQty: '0',
      validity: '2020-01-01 – 종료일 없음',
      statusCode: '상태 미제공',
      usable: '사용 가능',
      remarks: '등록된 비고가 없습니다',
    });
  });
});

const listReference = (overrides: Partial<ListReferenceSource> = {}): ListReferenceSource => ({
  entries: [{ id: 901, name: 'SYNTH-EA · 합성 낱개' }],
  total: 1,
  isError: false,
  isLoading: false,
  ...overrides,
});

describe('toListReference', () => {
  it('잘린 목록이어도 대상 ID를 찾으면 이름을 사용한다', () => {
    expect(toListReference(listReference({ total: 2 }), 901)).toEqual({
      kind: 'named',
      name: 'SYNTH-EA · 합성 낱개',
    });
  });

  it('대상 미발견은 목록 잘림과 완전 목록을 구분하며 새 ID로 다시 찾는다', () => {
    const source = listReference({
      entries: [
        { id: 901, name: 'SYNTH-EA · 합성 낱개' },
        { id: 902, name: 'SYNTH-BOX · 합성 상자' },
      ],
      total: 3,
    });

    expect(toListReference(source, 903)).toEqual({ kind: 'truncated' });
    expect(toListReference({ ...source, total: 2 }, 903)).toEqual({ kind: 'unknown' });
    expect(toListReference(source, 902)).toEqual({
      kind: 'named',
      name: 'SYNTH-BOX · 합성 상자',
    });
  });

  it('실패·대기·공백 이름을 failed·loading·unknown으로 분리한다', () => {
    expect(toListReference(listReference({ isError: true }), 901)).toEqual({ kind: 'failed' });
    expect(toListReference(listReference({ isLoading: true }), 901)).toEqual({ kind: 'loading' });
    expect(toListReference(listReference({ entries: [{ id: 901, name: '  ' }] }), 901)).toEqual({
      kind: 'unknown',
    });
  });
});
