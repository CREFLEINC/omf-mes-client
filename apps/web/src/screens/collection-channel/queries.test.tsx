import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { channelListResponse } from './fixtures';
import { plantIdQuery, useChannelList } from './queries';

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
