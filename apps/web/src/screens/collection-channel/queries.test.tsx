import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import {
  channelListResponse,
  makeChannel,
  specListResponse,
  versionListResponse,
} from './fixtures';
import {
  plantIdQuery,
  useChannelDetail,
  useChannelList,
  useInspectionItemSpecs,
  useInspectionPlanVersions,
  useUomLookup,
} from './queries';

/**
 * ⭐ **설비를 고르기 전에는 조회 자체가 서지 않는다.**
 *
 * 화면에서만 재면 이 사실을 놓친다 — 채널 페인이 「설비를 고르세요」로 먼저 갈라져 나가,
 * 조회가 실패 상태로 서 있어도 아무 흔적이 남지 않는다. 페인이 언젠가 그 갈림을 잃으면
 * 그때부터 첫 화면에 오류 배너가 선다. 그래서 **조회를 직접 세워 본다.**
 */
describe('채널 조회의 착수 조건', () => {
  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/maintenance/collection-channels',
      respond: () => jsonResponse(channelListResponse()),
    },
  ]);

  it('설비를 고르기 전에는 대기 상태로 남고 실패하지 않는다', async () => {
    const { result } = renderHookWithProviders(() => useChannelList(null, false), { fetch });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.isError).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('설비를 고르면 그때 조회가 나간다', async () => {
    const { result } = renderHookWithProviders(() => useChannelList(3001, false), { fetch });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.items).toHaveLength(4);
  });
});

/** 문구 모듈이 이 화면 것을 가리키는지 — 형제 화면 사본에서 갈아 끼우기를 잊는 자리다. */
describe('문구 소유', () => {
  it('이 화면의 문구 묶음을 쓴다', () => {
    expect(messages.collectionChannel.title).toBe('수집 채널 매핑 관리');
  });
});

/** ⛔ 읽을 수 없는 값을 조건으로 내보내지 않는다 — 서버가 400으로 되받고 원인이 감춰진다. */
describe('공장 조건 읽기', () => {
  it('고른 공장은 숫자 조건이 된다', () => {
    expect(plantIdQuery('11')).toEqual({ plantId: 11 });
  });

  it('고르지 않았으면 조건 자체가 없다', () => {
    expect(plantIdQuery('')).toEqual({});
  });

  it('숫자로 읽을 수 없으면 조건 자체가 없다', () => {
    expect(plantIdQuery('전체')).toEqual({});
  });

  it('0 이하는 식별자가 될 수 없어 조건에서 뺀다', () => {
    expect(plantIdQuery('0')).toEqual({});
    expect(plantIdQuery('-3')).toEqual({});
  });

  it('정수가 아니면 조건에서 뺀다', () => {
    expect(plantIdQuery('1.5')).toEqual({});
  });
});

/**
 * ⭐ **창을 열기 전에는 상세를 조회하지 않는다.**
 *
 * 채널 목록과 같은 이유로 화면에서는 재기 어렵다 — 창 자체가 없으면 아무것도 그리지 않아
 * 실패가 흔적을 남기지 않는다.
 */
describe('채널 상세의 착수 조건', () => {
  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/maintenance/collection-channels/7003',
      respond: () => jsonResponse(makeChannel(7003, 'BARREL_TEMP'), { headers: { ETag: 'W/"3"' } }),
    },
  ]);

  it('창을 열기 전에는 대기 상태로 남고 실패하지 않는다', async () => {
    const { result } = renderHookWithProviders(() => useChannelDetail(null), { fetch });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.isError).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('창을 열면 그때 조회가 나간다', async () => {
    const { result } = renderHookWithProviders(() => useChannelDetail(7003), { fetch });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.channelKey).toBe('BARREL_TEMP');
  });
});

/**
 * ⭐ **계약이 단위를 «코드»로 받는다**(`unitCode`) — 식별자가 아니다.
 * 고르는 값이 코드가 아니면 저장은 되는데 목록에 엉뚱한 값이 선다.
 */
