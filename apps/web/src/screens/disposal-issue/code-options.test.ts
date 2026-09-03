import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  canChooseDisposalPartner,
  codeNote,
  codePlaceholder,
  DEFECT_WAREHOUSE_TYPE_CODES,
  DISPOSAL_PARTNER_ROLE_CODE,
  disposalPartnerNote,
  disposalPartnerPlaceholder,
  isDefectWarehouseTypePending,
  isDisposalPartnerRolePending,
  isRequiredCodeListPending,
  narrowToDefectWarehouses,
  PLACEHOLDER_DISPOSAL_ISSUE_CODES,
  readDisposalPartnerCondition,
  REQUIRED_CODE_KEYS,
  toCodeOptionSets,
  type CodeValueLists,
  type DisposalPartnerCondition,
} from './code-options';
import type { SelectOption, WarehouseEntry } from './types';

const warehouse = (overrides: Partial<WarehouseEntry> = {}): WarehouseEntry => ({
  value: '9701',
  label: 'SAMPLE-WH-01 · 합성 창고 가',
  isActive: true,
  warehouseTypeCode: 'SAMPLE_WH_TYPE_A',
  ...overrides,
});

describe('자리표시 — 지금의 사실', () => {
  /**
   * **값을 지어내지 않는 것이 이 파일의 목적이다.** 계약의 `@example`도 심지 않는다 —
   * 그것은 예시이지 확정이 아니다.
   */
  it('닫힌 원천 유형만 고정 계약 값으로 채운다', () => {
    expect(PLACEHOLDER_DISPOSAL_ISSUE_CODES.sourceDocumentType).toEqual(['GOODS_RECEIPT']);
    for (const key of ['issueType', 'reason', 'receiptType', 'status', 'issueStatus'] as const)
      expect(PLACEHOLDER_DISPOSAL_ISSUE_CODES[key]).toEqual([]);
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).toHaveLength(6);
  });

  /**
   * **여섯이 전부다 — 없앤 자리가 정말 없다**(변경 통지 #124 · 짝 규칙).
   *
   * 폐기 계정은 회계 소관이라 자리째 없앴고, 도착지 유형은 짝인 도착지 식별자를 공급할 자리가
   * 함께 사라져 **한쪽만 실린 본문**이 만들어지지 않게 같이 없앴다. 값만 비워 두면 「나중에 채울
   * 자리」로 남아 다음 사본으로 전파된다.
   *
   * **집합을 그대로 견준다**(`not.toContain`이 아니라 `toEqual`). 없앤 이름을 시험이 다시 적으면
   * 그 이름이 저장소에 남아, 「이 화면에 그런 자리가 없다」가 검색으로도 사실이 되지 못한다.
   * 집합 견줌은 되살아난 자리도 새로 는 자리도 함께 잡는다.
   */
  it('자리표시 여섯이 그 여섯 그대로다', () => {
    const expected = [
      'issueType',
      'sourceDocumentType',
      'reason',
      'receiptType',
      'status',
      'issueStatus',
    ];

    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES).sort()).toEqual([...expected].sort());
    expect(Object.keys(toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).sort()).toEqual(
      [...expected].sort(),
    );
  });

  /**
   * **출고 전표 상태와 입고 전표 상태를 한 키로 묶지 않는다.** 두 값 목록은 서로 다른 공통코드라
   * 한쪽이 확정될 때 다른 쪽 선택칸까지 함께 열리면 화면이 없는 선택지를 내놓게 된다.
   *
   * 반대로 **출고 유형·폐기 사유는 한 키를 함께 쓴다** — 폐기 정보 폼이 고르는 값과 이력 조건이
   * 거르는 값이 **같은 공통코드**이고, 갈라 두면 값이 확정될 때 채울 자리가 둘이 된다.
   */
  it('출고 상태와 입고 상태의 자리가 갈려 있다', () => {
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).toContain('issueStatus');
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).toContain('status');
  });

  it('불량창고 유형의 자리표시도 비어 있다', () => {
    expect(DEFECT_WAREHOUSE_TYPE_CODES).toEqual([]);
  });

  /**
   * 등록 필수는 **셋**이다. 폐기 계정과 도착지 유형을 없애면서 다섯에서 줄었다(#124).
   *
   * **줄어도 등록은 그대로 잠겨 있다** — 남은 셋의 값 목록이 여전히 비어 있기 때문이다.
   * 아래 「지금은 값이 없어 참이다」가 그 사실을 함께 잰다.
   */
  it('등록 필수 코드가 셋이다', () => {
    expect([...REQUIRED_CODE_KEYS]).toEqual(['issueType', 'sourceDocumentType', 'reason']);
  });
});

