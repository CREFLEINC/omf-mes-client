import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { LookupSource } from '../../patterns/lookup-display';
import {
  GROUP_TYPE_OPTIONS,
  PENDING_CODE_VALUE,
  ensureOption,
  groupDeactivateImpact,
  groupTypeLabel,
  lookupLabel,
  selectableOptions,
  statusLabel,
  toCodeLabels,
} from './code-options';
import type { LookupEntry } from './types';

const entries: LookupEntry[] = [
  { value: '11', label: '제1공장', isActive: true },
  { value: '12', label: '제2공장', isActive: false },
];

const source = (
  lookupEntries: LookupEntry[] = entries,
  state: 'ready' | 'loading' | 'failed' = 'ready',
): LookupSource<LookupEntry> => ({
  entries: lookupEntries,
  isError: state === 'failed',
  isLoading: state === 'loading',
});

describe('자리표시 선택지', () => {
  /*
   * 값 목록이 확정되지 않은 코드는 값을 지어내지 않는다. 물리 모델에 값이 있어도
   * 고객사가 자기 분류 체계를 정해야 하는 값이라 그것을 선택지로 내면 안 된다.
   */
  it('그룹유형은 자리표시 하나만 낸다', () => {
    expect(GROUP_TYPE_OPTIONS).toHaveLength(1);
    expect(GROUP_TYPE_OPTIONS[0]?.value).toBe(PENDING_CODE_VALUE);
    expect(GROUP_TYPE_OPTIONS[0]?.label).toBe(messages.pendingCode.placeholder);
  });
});

describe('groupTypeLabel', () => {
  /*
   * 값 목록이 확정되지 않아 서버가 준 코드는 어느 것도 선택지에 없다.
   * 그때 「알 수 없음」으로 그리면 모르는 값과 없는 값이 같은 모양이 된다(G-9).
   */
  it('선택지에 없는 코드는 코드를 그대로 보인다', () => {
    expect(groupTypeLabel('LINE')).toBe('LINE');
    expect(groupTypeLabel('WORK_AREA')).toBe('WORK_AREA');
  });

  it('자리표시 값은 자리표시 문구로 보인다', () => {
    expect(groupTypeLabel(PENDING_CODE_VALUE)).toBe(messages.pendingCode.placeholder);
  });
});

describe('ensureOption', () => {
  it('목록에 없는 현재 값은 코드 그대로 덧붙인다', () => {
    const result = ensureOption([{ value: 'A', label: '가' }], 'B');

    expect(result).toEqual([
      { value: 'A', label: '가' },
      { value: 'B', label: 'B' },
    ]);
  });

  it('고르지 않음(빈 문자열)에는 아무것도 덧붙이지 않는다', () => {
    const options = [{ value: 'A', label: '가' }];

    expect(ensureOption(options, '')).toBe(options);
  });

  it('이미 있는 값에는 덧붙이지 않는다', () => {
    const options = [{ value: 'A', label: '가' }];

    expect(ensureOption(options, 'A')).toBe(options);
  });
});

describe('selectableOptions', () => {
  it('기본은 사용 중인 것만 낸다', () => {
    expect(selectableOptions(source(), '')).toEqual([{ value: '11', label: '제1공장' }]);
  });

  /*
   * 미사용 값을 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다.
   * 남기되 미사용이라는 사실을 라벨에 밝힌다.
   */
  it('지금 고른 값이 미사용이면 남기고 라벨에 표식을 붙인다', () => {
    expect(selectableOptions(source(), '12')).toEqual([
      { value: '11', label: '제1공장' },
      { value: '12', label: `제2공장${messages.equipmentMaster.values.inactiveSuffix}` },
    ]);
  });

  it.each([
    ['ready', messages.common.reference.unknown],
    ['loading', messages.common.reference.loading],
    ['failed', messages.common.reference.failed],
  ] as const)('%s 상태의 미확인 FK는 값만 보존하고 번호를 라벨로 내지 않는다', (state, label) => {
    const options = selectableOptions(source([], state), '99');

    expect(options).toEqual([{ value: '99', label }]);
    expect(options[0]?.label).not.toContain('99');
  });
});

