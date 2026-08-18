import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { reasonCodeValueFixtures, reasonGroupFixtures } from './fixtures';
import { lookupNote, toSelectOptions } from './lookups';
import {
  ADJUST_REASON_GROUP_CODE,
  findAdjustReasonGroup,
  reasonLookupKeys,
  useAdjustReasonLookup,
} from './reason-options';

/**
 * 조정 사유 선택지 — **고객이 공통코드 마스터에 등록하는 값**을 실행 시점에 조회한다
 * (#36 회신 · 공유계약 `G-31` · 스펙 `W-01-12` §8-3).
 *
 * 이 파일이 지키는 것은 셋이다.
 *
 * | # | 잣대 | 깨지면 |
 * | :-: | --- | --- |
 * | ① | **값 문면에 갈래가 없다** — 어느 코드가 와도 같게 옮긴다 | 고객이 넣은 값에 화면이 다르게 반응한다 |
 * | ② | **그룹은 그룹코드 정확 일치로만 찾는다** | 엉뚱한 그룹의 코드값이 조정 사유로 보인다 |
 * | ③ | **네 갈래를 가른다**(미도착 · 없음 · 실패 · 정상) | 실패가 「값이 없다」로 보인다 |
 */

const t = messages.stockAdjust;

const CODE_GROUPS_PATH = '/mdm/code-groups';
const CODE_VALUES_PATH = '/mdm/code-values';

const listBody = (items: unknown[], total = items.length) => ({
  items,
  page: { page: 1, size: 50, total },
});

const route = (pathname: string, items: unknown[], total?: number): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
  respond: () => jsonResponse(listBody(items, total)),
});

const failingRoute = (pathname: string, status: number): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
  respond: () => jsonResponse({ message: '' }, { status }),
});

const recordingFetch = (
  routes: StubRoute[],
): { fetch: (request: Request) => Promise<Response>; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    fetch: async (request) => {
      urls.push(new URL(request.url));

      return stub(request);
    },
    urls,
  };
};

const defaultRoutes = (values = reasonCodeValueFixtures): StubRoute[] => [
  route(CODE_GROUPS_PATH, reasonGroupFixtures),
  route(CODE_VALUES_PATH, values),
];

/**
 * 합성 코드값 하나. **값 문면에 뜻을 담지 않는다** — 이 파일의 감지기가 겨누는 것이
 * 「어느 값이 와도 같게 옮기는가」라서, 뜻이 있는 값을 쓰면 그 뜻에 기댄 시험이 된다.
 */
const codeValue = (code: string, codeName = '합성 사유'): components['schemas']['CodeValue'] => ({
  codeValueId: 9911,
  codeGroupId: 9901,
  code,
  codeName,
  displayOrder: 0,
  isActive: true,
});

describe('ADJUST_REASON_GROUP_CODE', () => {
  /**
   * ⚠ **이것은 사유 「값」이 아니라 그룹을 찾는 열쇠다.** 지시가 금지한 것은 사유 코드에
   * 거는 분기·검증이고, 어느 그룹의 코드값인지를 정하는 열쇠는 조회가 성립하려면 있어야 한다.
   */
  it('그룹코드 하나로 고정된다 — 번호가 아니다', () => {
    expect(ADJUST_REASON_GROUP_CODE).toBe('ADJUST_REASON');
    expect(Number.isNaN(Number(ADJUST_REASON_GROUP_CODE))).toBe(true);
  });
});

/**
 * **정확 일치만 고른다**(전례 `judgment-group.ts`의 세 방어를 그대로 가져온다).
 *
 * 여기서 가장 나쁜 결함은 「엉뚱한 그룹이 열려 다른 업무의 코드값이 조정 사유로 보이는 것」이다 —
 * 그 값이 되돌릴 수 없는 전표에 실린다.
 */