describe('toCodeOptionSets', () => {
  const filled = (overrides: Partial<CodeValueLists> = {}): CodeValueLists => ({
    ...PLACEHOLDER_DISPOSAL_ISSUE_CODES,
    ...overrides,
  });

  it('값이 없으면 선택지도 없다', () => {
    expect(toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES).receiptType).toEqual([]);
  });

  /**
   * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
   * 아직 없는데 화면이 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
   */
  it('코드값을 그대로 라벨로 쓰고 차례를 바꾸지 않는다', () => {
    const sets = toCodeOptionSets(filled({ receiptType: ['SAMPLE_TY_B', 'SAMPLE_TY_A'] }));

    expect(sets.receiptType).toEqual([
      { value: 'SAMPLE_TY_B', label: 'SAMPLE_TY_B' },
      { value: 'SAMPLE_TY_A', label: 'SAMPLE_TY_A' },
    ]);
  });

  it('여섯을 모두 옮긴다', () => {
    expect(Object.keys(toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES))).toHaveLength(6);
  });
});

/**
 * **전환 감지기** — 자리표시가 채워졌을 때 살아나는 것을 재지 않으면 그것은 죽은 가지다.
 * 이 판정을 읽어 「승인 요청」을 잠그는 자리는 `validation.ts`이고, 판정을 여기 두는 이유는
 * 값이 확정될 때 **고칠 자리가 이 파일 하나**여야 하기 때문이다.
 */
describe('isRequiredCodeListPending — 두 방향', () => {
  const filledRequired = (): CodeValueLists => ({
    ...PLACEHOLDER_DISPOSAL_ISSUE_CODES,
    issueType: ['SAMPLE_ISSUE_TYPE_A'],
    sourceDocumentType: ['SAMPLE_SRC_TYPE_A'],
    reason: ['SAMPLE_REASON_A'],
  });

  /**
   * **등록 잠금이 이번 변경으로 열리지 않는다**(완료 조건 C14의 잣대). 필수가 다섯에서 셋으로
   * 줄었어도 남은 셋이 여전히 비어 있어 판정은 그대로 참이다 — 자리를 지우는 일이 사용자에게
   * 무엇을 열어 주는 일이 되어서는 안 된다.
   */
  it('지금은 값이 없어 참이다', () => {
    expect(isRequiredCodeListPending(toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES))).toBe(
      true,
    );
  });

  it('셋이 모두 차면 거짓이 된다', () => {
    expect(isRequiredCodeListPending(toCodeOptionSets(filledRequired()))).toBe(false);
  });

  it('셋 중 하나만 비어도 참이다', () => {
    for (const key of REQUIRED_CODE_KEYS) {
      const values = { ...filledRequired(), [key]: [] };

      expect(isRequiredCodeListPending(toCodeOptionSets(values))).toBe(true);
    }
  });

  /** **조회 조건 둘은 판정에 들지 않는다** — 비어 있어도 아무것도 막지 않는다. */
  it('조회 조건 코드가 비어도 판정이 바뀌지 않는다', () => {
    const values = { ...filledRequired(), receiptType: [], status: [] };

    expect(isRequiredCodeListPending(toCodeOptionSets(values))).toBe(false);
  });
});