describe('lookupLabel', () => {
  it('선택 목록에서 이름을 푼다', () => {
    expect(lookupLabel(source(), '11')).toBe('제1공장');
  });

  it('못 찾으면 내부 번호 대신 미확인 상태를 보인다', () => {
    expect(lookupLabel(source(), '77')).toBe(messages.common.reference.unknown);
  });

  it('로딩과 실패를 미확인과 구분한다', () => {
    expect(lookupLabel(source([], 'loading'), '77')).toBe(messages.common.reference.loading);
    expect(lookupLabel(source([], 'failed'), '77')).toBe(messages.common.reference.failed);
  });

  /* 좁혀 받은 선택지가 아니라 전체에서 찾아야 미사용 공장의 이름도 나온다. */
  it('미사용 항목의 이름도 푼다', () => {
    expect(lookupLabel(source(), '12')).toBe('제2공장');
  });
});

describe('groupDeactivateImpact', () => {
  /* 0대와 N대는 사용자가 할 판단이 다르다 — 하나로 뭉개면 건수를 내려받는 뜻이 없다. */
  it('소속 설비가 있으면 건수를 담은 문장을 낸다', () => {
    expect(groupDeactivateImpact(12)).toBe(messages.equipmentMaster.deactivate.members(12));
  });

  it('소속 설비가 없으면 다른 문장을 낸다', () => {
    expect(groupDeactivateImpact(0)).toBe(messages.equipmentMaster.deactivate.membersNone);
    expect(groupDeactivateImpact(0)).not.toBe(messages.equipmentMaster.deactivate.members(0));
  });
});

describe('toCodeLabels', () => {
  const values = [
    {
      codeValueId: 1,
      codeGroupId: 900,
      code: 'IN_SERVICE',
      codeName: '운용',
      displayOrder: 1,
      isActive: true,
    },
    {
      codeValueId: 2,
      codeGroupId: 900,
      code: 'DISPOSED',
      codeName: '폐기',
      displayOrder: 2,
      isActive: false,
    },
  ];

  /*
   * ⛔ **거르지 않는다.** 코드값이 사용 중지돼도 그 값을 가진 설비는 남아 있고,
   * 그때 이름을 못 풀면 화면에 코드가 그대로 선다. 선택칸용 변환과 다른 자리다.
   */
  it('미사용 코드값의 이름도 푼다', () => {
    expect(toCodeLabels(values)).toEqual([
      { value: 'IN_SERVICE', label: '운용' },
      { value: 'DISPOSED', label: '폐기' },
    ]);
  });

  /* ⛔ 라벨을 지어내지 않는다 — 이름이 비면 코드가 곧 이름이다. */
  it('이름이 비면 코드를 그대로 쓴다', () => {
    expect(toCodeLabels([{ ...values[0]!, codeName: '   ' }])[0]?.label).toBe('IN_SERVICE');
  });

  it('빈 목록은 빈 표로 남는다 — 시드가 아직 없을 수 있다', () => {
    expect(toCodeLabels([])).toEqual([]);
  });
});

describe('statusLabel', () => {
  const options = [{ value: 'IN_SERVICE', label: '운용' }];

  it('이름을 푼다', () => {
    expect(statusLabel('IN_SERVICE', options)).toBe('운용');
  });

  /* 「알 수 없음」으로 그리면 모르는 값과 없는 값이 같은 모양이 된다(G-9). */
  it('못 찾으면 코드를 그대로 보인다', () => {
    expect(statusLabel('DISPOSED', options)).toBe('DISPOSED');
    expect(statusLabel('DISPOSED', [])).toBe('DISPOSED');
  });
});
