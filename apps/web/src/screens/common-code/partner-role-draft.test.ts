import { describe, expect, it } from 'vitest';

import { partnerRoleFixtures } from './fixtures';
import {
  isSamePartnerRoleSelection,
  releasedPartnerRoles,
  toPartnerRoleChoices,
  toPartnerRoleDraft,
  toPartnerRoleOptions,
  toPartnerRolesPayload,
  togglePartnerRole,
  type PartnerRoleRow,
} from './partner-role-draft';
/* 코드 글자를 시험이 다시 적지 않는다(결정 2) — 리터럴은 어휘 고정 감지기 한 자리에만 둔다. */
import { PARTNER_ROLE_CODES } from './partner-role-vocab';

/** 어휘 밖 코드. 어휘 표에 없으므로 여기서 짓는다 — 화면이 모르는 값이 이 시험의 요점이다. */
const UNKNOWN_CODE = 'SAMPLE-ROLE-X';

const codesOf = (options: readonly { roleTypeCode: string }[]): string[] =>
  options.map((option) => option.roleTypeCode);

describe('toPartnerRoleDraft — 서버가 준 역할에서 초안을 세운다', () => {
  it('코드만 들고 다닌다 — 치환 본문에 코드 말고 실을 자리가 없다', () => {
    expect(toPartnerRoleDraft(partnerRoleFixtures)).toEqual([
      UNKNOWN_CODE,
      PARTNER_ROLE_CODES.disposal,
      PARTNER_ROLE_CODES.customer,
    ]);
  });

  /* 계약이 (거래처, 역할)을 유일하게 두지만 옛 자료가 겹쳐 올 수 있다 — 초안에서 접는다. */
  it('같은 코드가 두 번 와도 한 번만 담는다', () => {
    const roles: PartnerRoleRow[] = [
      { roleTypeCode: PARTNER_ROLE_CODES.supplier },
      { roleTypeCode: PARTNER_ROLE_CODES.supplier },
    ];

    expect(toPartnerRoleDraft(roles)).toEqual([PARTNER_ROLE_CODES.supplier]);
  });

  it('역할이 하나도 없으면 빈 초안이다', () => {
    expect(toPartnerRoleDraft([])).toEqual([]);
  });
});

describe('togglePartnerRole — 체크칸 하나를 켜고 끈다', () => {
  it('꺼져 있던 역할을 켠다', () => {
    expect(togglePartnerRole([PARTNER_ROLE_CODES.customer], PARTNER_ROLE_CODES.supplier)).toEqual([
      PARTNER_ROLE_CODES.customer,
      PARTNER_ROLE_CODES.supplier,
    ]);
  });

  it('켜져 있던 역할을 끈다', () => {
    expect(
      togglePartnerRole(
        [PARTNER_ROLE_CODES.customer, PARTNER_ROLE_CODES.supplier],
        PARTNER_ROLE_CODES.customer,
      ),
    ).toEqual([PARTNER_ROLE_CODES.supplier]);
  });

  /* 어휘 밖 코드도 끌 수 있다(결정 8) — 해제만 되고 새로 붙일 수는 없다. */
  it('어휘 밖 역할도 끌 수 있다', () => {
    expect(togglePartnerRole([UNKNOWN_CODE], UNKNOWN_CODE)).toEqual([]);
  });

  /* 기준값이 함께 흔들리면 「고친 것이 있는가」의 판정이 무너진다. */
  it('받은 배열을 고치지 않는다', () => {
    const selected = [PARTNER_ROLE_CODES.customer];

    togglePartnerRole(selected, PARTNER_ROLE_CODES.supplier);

    expect(selected).toEqual([PARTNER_ROLE_CODES.customer]);
  });
});