/** 조회 결과 한 벌 — **고를 수 있는 정상 상태**가 기본값이고, 갈래마다 그 하나만 바꾼다. */
const lookup = (
  overrides: Partial<{
    entries: SelectOption[];
    isError: boolean;
    isLoading: boolean;
    truncated: boolean;
  }> = {},
) => ({
  entries: [{ value: '9561', label: 'SAMPLE-PT-01 · 합성 폐기업체 가' }],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const condition = (overrides = {}, isRolePending = false) =>
  readDisposalPartnerCondition(lookup(overrides), isRolePending);

/**
 * **폐기 거래처 선택지의 전환 감지기**(변경 통지 #128 §3).
 *
 * 선택지는 이제 **조회로 온다**(`lookups.ts`의 `useDisposalPartnerOptions`) — 목록을 좁히는
 * 역할 코드가 비어 있으면 조회 자체가 나가지 않아 선택지도 비어 있고, 칸은 기존 자리표시 셋과
 * 같은 모양으로 잠긴다. 판정 함수가 **목록을 인자로 받는 이유**는 창고 유형 자리표시와 같다 —
 * 함수 안에서 상수를 직접 읽으면 「차면 무엇이 달라지는가」를 잴 길이 없어 죽은 가지가 된다.
 */
describe('폐기 거래처 선택지 — 두 방향', () => {
  it('비어 있으면 고를 수 없다고 판정한다', () => {
    expect(canChooseDisposalPartner(condition({ entries: [] }, true))).toBe(false);
  });

  /** **둘째 방향** — 채우면 살아나지 않는 자리표시는 죽은 가지다. */
  it('선택지가 차면 고를 수 있다', () => {
    expect(canChooseDisposalPartner(condition())).toBe(true);
  });

  /**
   * **공통코드 자리표시에 섞지 않는다.** 폐기 거래처는 값 목록을 기다리는 코드가 아니라
   * **조회로 오는 마스터**다 — 한 통에 담으면 「코드 값이 확정되면 열린다」는 규칙이 조회에도
   * 걸린 것처럼 읽히고, 필수 코드 판정이 거래처까지 세게 된다.
   */
  it('거래처를 코드 자리표시 여섯에 섞지 않는다', () => {
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).not.toContain('disposalPartner');
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).toHaveLength(6);
  });
});

/**
 * **폐기 거래처를 좁히는 역할 코드의 전환 감지기**(변경 통지 #128 §3 — 값 확정 2026-08-16).
 *
 * 이 상수가 **선택지 조회를 여는 열쇠**다. 비어 있으면 조회가 나가지 않고(좁히지 않은 목록이
 * 폐기 거래처 선택지로 서는 것을 막는다) 칸이 잠기며, 채워지면 그 값이 질의 조건으로 실려
 * 나가고 칸이 열린다 — 그 전환을 재지 않으면 자리표시는 죽은 가지였다. **지금은 채워졌고,**
 * 이 감지기는 방향을 바꿔 **채워진 값 자체**를 지킨다.
 *
 * ⛔ **리터럴로 고정한다.** 계약이 역할 코드를 다섯으로 확정했으므로(#173) 이 줄이 재는 것은
 * 「계약이 아는 값인가」가 아니라 **「그 다섯 중 어느 것을 골랐는가」**다 — 그 축은 타입이 잡지
 * 못한다. 상수를 그대로 견주면 다른 값으로 바뀌어도 시험이 함께 따라가 아무도 울지 않으므로,
 * **계약 확정값과 직접 대조**한다.
 * 짝이 되는 사본은 `screens/common-code/partner-role-vocab.ts`의 `PARTNER_ROLE_CODES.disposal`이며
 * **그쪽도 각자 리터럴로 고정한다** — 두 사본이 서로 다른 값을 고르는 어긋남은 타입이 잡지
 * 못한다는 한계를 감추지 않는다.
 *
 * **판정 함수가 상수를 인자로 받는다.** 함수 안에서 직접 읽으면 「채웠을 때 무엇이 달라지는가」를
 * 시험할 길이 없다(창고 유형 자리표시가 세운 규율을 이유까지 그대로 승계한다).
 */