describe('findAdjustReasonGroup', () => {
  const group = (groupCode: string, codeGroupId = 9901): components['schemas']['CodeGroup'] => ({
    codeGroupId,
    groupCode,
    groupName: '합성 그룹',
    isActive: true,
  });

  it('그룹코드가 정확히 같은 그룹을 고른다', () => {
    expect(findAdjustReasonGroup([group(ADJUST_REASON_GROUP_CODE)])?.codeGroupId).toBe(9901);
  });

  it('부분 일치를 고르지 않는다 — 검색이 부분 일치라 이름이 겹치는 그룹이 함께 온다', () => {
    expect(findAdjustReasonGroup([group(`${ADJUST_REASON_GROUP_CODE}_EXTRA`)])).toBeNull();
  });

  it('대소문자를 접지 않는다', () => {
    expect(findAdjustReasonGroup([group(ADJUST_REASON_GROUP_CODE.toLowerCase())])).toBeNull();
  });

  /** 못 찾았을 때 첫 항목으로 대신하지 않는다 — 그 순간부터 다른 그룹의 값을 사유로 쓴다. */
  it('못 찾으면 첫 항목으로 대신하지 않는다', () => {
    expect(findAdjustReasonGroup([group('SYN_OTHER_A'), group('SYN_OTHER_B')])).toBeNull();
  });

  /** 사용 여부는 판정 근거가 아니다 — 꺼진 그룹도 찾아내야 그 사실이 화면에 드러난다. */
  it('사용 중지된 그룹도 찾는다', () => {
    expect(
      findAdjustReasonGroup([{ ...group(ADJUST_REASON_GROUP_CODE), isActive: false }])?.codeGroupId,
    ).toBe(9901);
  });
});

describe('reasonLookupKeys', () => {
  it('그룹과 코드값의 캐시가 갈린다', () => {
    expect(reasonLookupKeys.group).toEqual(['stock-adjust-reasons', 'group']);
    expect(reasonLookupKeys.values(9901)).toEqual(['stock-adjust-reasons', 'values', 9901]);
  });

  /** 그룹이 달라지면 값 목록도 갈려야 한다 — 안 갈리면 앞 그룹의 값이 그대로 선다. */
  it('그룹마다 값 캐시가 갈린다', () => {
    expect(reasonLookupKeys.values(9902)).not.toEqual(reasonLookupKeys.values(9901));
  });
});

describe('useAdjustReasonLookup — 조회', () => {
  it('그룹코드로 좁혀 그룹을 찾고 그 번호로 코드값을 부른다', async () => {
    const { fetch, urls } = recordingFetch(defaultRoutes());
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    const groupUrl = urls.find((url) => url.pathname === CODE_GROUPS_PATH);
    const valueUrl = urls.find((url) => url.pathname === CODE_VALUES_PATH);

    expect(groupUrl?.searchParams.get('q')).toBe(ADJUST_REASON_GROUP_CODE);
    /* 꺼진 그룹도 찾아야 한다 — 사용 여부는 판정 근거가 아니다. */
    expect(groupUrl?.searchParams.get('includeInactive')).toBe('true');
    expect(valueUrl?.searchParams.get('codeGroupId')).toBe('9901');
  });

  /**
   * **고르는 자리에는 지금 쓰는 값만 낸다.** 다섯 참조(창고·위치·품목·단위·LOT)는 이름을
   * 풀어야 해서 `includeInactive=true`로 받지만, 사유는 이름을 푸는 자리가 없다 —
   * 이력 표도 상세도 코드 그대로 그린다. 중지된 사유를 고르게 하면 마스터의 중지가 무의미해진다.
   */
  it('코드값은 미사용 포함을 켜지 않는다 — 이름을 푸는 자리가 아니다', async () => {
    const { fetch, urls } = recordingFetch(defaultRoutes());
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    expect(
      urls.find((url) => url.pathname === CODE_VALUES_PATH)?.searchParams.get('includeInactive'),
    ).toBeNull();
  });

  /** 계약이 `codeGroupId`를 필수로 요구한다 — 그룹을 못 찾았으면 요청 자체가 성립하지 않는다. */
  it('그룹을 못 찾으면 코드값을 부르지 않는다', async () => {
    const { fetch, urls } = recordingFetch([
      route(CODE_GROUPS_PATH, []),
      route(CODE_VALUES_PATH, reasonCodeValueFixtures),
    ]);
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(urls.filter((url) => url.pathname === CODE_VALUES_PATH)).toEqual([]);
    expect(result.current.entries).toEqual([]);
  });

  /**
   * ⛔ **「없음」을 실패로 말하지 않는다.** 그룹이 없는 것은 고객의 마스터가 아직 그렇다는
   * 사실일 뿐이고, 실패 문구를 내면 사용자가 화면 고장으로 읽는다.
   */
  it('그룹이 없는 것은 실패가 아니다', async () => {
    const { fetch } = recordingFetch([route(CODE_GROUPS_PATH, [])]);
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(lookupNote(result.current)).toBeUndefined();
  });
});