describe('isSamePartnerRoleSelection — 고친 것이 있는가', () => {
  /*
   * **순서를 보지 않는다.** 체크 순서는 자료가 아니라 조작의 흔적이라, 순서로 판정하면
   * 껐다가 되돌려 놓아도 「고쳤다」로 남아 저장·취소가 사실과 어긋난다.
   */
  it('순서가 달라도 같은 집합이면 같다', () => {
    expect(
      isSamePartnerRoleSelection(
        [PARTNER_ROLE_CODES.customer, PARTNER_ROLE_CODES.disposal],
        [PARTNER_ROLE_CODES.disposal, PARTNER_ROLE_CODES.customer],
      ),
    ).toBe(true);
  });

  it('하나가 빠지면 다르다', () => {
    expect(
      isSamePartnerRoleSelection(
        [PARTNER_ROLE_CODES.customer],
        [PARTNER_ROLE_CODES.customer, PARTNER_ROLE_CODES.disposal],
      ),
    ).toBe(false);
  });

  it('하나가 늘면 다르다', () => {
    expect(
      isSamePartnerRoleSelection(
        [PARTNER_ROLE_CODES.customer, PARTNER_ROLE_CODES.disposal],
        [PARTNER_ROLE_CODES.customer],
      ),
    ).toBe(false);
  });

  it('둘 다 비면 같다', () => {
    expect(isSamePartnerRoleSelection([], [])).toBe(true);
  });
});

describe('toPartnerRoleOptions — 체크칸으로 설 역할 목록', () => {
  /*
   * 아직 붙지 않은 어휘도 전부 서야 **역할을 붙일 수 있다.** 서버가 준 것만 그리면
   * 「역할이 없는 거래처에는 역할을 붙일 수 없는」 화면이 된다.
   */
  it('어휘 다섯이 결정된 차례로 서고 어휘 밖 코드가 뒤에 붙는다', () => {
    expect(codesOf(toPartnerRoleOptions(partnerRoleFixtures))).toEqual([
      PARTNER_ROLE_CODES.customer,
      PARTNER_ROLE_CODES.supplier,
      PARTNER_ROLE_CODES.subcontractor,
      PARTNER_ROLE_CODES.disposal,
      PARTNER_ROLE_CODES.other,
      UNKNOWN_CODE,
    ]);
  });

  it('붙은 역할이 하나도 없어도 어휘 다섯은 전부 선다', () => {
    expect(toPartnerRoleOptions([])).toHaveLength(5);
  });

  it('어휘 안의 역할은 이 화면의 표시명으로 푼다', () => {
    const options = toPartnerRoleOptions([]);

    expect(options.map((option) => option.label)).toEqual([
      '고객사',
      '공급사',
      '외주 제작사',
      '폐기 업체',
      '기타',
    ]);
  });

  /*
   * **어휘 밖 코드를 감추지 않는다**(결정 8). 저장이 통째 교체라 목록에서 빼면
   * 저장하는 순간 조용히 해제되고, 사용자는 자기가 지우지 않은 것이 사라진 것을 알 수 없다.
   */
  it('어휘 밖 역할은 서버가 준 이름으로 풀고 모르는 역할로 표시한다', () => {
    const unknown = toPartnerRoleOptions(partnerRoleFixtures).at(-1);

    expect(unknown).toEqual({
      roleTypeCode: UNKNOWN_CODE,
      label: '샘플 역할 엑스',
      isKnown: false,
    });
  });

  it('어휘 안의 역할에는 모르는 역할 표시가 붙지 않는다', () => {
    const known = toPartnerRoleOptions(partnerRoleFixtures).slice(0, 5);

    expect(known.every((option) => option.isKnown)).toBe(true);
  });

  it('같은 어휘 밖 코드가 두 번 와도 체크칸은 하나다', () => {
    const roles: PartnerRoleRow[] = [
      { roleTypeCode: UNKNOWN_CODE, roleTypeName: '샘플 역할 엑스' },
      { roleTypeCode: UNKNOWN_CODE, roleTypeName: '샘플 역할 엑스' },
    ];

    expect(codesOf(toPartnerRoleOptions(roles))).toHaveLength(6);
  });
});

describe('toPartnerRoleChoices — 지금 체크된 상태', () => {
  /* 어휘 밖 코드는 **체크된 상태로 시작한다** — 서버에 이미 붙어 있는 역할이다. */
  it('초안에 있는 역할이 체크돼 있고 나머지는 꺼져 있다', () => {
    const baseline = toPartnerRoleDraft(partnerRoleFixtures);
    const checked = toPartnerRoleChoices(partnerRoleFixtures, baseline)
      .filter((choice) => choice.isSelected)
      .map((choice) => choice.roleTypeCode);

    expect(checked).toEqual([
      PARTNER_ROLE_CODES.customer,
      PARTNER_ROLE_CODES.disposal,
      UNKNOWN_CODE,
    ]);
  });

  it('선택을 바꾸면 체크 상태가 따라온다', () => {
    const choices = toPartnerRoleChoices(partnerRoleFixtures, [PARTNER_ROLE_CODES.supplier]);

    expect(
      choices.filter((choice) => choice.isSelected).map((choice) => choice.roleTypeCode),
    ).toEqual([PARTNER_ROLE_CODES.supplier]);
  });
});

