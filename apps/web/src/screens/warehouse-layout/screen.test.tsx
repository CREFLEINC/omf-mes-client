import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse } from '../../test/api-harness';
import {
  BLOB_URL,
  board,
  contentPath,
  loaded,
  locationButton,
  locationTable,
  OLD_ATTACHMENT_ID,
  pathOf,
  renderScreen,
  rowOf,
  stubObjectUrls,
  t,
  TREE_ROWS,
  withDrawing,
  wl,
} from './test-harness';

/**
 * W-CO-08 조회 화면 — **도면이 보이고, 위치 계층이 맞는가.**
 *
 * ⭐ 도면 주소를 잘못 만들면 「깨진 그림」 하나만 남는다. 편집(찍기 · 저장 · 도면 교체)은 편집 창 시험
 * (`layout-editor-dialog.test.tsx`)이 본다.
 */

stubObjectUrls();

describe('W-CO-08 창고 배치도 — 조건 상자', () => {
  it('⭐ 창고·Location 과 같은 조건으로 창고를 걸러 고른다 — 창고 등록 단추는 없다', async () => {
    const { user, warehouseGets } = renderScreen({ layouts: [withDrawing([])] });

    await loaded();
    expect(screen.queryByRole('button', { name: wl.actions.addWarehouse })).toBeNull();

    await user.type(screen.getByRole('searchbox', { name: wl.filters.searchLabel }), 'SYN');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(
        warehouseGets.some((request) => new URL(request.url).searchParams.get('q') === 'SYN'),
      ).toBe(true);
    });
    /* 고른 창고와 그 위치 계층은 그대로다. */
    expect(locationButton('SYN-LOC-07')).toBeInTheDocument();
  });
});

describe('W-CO-08 창고 배치도 — 위치 계층', () => {
  it('⭐ 처음엔 구역만 펼쳐 랙까지 보이고, 펼치면 층이 나온다', async () => {
    const { user } = renderScreen({ layouts: [withDrawing([])], locations: TREE_ROWS });

    await loaded();
    await screen.findByText('Z01-R001');

    expect(within(locationTable()).queryByText('Z01-R001-L01')).toBeNull();

    await user.click(
      within(rowOf('Z01-R001')).getByRole('button', { name: wl.locationTable.expand }),
    );
    expect(within(locationTable()).getByText('Z01-R001-L01')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: wl.locationTable.collapseAll }));
    expect(within(locationTable()).queryByText('Z01-R001')).toBeNull();

    await user.click(screen.getByRole('button', { name: wl.locationTable.expandAll }));
    expect(within(locationTable()).getByText('Z01-R001-L01')).toBeInTheDocument();
  });

  it('⭐ 「구분」 열이 단계 이름을 — 서버가 만든 위치는 역할 이름을 — 보인다', async () => {
    renderScreen({ layouts: [withDrawing([])], locations: TREE_ROWS });

    await loaded();
    await screen.findByText('Z01-R001');

    expect(within(rowOf('Z01')).getByText(wl.values.locationLevels.ZONE)).toBeInTheDocument();
    expect(within(rowOf('Z01-R001')).getByText(wl.values.locationLevels.RACK)).toBeInTheDocument();
    expect(
      within(rowOf('SYS-STAGING')).getByText(wl.values.systemRoles.PUTAWAY_STAGING),
    ).toBeInTheDocument();
    /* 이름은 별칭이 먼저다 — Location 목록과 같다. */
    expect(within(rowOf('Z01')).getByText('A구역')).toBeInTheDocument();
  });
});

describe('W-CO-08 창고 배치도 — 도면 보이기', () => {
  it('⭐ 도면 내용을 받아 blob 주소로 그린다 — 화면을 떠나면 그 주소를 되돌려준다', async () => {
    const { contentGets, unmount } = renderScreen({ layouts: [withDrawing()] });

    await loaded();

    const image = await screen.findByRole('img', { name: t.map.imageLabel });

    expect(image).toHaveAttribute('src', BLOB_URL);
    expect(contentGets).toHaveLength(1);
    expect(pathOf(contentGets[0] as Request)).toBe(contentPath(OLD_ATTACHMENT_ID));

    unmount();

    /* ⛔ 되돌려주지 않으면 도면 수 MB 가 문서가 닫힐 때까지 남는다 — 화면에 증상이 없다. */
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(BLOB_URL);
  });

  it('⛔ 도면을 못 받으면 깨진 그림이 아니라 사유와 다시 불러오기를 낸다(404 포함)', async () => {
    renderScreen({
      layouts: [withDrawing()],
      content: () => jsonResponse({ message: '없는 첨부입니다.' }, { status: 404 }),
    });

    await loaded();

    expect(await screen.findByText(t.map.drawingLoadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.map.drawingRetry })).toBeInTheDocument();
    /* 주소가 없으면 `<img>` 자체를 그리지 않는다 — 깨진 그림은 사유를 말하지 못한다. */
    expect(screen.queryByRole('img', { name: t.map.imageLabel })).toBeNull();
  });

  /*
   * ⭐ **표식의 자리는 듣는 사람에게 글로만 전해진다.** 판 부품은 표현 전용이라 사람의 말을
   * 갖지 않고 숫자만 낸다(`"10% / 20%"`) — 그 말을 화면이 넘기지 않으면 낭독기가 듣는 것은
   * 숫자뿐이다. 여기서 재는 것은 부품의 기본값이 아니라 **이 화면이 문구를 넘겼는가**다.
   */
  it('⭐ 표식의 자리가 화면의 말로 읽힌다 — 숫자만 들리지 않는다', async () => {
    renderScreen({ layouts: [withDrawing()] });

    await loaded();

    const pin = within(board()).getByRole('button', { name: 'SYN-LOC-07' });

    expect(pin).toHaveAccessibleDescription(t.map.markerPosition(10, 20));
  });
});
