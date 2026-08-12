import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  describeApprover,
  describeBusinessUnit,
  describeReference,
  lookupNote,
  toBusinessUnit,
  toBusinessUnitOptions,
  toReference,
} from './lookups';
import type { LookupResult, ReferenceSource } from './lookups';
import type { LookupEntry, StepView } from './types';

/**
 * 참조 표기.
 *
 * **네 갈래를 가르는 것과, 다섯째 갈래(「전 사업부 공통」)를 그 넷보다 앞에 두는 것**이 요점이다.
 * 비운 사업부는 값이 빠진 것이 아니라 확정된 뜻이라, 참조 조회의 상태와 무관하게 성립한다.
 */

const t = messages.approvalRoute;

const entries: LookupEntry[] = [
  { value: '9101', label: '합성사업부1', isActive: true },
  { value: '9102', label: '합성사업부2', isActive: false },
];

const source = (patch: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries,
  isError: false,
  isLoading: false,
  truncated: false,
  ...patch,
});

const lookup = (patch: Partial<LookupResult> = {}): LookupResult => ({
  entries,
  isError: false,
  isLoading: false,
  truncated: false,
  refetch: () => undefined,
  ...patch,
});

const step = (patch: Partial<StepView> = {}): StepView => ({
  approvalRouteStepId: 9201,
  stepNo: 1,
  approverName: '합성 승인자1',
  approverDepartmentName: '합성부서',
  approverIsActive: true,
  ...patch,
});

describe('toReference', () => {
  it('목록에 있으면 이름을 낸다', () => {
    expect(toReference(source(), 9101)).toEqual({ kind: 'named', label: '합성사업부1' });
  });

  it('목록에 없으면 알 수 없음이다', () => {
    expect(toReference(source(), 9999)).toEqual({ kind: 'unknown' });
  });

  it('아직 오지 않았으면 「목록에 없음」이 아니다', () => {
    // 미도착을 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다.
    expect(toReference(source({ entries: [], isLoading: true }), 9101)).toEqual({
      kind: 'loading',
    });
  });

  it('실패는 미도착보다 앞선다', () => {
    expect(toReference(source({ entries: [], isError: true, isLoading: true }), 9101)).toEqual({
      kind: 'failed',
    });
  });

  it('네 갈래의 문구가 서로 다르다', () => {
    const labels = [
      describeReference({ kind: 'named', label: '합성사업부1' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(new Set(labels).size).toBe(4);
    expect(labels[1]).toBe(t.values.unknown);
    expect(labels[2]).toBe(t.values.referenceLoading);
    expect(labels[3]).toBe(t.values.referenceFailed);
  });
});

describe('toBusinessUnit', () => {
  it('사업부를 비운 결재선은 「전 사업부 공통」이다', () => {
    expect(toBusinessUnit(source(), null)).toEqual({ kind: 'allUnits' });
    expect(describeBusinessUnit({ kind: 'allUnits' })).toBe(t.values.allBusinessUnits);
  });

  it('참조 조회가 실패하거나 아직 오지 않아도 「전 사업부 공통」은 흔들리지 않는다', () => {
    // 확정된 뜻이라 이름 목록이 필요 없다 — 넷보다 앞에 서야 한다.
    expect(toBusinessUnit(source({ entries: [], isError: true }), null)).toEqual({
      kind: 'allUnits',
    });
    expect(toBusinessUnit(source({ entries: [], isLoading: true }), null)).toEqual({
      kind: 'allUnits',
    });
  });

  it('사업부가 지정되면 네 갈래를 그대로 쓴다', () => {
    expect(toBusinessUnit(source(), 9101)).toEqual({ kind: 'named', label: '합성사업부1' });
    expect(toBusinessUnit(source(), 9999)).toEqual({ kind: 'unknown' });
    expect(toBusinessUnit(source({ entries: [], isLoading: true }), 9101)).toEqual({
      kind: 'loading',
    });
    expect(toBusinessUnit(source({ entries: [], isError: true }), 9101)).toEqual({
      kind: 'failed',
    });
  });

  it('어느 갈래에도 내부 번호가 없다', () => {
    const labels = [null, 9101, 9999].map((id) =>
      describeBusinessUnit(toBusinessUnit(source(), id)),
    );

    // 선행 단언 — 이름이 실제로 나와야 「번호가 없다」가 뜻을 갖는다.
    expect(labels).toContain('합성사업부1');
    for (const label of labels) expect(label).not.toContain('9101');
  });
});

describe('lookupNote', () => {
  it('정상이면 안내가 없다', () => {
    expect(lookupNote(lookup())).toBeUndefined();
  });

  it('잘리면 그 사실을 밝힌다', () => {
    expect(lookupNote(lookup({ truncated: true }))).toBe(t.filters.lookupTruncated);
  });

  it('실패가 잘림보다 앞선다', () => {
    // 잘린 목록을 받아 두고 다시 부르기가 실패하면 둘이 함께 참이 된다.
    expect(lookupNote(lookup({ truncated: true, isError: true }))).toBe(t.filters.lookupFailed);
  });
});

describe('toBusinessUnitOptions', () => {
  it('미사용 값을 빼지 않고 표식만 붙인다', () => {
    // 빼면 그 사업부가 걸린 결재선을 조건으로 찾을 방법이 사라진다.
    expect(toBusinessUnitOptions(entries)).toEqual([
      { value: '9101', label: '합성사업부1' },
      { value: '9102', label: `합성사업부2${t.values.inactiveSuffix}` },
    ]);
  });
});

describe('describeApprover', () => {
  it('이름과 부서를 함께 낸다', () => {
    expect(describeApprover(step())).toBe('합성 승인자1 · 합성부서');
  });

  it('부서가 없으면 이름만 낸다', () => {
    expect(describeApprover(step({ approverDepartmentName: null }))).toBe('합성 승인자1');
  });

  it('이름이 없으면 번호가 아니라 「확인할 수 없습니다」를 낸다', () => {
    // 선행 단언 — 이름이 있을 때 이름이 나와야 이 단언이 뜻을 갖는다.
    expect(describeApprover(step())).toContain('합성 승인자1');
    expect(describeApprover(step({ approverName: null }))).toBe(t.values.approverUnknown);
  });

  it('이름이 없으면 부서만으로 이름을 만들지 않는다', () => {
    expect(describeApprover(step({ approverName: null, approverDepartmentName: '합성부서' }))).toBe(
      t.values.approverUnknown,
    );
  });
});