/** 어휘 밖 코드가 섞이지 않은 부여분. 「체크를 끈 것만 해제된다」를 그 축만으로 재는 데 쓴다. */
const VOCABULARY_ONLY_ROLES: PartnerRoleRow[] = [
  { roleTypeCode: PARTNER_ROLE_CODES.customer, roleTypeName: null },
  { roleTypeCode: PARTNER_ROLE_CODES.disposal, roleTypeName: '폐기처리' },
];

describe('releasedPartnerRoles — 저장하면 해제되는 역할 (결정 10)', () => {
  it('체크를 끈 역할만 나온다', () => {
    const released = releasedPartnerRoles(VOCABULARY_ONLY_ROLES, [PARTNER_ROLE_CODES.disposal]);

    expect(codesOf(released)).toEqual([PARTNER_ROLE_CODES.customer]);
  });

  /*
   * **어휘 밖 코드도 해제 목록에 든다.** 이 한 줄이 결정 8의 요점이다 —
   * 빠뜨리면 화면이 모르는 역할이 확인 창에도 나오지 않은 채 사라진다.
   */
  it('어휘 밖 역할을 끄면 그 이름이 해제 목록에 든다', () => {
    const released = releasedPartnerRoles(partnerRoleFixtures, [
      PARTNER_ROLE_CODES.customer,
      PARTNER_ROLE_CODES.disposal,
    ]);

    expect(released).toEqual([
      { roleTypeCode: UNKNOWN_CODE, label: '샘플 역할 엑스', isKnown: false },
    ]);
  });

  /**
   * **체크를 유지해도 해제된다**(계약 재동기화 #173).
   *
   * 계약이 역할 코드를 다섯으로 좁혔고 어휘 밖 값은 서버가 400으로 거절한다 — 그래서 치환
   * 본문에 실을 수 없고, 통째 교체 저장은 그것을 **반드시 떨어뜨린다.** 확인 창이 그 사실을
   * 나열하지 않으면 사용자는 지우지 않은 역할이 사라진 것을 알 방법이 없다.
   */
  it('어휘 밖 역할은 체크를 유지해도 해제 목록에 선다 — 계약이 실을 수 없게 했다', () => {
    const released = releasedPartnerRoles(
      partnerRoleFixtures,
      toPartnerRoleDraft(partnerRoleFixtures),
    );

    expect(codesOf(released)).toEqual([UNKNOWN_CODE]);
  });

  it('새로 켠 역할은 해제 목록에 들지 않는다', () => {
    const baseline = toPartnerRoleDraft(VOCABULARY_ONLY_ROLES);
    const released = releasedPartnerRoles(VOCABULARY_ONLY_ROLES, [
      ...baseline,
      PARTNER_ROLE_CODES.supplier,
    ]);

    expect(released).toEqual([]);
  });

  it('전부 끄면 붙어 있던 역할이 전부 표시 차례대로 나온다', () => {
    expect(codesOf(releasedPartnerRoles(partnerRoleFixtures, []))).toEqual([
      PARTNER_ROLE_CODES.customer,
      PARTNER_ROLE_CODES.disposal,
      UNKNOWN_CODE,
    ]);
  });

  it('어휘 안의 역할을 그대로 두면 해제되는 역할이 없다', () => {
    expect(
      releasedPartnerRoles(VOCABULARY_ONLY_ROLES, toPartnerRoleDraft(VOCABULARY_ONLY_ROLES)),
    ).toEqual([]);
  });

  it('붙어 있지 않던 역할을 껐다 켜도 해제 목록에 들지 않는다', () => {
    expect(releasedPartnerRoles([], [])).toEqual([]);
  });
});