describe('폐기 거래처 역할 코드 — 두 방향', () => {
  it('역할 코드가 `DISPOSAL`로 확정돼 있다', () => {
    expect(DISPOSAL_PARTNER_ROLE_CODE).toBe('DISPOSAL');
  });

  /**
   * **빈 값의 뜻은 상수를 떠나서도 계속 잰다.** 상수가 채워졌다고 이 판정을 지우면, 누군가
   * 상수를 다시 비웠을 때 **좁히지 않은 거래처 전부**가 폐기 거래처 선택지로 서는 것을 막을
   * 감지기가 사라진다 — 그래서 빈 값 쪽은 **리터럴 `''`**로 옮겨 두고, 확정된 상수 쪽은
   * 「이제 준비 중이 아니다」를 재 전환이 실제로 일어났음을 고정한다.
   */
  it('빈 값은 준비 중이고, 확정된 역할 코드는 준비 중이 아니다', () => {
    expect(isDisposalPartnerRolePending('')).toBe(true);
    expect(isDisposalPartnerRolePending(DISPOSAL_PARTNER_ROLE_CODE)).toBe(false);
  });

  /** **둘째 방향** — 채우면 살아나지 않는 자리표시는 죽은 가지다. */
  it('역할 코드를 채우면 준비 중이 아니다', () => {
    expect(isDisposalPartnerRolePending('SAMPLE_PARTNER_ROLE_A')).toBe(false);
  });

  /**
   * 공백만인 값은 **채워진 것이 아니다.** 그대로 질의에 실으면 서버가 좁힐 근거 없는 조건을
   * 받고, 화면은 「좁혔다」고 믿은 목록을 폐기 거래처 선택지로 세운다.
   */
  it('공백만인 값도 준비 중으로 본다', () => {
    expect(isDisposalPartnerRolePending('   ')).toBe(true);
  });

  /**
   * **코드 자리표시 여섯에 섞지 않는다.** 역할 코드는 사용자가 고르는 선택지가 아니라
   * **조회를 좁히는 조건**이라, 한 통에 담으면 필수 코드 판정이 이 값까지 세게 된다.
   */
  it('역할 코드를 코드 자리표시 여섯에 섞지 않는다', () => {
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).not.toContain('disposalPartnerRole');
  });
});