describe('단위 선택 목록', () => {
  const uomsFetch = (body: unknown, status = 200) =>
    createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/uoms',
        respond: () => jsonResponse(body, { status }),
      },
    ]);

  it('고르는 값이 단위 코드다', async () => {
    const { result } = renderHookWithProviders(() => useUomLookup(), {
      fetch: uomsFetch({
        items: [{ uomId: 7, uomCode: 'SEC', uomName: '초', decimalScale: 2, isActive: true }],
        page: { page: 1, size: 100, total: 1 },
      }),
    });

    await waitFor(() => expect(result.current.uoms).toHaveLength(1));
    expect(result.current.uoms[0]).toEqual({ value: 'SEC', label: 'SEC · 초' });
  });

  it('목록이 잘리면 그 사실을 알린다', async () => {
    const { result } = renderHookWithProviders(() => useUomLookup(), {
      fetch: uomsFetch({
        items: [{ uomId: 7, uomCode: 'SEC', uomName: '초', decimalScale: 2, isActive: true }],
        page: { page: 1, size: 100, total: 40 },
      }),
    });

    await waitFor(() => expect(result.current.truncated).toBe(true));
  });

  it('불러오지 못하면 그 사실을 알린다', async () => {
    const { result } = renderHookWithProviders(() => useUomLookup(), {
      fetch: uomsFetch({ errors: [] }, 500),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

/**
 * ⭐ **차례로 좁혀 가는 두 조회도 앞 칸을 고르기 전에는 돌지 않는다.**
 *
 * 창에서 재면 칸이 잠겨 있어 고를 길이 없고, 잠긴 칸 뒤에서 조회가 실패해도 아무 흔적이
 * 남지 않는다. 그래서 조회를 직접 세워 본다.
 */
describe('좁혀 가는 조회의 착수 조건', () => {
  /**
   * ⭐ **나간 요청을 센다.** 「대기 상태로 남는가」를 상태 값으로만 재면, 조회가 실패로
   * 끝나는 것과 아예 서지 않는 것이 한 틱 안에서 구별되지 않는다. 요청은 나갔거나 안 나갔다.
   */
  const spy = (): { fetch: ReturnType<typeof createStubFetch>; sent: Request[] } => {
    const sent: Request[] = [];

    return {
      sent,
      fetch: createStubFetch([
        {
          match: (request) =>
            new URL(request.url).pathname === '/quality/inspection-plan-versions/4101/items',
          respond: (request) => {
            sent.push(request);

            return jsonResponse(specListResponse());
          },
        },
        {
          match: (request) => new URL(request.url).pathname === '/quality/inspection-plan-versions',
          respond: (request) => {
            sent.push(request);

            return jsonResponse(versionListResponse());
          },
        },
      ]),
    };
  };

  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  };

  it('검사기준을 고르기 전에는 버전 조회가 나가지 않는다', async () => {
    const { fetch, sent } = spy();

    const { result } = renderHookWithProviders(() => useInspectionPlanVersions(null), { fetch });

    await settle();

    expect(sent).toHaveLength(0);
    /* 나가지 않는 것과 «실패로 끝나는» 것은 다르다 — 뒤엣것은 없는 고장을 알린다. */
    expect(result.current.isError).toBe(false);
  });

  it('버전을 고르기 전에는 항목 조회가 나가지 않는다', async () => {
    const { fetch, sent } = spy();

    const { result } = renderHookWithProviders(() => useInspectionItemSpecs(null), { fetch });

    await settle();

    expect(sent).toHaveLength(0);
    expect(result.current.isError).toBe(false);
  });

  it('고르면 그때 조회가 나간다', async () => {
    const { fetch, sent } = spy();
    const versions = renderHookWithProviders(() => useInspectionPlanVersions(4001), { fetch });

    await waitFor(() => expect(versions.result.current.items.length).toBeGreaterThan(0));

    const specs = renderHookWithProviders(() => useInspectionItemSpecs(4101), { fetch });

    await waitFor(() => expect(specs.result.current.items.length).toBeGreaterThan(0));
    expect(sent).toHaveLength(2);
  });
});