/**
 * ⭐ **값 문면에 갈래가 없다**(#36 회신 ③). 어느 코드가 와도 같은 모양으로 옮긴다 —
 * 화면이 특정 값을 알아보면 고객이 그 값을 바꾸는 순간 조용히 다르게 돈다.
 */
describe('useAdjustReasonLookup — 값 무분기', () => {
  const arbitraryCodes = ['SYN-RSN-ALPHA', 'SYN-RSN-OMEGA', 'COUNT_VARIANCE', '0', 'false', '합성'];

  it.each(arbitraryCodes)('임의 코드 %s가 그대로 선택지가 된다', async (code) => {
    const { fetch } = recordingFetch(defaultRoutes([codeValue(code)]));
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    expect(result.current.entries[0]).toEqual({
      value: code,
      label: `${code} · 합성 사유`,
      isActive: true,
    });
    expect(toSelectOptions(result.current)).toEqual([
      { value: code, label: `${code} · 합성 사유` },
    ]);
  });

  /** 차례가 뜻일 수 있다(자주 쓰는 것부터 등) — 화면이 다시 세우지 않는다. */
  it('받은 차례를 바꾸지 않는다', async () => {
    const { fetch } = recordingFetch(
      defaultRoutes([codeValue('SYN-RSN-OMEGA'), codeValue('SYN-RSN-ALPHA')]),
    );
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    expect(result.current.entries.map((entry) => entry.value)).toEqual([
      'SYN-RSN-OMEGA',
      'SYN-RSN-ALPHA',
    ]);
  });

  /** 값을 거르지 않는다 — 서버가 준 것을 그대로 낸다. */
  it('받은 값을 하나도 거르지 않는다', async () => {
    const codes = arbitraryCodes.map((code) => codeValue(code));
    const { fetch } = recordingFetch(defaultRoutes(codes));
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(codes.length);
    });

    expect(result.current.entries.map((entry) => entry.value)).toEqual(arbitraryCodes);
  });
});

/**
 * **네 갈래를 가른다**(전례 `lookups.ts`와 같은 잣대). 실패를 삼키면 선택칸이 이유 없이
 * 비어 보이고, 잘림을 감추면 불완전한 목록을 완전한 것으로 읽는다.
 */
describe('useAdjustReasonLookup — 실패와 잘림', () => {
  it('그룹 조회가 실패하면 실패로 말한다', async () => {
    const { fetch } = recordingFetch([failingRoute(CODE_GROUPS_PATH, 500)]);
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(lookupNote(result.current)).toBe(t.lookups.failed);
    expect(result.current.entries).toEqual([]);
  });

  it('코드값 조회가 실패하면 실패로 말한다', async () => {
    const { fetch } = recordingFetch([
      route(CODE_GROUPS_PATH, reasonGroupFixtures),
      failingRoute(CODE_VALUES_PATH, 500),
    ]);
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(lookupNote(result.current)).toBe(t.lookups.failed);
  });

  it('목록이 잘리면 그 사실을 밝힌다', async () => {
    const { fetch } = recordingFetch([
      route(CODE_GROUPS_PATH, reasonGroupFixtures),
      route(CODE_VALUES_PATH, reasonCodeValueFixtures, 120),
    ]);
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });

    expect(lookupNote(result.current)).toBe(t.lookups.truncated);
  });

  /** 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  it('다시 시도하면 두 조회가 함께 다시 나간다', async () => {
    const { fetch, urls } = recordingFetch(defaultRoutes());
    const { result } = renderHookWithProviders(() => useAdjustReasonLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    result.current.refetch();

    await waitFor(() => {
      expect(urls.filter((url) => url.pathname === CODE_GROUPS_PATH)).toHaveLength(2);
    });

    await waitFor(() => {
      expect(urls.filter((url) => url.pathname === CODE_VALUES_PATH)).toHaveLength(2);
    });
  });
});