describe('codeNote · codePlaceholder', () => {
  it('선택지가 비면 왜 비었는지 밝힌다', () => {
    expect(codeNote([])).toBe(messages.pendingCode.note);
    expect(codePlaceholder()).toBe(messages.pendingCode.placeholder);
  });

  /** **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
  it('선택지가 차면 안내를 거둔다', () => {
    expect(codeNote([{ value: 'SAMPLE_TY_A', label: 'SAMPLE_TY_A' }])).toBeUndefined();
  });
});

/**
 * **불량창고 좁힘의 전환 감지기.**
 *
 * 지금은 좁히지 못해 전체를 보이고, 값 목록이 채워지면 그 유형만 남는다. 좁힘을 상수로 굳히면
 * 자리표시를 채워도 창고가 좁혀지지 않는다 — 그 어긋남을 이 두 방향이 잡는다.
 */
describe('불량창고 좁힘 — 두 방향', () => {
  const entries = [
    warehouse(),
    warehouse({ value: '9702', warehouseTypeCode: 'SAMPLE_WH_TYPE_B' }),
    warehouse({ value: '9703', warehouseTypeCode: 'SAMPLE_WH_TYPE_C' }),
  ];

  it('자리표시가 비어 있는 지금은 좁히지 못한다', () => {
    expect(isDefectWarehouseTypePending(DEFECT_WAREHOUSE_TYPE_CODES)).toBe(true);
    expect(narrowToDefectWarehouses(entries, DEFECT_WAREHOUSE_TYPE_CODES)).toEqual(entries);
  });

  it('자리표시가 차면 좁힐 수 있다고 판정한다', () => {
    expect(isDefectWarehouseTypePending(['SAMPLE_WH_TYPE_B'])).toBe(false);
  });

  it('자리표시를 채우면 그 유형만 남는다', () => {
    expect(
      narrowToDefectWarehouses(entries, ['SAMPLE_WH_TYPE_B']).map((entry) => entry.value),
    ).toEqual(['9702']);
  });

  it('유형이 둘이면 둘 다 남는다', () => {
    expect(
      narrowToDefectWarehouses(entries, ['SAMPLE_WH_TYPE_B', 'SAMPLE_WH_TYPE_C']).map(
        (entry) => entry.value,
      ),
    ).toEqual(['9702', '9703']);
  });

  /** 좁힌 결과가 비는 것도 사실이다 — 없는 것을 전체로 되돌리지 않는다. */
  it('맞는 유형이 하나도 없으면 빈 목록이 된다', () => {
    expect(narrowToDefectWarehouses(entries, ['SAMPLE_WH_TYPE_Z'])).toEqual([]);
  });
});

/**
 * **선택칸의 사정 한 값**(리뷰 Major B1).
 *
 * 「비어 있다」는 사실 하나에 서로 다른 사정 넷이 겹쳐 있다. 길이로 판정하면 그 넷이 한 낱말로
 * 뭉개져 **못 불러온 칸이 「준비 중」이라 말하게** 된다 — 얼굴은 「기다리면 열린다」인데 설명은
 * 「다시 해야 한다」인 컨트롤이다. 이 판정과 아래 두 표기가 **한 원천**임을 여기서 고정한다.
 */
describe('readDisposalPartnerCondition — 여섯 갈래', () => {
  it('역할 코드가 비면 부르지도 않은 상태다', () => {
    expect(condition({ entries: [] }, true)).toBe('rolePending');
  });

  /** **역할 코드가 가장 앞이다** — 부르지도 않았는데 「없다」·「못 불러왔다」로 말할 수 없다. */
  it('역할 코드가 비면 조회 상태와 무관하게 그 사정이다', () => {
    expect(condition({ entries: [], isError: true }, true)).toBe('rolePending');
    expect(condition({ entries: [], isLoading: true }, true)).toBe('rolePending');
  });

  /**
   * **실패가 미도착보다 앞서고 미도착이 「없다」보다 앞선다**(`omf-mes#47`이 세운 차례).
   * 못 받은 목록·아직 안 온 목록으로 「없다」를 판정하면 화면이 확인하지 않은 것을 말한다.
   */
  it('실패 · 미도착 · 0건이 그 차례로 갈린다', () => {
    expect(condition({ entries: [], isError: true, isLoading: true })).toBe('failed');
    expect(condition({ entries: [], isLoading: true })).toBe('loading');
    expect(condition({ entries: [] })).toBe('empty');
  });

  it('잘린 목록과 온전한 목록을 가른다', () => {
    expect(condition({ truncated: true })).toBe('truncated');
    expect(condition()).toBe('ready');
  });
});

/**
 * **안내 · 자리표시 · 잠금이 같은 사정에서 나온다.** 셋이 서로 다른 원천을 보면 한 컨트롤이
 * 서로 다른 사실을 동시에 말한다 — 그것이 B1이 겨눈 자리다.
 */
describe('사정 → 안내 · 자리표시 · 잠금', () => {
  it('사정마다 안내와 자리표시가 짝으로 갈린다', () => {
    const t = messages.disposalIssue;

    expect([disposalPartnerNote('rolePending'), disposalPartnerPlaceholder('rolePending')]).toEqual(
      [messages.pendingCode.note, messages.pendingCode.placeholder],
    );
    expect([disposalPartnerNote('failed'), disposalPartnerPlaceholder('failed')]).toEqual([
      t.form.partnerFailedNote,
      t.form.partnerFailedPlaceholder,
    ]);
    expect([disposalPartnerNote('empty'), disposalPartnerPlaceholder('empty')]).toEqual([
      t.form.partnerEmptyNote,
      t.form.partnerEmptyPlaceholder,
    ]);
    expect([disposalPartnerNote('loading'), disposalPartnerPlaceholder('loading')]).toEqual([
      undefined,
      t.values.referenceLoading,
    ]);
  });

  /**
   * ⛔ **못 불러온 칸이 「준비 중」이라 말하지 않는다**(B1의 실증 자리). 두 사정의 글자가
   * 안내에서도 자리표시에서도 **서로 다르다**는 것을 값으로 못 박는다.
   */
  it('실패·0건의 글자가 「준비 중」과 다르다', () => {
    for (const condition of ['failed', 'empty'] as const) {
      expect(disposalPartnerNote(condition)).not.toBe(messages.pendingCode.note);
      expect(disposalPartnerPlaceholder(condition)).not.toBe(messages.pendingCode.placeholder);
    }
  });

  /** 고를 수 있으면 **둘 다 거둔다** — 남으면 열린 칸이 못 고른다고 말한다. */
  it('고를 수 있으면 안내도 자리표시도 없다', () => {
    expect(disposalPartnerNote('ready')).toBeUndefined();
    expect(disposalPartnerPlaceholder('ready')).toBeUndefined();
  });

  /**
   * **잘린 목록은 고를 수 있다** — 앞쪽 일부뿐이라는 사실은 안내가 말하고, 그 안에 찾는
   * 거래처가 있으면 고르는 데 지장이 없다. 잠그면 **보이는 선택지를 고를 수 없는** 칸이 된다.
   */
  it('잘려도 고를 수 있고 그 사실만 안내한다', () => {
    expect(canChooseDisposalPartner('truncated')).toBe(true);
    expect(disposalPartnerNote('truncated')).toBe(messages.disposalIssue.form.partnerTruncatedNote);
    expect(disposalPartnerPlaceholder('truncated')).toBeUndefined();
  });

  /**
   * **갈래를 손으로 세지 않는다**(리뷰 Minor R-M2 · T3 재리뷰 R-M1이 세운 규율).
   *
   * `satisfies`는 **원소가 유니온에 속하는지**만 보고 **빠짐은 보지 않는다** — 손으로 적은
   * 목록은 갈래가 늘어도 조용히 부분 순회가 된다. `Record<K, true>`는 키 누락을 오류로 만든다.
   */
  const ALL_CONDITIONS: Record<DisposalPartnerCondition, true> = {
    rolePending: true,
    failed: true,
    loading: true,
    empty: true,
    truncated: true,
    ready: true,
  };

  it('여섯 갈래가 전수이고 넷은 고를 수 없다', () => {
    const conditions = Object.keys(ALL_CONDITIONS) as DisposalPartnerCondition[];
    const locked = conditions.filter((condition) => !canChooseDisposalPartner(condition));

    expect(conditions).toHaveLength(6);
    expect(locked.sort()).toEqual(['empty', 'failed', 'loading', 'rolePending'].sort());
  });

  /**
   * **잠긴 갈래에는 왜 잠겼는지가 반드시 선다**(사유 없이 잠그지 않는다 — 배치 규범 4).
   * 갈래를 전수로 돌므로 **새 갈래가 표기를 빠뜨린 채 들어오면** 여기서 먼저 운다.
   */
  it('고를 수 없는 갈래는 안내나 자리표시 중 하나라도 반드시 낸다', () => {
    for (const condition of Object.keys(ALL_CONDITIONS) as DisposalPartnerCondition[]) {
      if (canChooseDisposalPartner(condition)) continue;

      expect(disposalPartnerNote(condition) ?? disposalPartnerPlaceholder(condition)).toBeDefined();
    }
  });

  /**
   * **없는 복구 경로를 가리키지 않는다**(리뷰 Minor R-M1). 이 칸에는 「다시 시도」가 없고
   * (`PartnerLookupResult`가 `refetch`를 타입째 내지 않는다) 복구는 전표를 다시 고르는 것이다 —
   * 안내가 할 수 없는 조치를 지시하면 사용자는 찾지 못할 버튼을 찾는다.
   */
  it('안내가 다시 시도를 가리키지 않고 낱말이 「선택지」로 통일된다', () => {
    for (const condition of Object.keys(ALL_CONDITIONS) as DisposalPartnerCondition[]) {
      const note = disposalPartnerNote(condition);

      if (note === undefined) continue;

      expect(note).not.toContain('다시 시도');
      /* 한 컨트롤이 같은 것을 두 이름으로 부르지 않는다 — 조건 줄의 「이름 목록」이 아니다. */
      expect(note).not.toContain('이름 목록');
    }

    expect(disposalPartnerNote('failed')).not.toBe(messages.disposalIssue.filters.lookupFailed);
    expect(disposalPartnerNote('truncated')).not.toBe(
      messages.disposalIssue.filters.lookupTruncated,
    );
  });
});