describe('toPartnerRolesPayload — 통째 교체 본문', () => {
  /*
   * 집합이라 차례에 뜻은 없지만 **고정해 두어야** 같은 선택에서 매번 같은 본문이 나간다.
   * 체크한 순서로 실으면 캐시도 시험도 흔들린다.
   */
  it('어휘 다섯의 차례로 싣는다', () => {
    const payload = toPartnerRolesPayload(partnerRoleFixtures, [
      PARTNER_ROLE_CODES.disposal,
      PARTNER_ROLE_CODES.customer,
    ]);

    expect(payload).toEqual({
      roleTypeCodes: [PARTNER_ROLE_CODES.customer, PARTNER_ROLE_CODES.disposal],
    });
  });

  it('체크하지 않은 어휘는 싣지 않는다', () => {
    const payload = toPartnerRolesPayload(partnerRoleFixtures, [PARTNER_ROLE_CODES.supplier]);

    expect(payload.roleTypeCodes).toEqual([PARTNER_ROLE_CODES.supplier]);
  });

  /* 집합이다 — 같은 코드를 두 번 실으면 서버가 무엇을 받은 것인지 흐려진다. */
  it('중복을 싣지 않는다', () => {
    const payload = toPartnerRolesPayload(partnerRoleFixtures, [
      PARTNER_ROLE_CODES.customer,
      PARTNER_ROLE_CODES.customer,
    ]);

    expect(payload.roleTypeCodes).toEqual([PARTNER_ROLE_CODES.customer]);
  });

  /* 계약이 빈 배열을 「전부 해제」로 정의한다 — 화면이 그 갈래를 만들 수 있어야 한다. */
  it('전부 끄면 빈 배열을 싣는다', () => {
    expect(toPartnerRolesPayload(partnerRoleFixtures, []).roleTypeCodes).toEqual([]);
  });

  /**
   * **계약이 아는 다섯만 실린다**(#173 — 어휘 밖은 400).
   *
   * 앞 회차까지 이 자리는 「보존이 기본」이라 어휘 밖 코드를 그대로 실었다. 계약이 값 목록을
   * 못 박으면서 그 본문은 **서버가 통째로 거절하는 요청**이 됐다 — 잃는 것을 줄이려던 겹이
   * 저장 자체를 막는다. 지금은 실을 수 있는 것만 싣고, 잃는 사실은 확인 창이 밝힌다.
   */
  it('체크돼 있어도 어휘 밖 코드는 싣지 않는다 — 서버가 400으로 거절한다', () => {
    const payload = toPartnerRolesPayload(partnerRoleFixtures, [
      UNKNOWN_CODE,
      PARTNER_ROLE_CODES.customer,
    ]);

    expect(payload.roleTypeCodes).toEqual([PARTNER_ROLE_CODES.customer]);
  });

  /**
   * **짝을 한 시험에서 잰다.** 「본문에서 빠진다」와 「확인 창이 든다」가 갈라지면 조용히
   * 사라지는 갈래가 되살아난다 — 두 사실이 같은 자리에서 서로를 지킨다.
   */
  it('본문에서 빠진 어휘 밖 코드는 반드시 해제 목록에 선다', () => {
    const selected = toPartnerRoleDraft(partnerRoleFixtures);
    const sent = new Set<string>(
      toPartnerRolesPayload(partnerRoleFixtures, selected).roleTypeCodes,
    );
    const released = new Set(codesOf(releasedPartnerRoles(partnerRoleFixtures, selected)));

    for (const code of selected) {
      expect(sent.has(code) || released.has(code)).toBe(true);
    }
    expect(sent.has(UNKNOWN_CODE)).toBe(false);
    expect(released.has(UNKNOWN_CODE)).toBe(true);
  });

  /* 「비슷하면 통과」 구현을 잡는다 — 대소문자 보정·접두사 제거를 만들지 않는다. */
  it.each(['customer', 'CUSTOMER_X', 'CUST OMER', 'toString'])(
    '어휘와 비슷하기만 한 코드(%s)도 싣지 않는다',
    (code) => {
      const roles: PartnerRoleRow[] = [{ roleTypeCode: code }];

      expect(toPartnerRolesPayload(roles, [code]).roleTypeCodes).toEqual([]);
    },
  );
});
