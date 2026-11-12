import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import {
  BLOB_URL,
  board,
  contentPath,
  loaded,
  locationButton,
  locationSeed,
  locationTable,
  type LocationSeed,
  OLD_ATTACHMENT_ID,
  pathOf,
  renderScreen,
  rowOf,
  stockRow,
  stubBoardRect,
  stubObjectUrls,
  t,
  TREE_ROWS,
  WAREHOUSE_LABEL,
  withDrawing,
  withoutDrawing,
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

/* 피처 006 — 조회 화면은 상태 확인에만 쓴다(FR-001~FR-003 · FR-012). */
describe('W-CO-08 조회 화면 — 읽기 전용 · [수정] (US2)', () => {
  const editorTitle = t.editor.title(WAREHOUSE_LABEL);

  it('US2-1 SC-003 ⛔ 판을 누르거나 표식을 끌어도 배치가 바뀌지 않는다 — 편집 단추는 [수정] 하나다', async () => {
    const { puts } = renderScreen({ layouts: [withDrawing()] });

    await loaded();
    stubBoardRect(board());

    /* 위치를 고른 채 빈 자리를 눌러도 표식이 생기지 않는다. */
    fireEvent.click(locationButton('SYN-LOC-08'));
    fireEvent.click(board(), { clientX: 140, clientY: 80 });
    expect(within(board()).getAllByRole('button')).toHaveLength(1);

    /* 표식을 끌어도 자리가 그대로다. */
    const pin = within(board()).getByRole('button', { name: 'SYN-LOC-07' });
    fireEvent.pointerDown(pin, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: 60,
      clientY: 50,
    });
    fireEvent.pointerMove(pin, {
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1,
      clientX: 160,
      clientY: 100,
    });
    fireEvent.pointerUp(pin, { pointerId: 1, pointerType: 'mouse', clientX: 160, clientY: 100 });
    fireEvent.keyDown(pin, { key: 'ArrowRight' });
    expect(pin).toHaveAccessibleDescription(t.map.markerPosition(10, 20));

    expect(screen.getByRole('button', { name: t.editor.open })).toBeInTheDocument();
    for (const name of [t.map.upload, t.map.remove, t.map.reset, t.map.save]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryByRole('group', { name: t.map.shape })).toBeNull();
    expect(screen.queryByLabelText(t.map.upload, { selector: 'input' })).toBeNull();
    expect(puts).toHaveLength(0);
  });

  it('US2-2 ⭐ 목록에서 고르면 표식이 강조되고, 안 찍은 위치는 「도면에 없음」이다', async () => {
    const { user } = renderScreen({ layouts: [withDrawing()] });

    await loaded();
    await user.click(locationButton('SYN-LOC-07'));

    expect(within(board()).getByRole('button', { name: 'SYN-LOC-07' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText(t.locations.notOnDrawing)).toBeNull();

    await user.click(locationButton('SYN-LOC-08'));

    expect(within(board()).getByRole('button', { name: 'SYN-LOC-07' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('heading', { name: /SYN-LOC-08/ })).toHaveTextContent(
      t.locations.notOnDrawing,
    );
  });

  it('US2-3 SC-006 ⛔ 세션 권한에 W-CO-08 이 없으면 [수정]이 없다', async () => {
    renderScreen(
      { layouts: [withDrawing()] },
      { session: { ...SYNTHETIC_SESSION, permissions: ['W-CO-07'] } },
    );

    await loaded();
    expect(screen.queryByRole('button', { name: t.editor.open })).toBeNull();
  });

  it('US2-3 권한이 있으면 [수정]이 서고, 누르면 편집 창이 열린다', async () => {
    const { user } = renderScreen(
      { layouts: [withDrawing()] },
      { session: { ...SYNTHETIC_SESSION, permissions: ['W-CO-08'] } },
    );

    await loaded();
    await user.click(screen.getByRole('button', { name: t.editor.open }));

    expect(await screen.findByRole('dialog', { name: editorTitle })).toBeInTheDocument();
  });

  it('EC-6 ⭐ 편집 창이 열린 동안 창고 선택과 「중지된 위치도 보기」가 잠긴다', async () => {
    const { user } = renderScreen({ layouts: [withDrawing()] });

    await loaded();
    const viewList = screen.getByRole('region', { name: t.panes.locations });
    const viewCheckbox = within(viewList).getByRole('checkbox', {
      name: t.locations.includeInactive,
    });
    expect(viewCheckbox).toBeEnabled();

    await user.click(screen.getByRole('button', { name: t.editor.open }));
    await screen.findByRole('dialog', { name: editorTitle });

    expect(viewCheckbox).toBeDisabled();
    expect(within(viewList).getByLabelText(t.warehouse.select)).toBeDisabled();
  });

  it('EC-10 ⭐ 위치가 없는 창고면 창고·Location 화면에서 등록하라고 알리고, 위치를 만드는 단추는 없다(FR-012)', async () => {
    renderScreen({ layouts: [withoutDrawing([])], locations: [] });

    await loaded();

    expect(screen.getByText(t.locations.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(t.locations.emptyGuide(wl.title))).toBeInTheDocument();
    for (const name of [wl.actions.addZone, wl.actions.addRack, wl.actions.addWarehouse]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });
});

/*
 * 피처 006 — 조회 화면의 재고(FR-011 · FR-013 · FR-014). 계층: 구역 Z01(1) › 랙 Z01-R001(7) › 층 Z01-R001-L01(9),
 * 서버 위치 SYS-STAGING(3). 표식은 랙 7 · 층 9 · 적치 대기 3.
 */
describe('W-CO-08 조회 화면 — 재고 (US2)', () => {
  const STOCK_MARKERS = [
    { locationId: 7, x: 0.2, y: 0.2 },
    { locationId: 9, x: 0.4, y: 0.4 },
    { locationId: 3, x: 0.6, y: 0.6 },
  ];
  const BALANCES = [stockRow(9, 'ITEM-A', 'LOT-1', 12), stockRow(9, 'ITEM-B', null, 3)];

  const stockTable = (): HTMLElement => screen.getByRole('table', { name: /재고$/ });

  it('US2-4 SC-007 ⭐ 재고 있는 위치(와 그 위 랙)는 기본 모양, 빈 위치는 옅은 모양이고 범례가 선다', async () => {
    renderScreen({
      layouts: [withDrawing(STOCK_MARKERS)],
      locations: TREE_ROWS,
      balances: BALANCES,
    });

    await loaded();

    await waitFor(() => {
      expect(within(board()).getByRole('button', { name: 'SYS-STAGING' })).toHaveClass(
        'marker-overlay-pin-muted',
      );
    });
    /*
     * 2차(FR-016)로 고쳤다 — 옛 시험은 층(Z01-R001-L01) 표식이 기본 모양으로 그려진다고 기대했다. 층 · 셀 표식은 이제 판에
     * 그리지 않는다. 재고가 조상으로 올라가는 것은 아래 랙 줄이 그대로 잰다.
     */
    expect(within(board()).queryByRole('button', { name: 'Z01-R001-L01' })).toBeNull();
    /* 랙은 아래 층에 재고가 있어 「있음」이다. */
    expect(within(board()).getByRole('button', { name: 'Z01-R001' })).not.toHaveClass(
      'marker-overlay-pin-muted',
    );
    expect(screen.getByText(t.stock.legendStocked)).toBeInTheDocument();
    expect(screen.getByText(t.stock.legendEmpty)).toBeInTheDocument();
  });

  it('US2-5 ⭐ 재고 있는 위치를 고르면 위치 · 품목 · LOT · 현재고 · 단위 · 품질 상태 이름이 보인다', async () => {
    const { user } = renderScreen({
      layouts: [withDrawing(STOCK_MARKERS)],
      locations: TREE_ROWS,
      balances: BALANCES,
    });

    await loaded();
    expect(await screen.findByText(t.stock.pickHint)).toBeInTheDocument();

    await user.click(locationButton('Z01-R001'));
    await user.click(
      within(rowOf('Z01-R001')).getByRole('button', { name: wl.locationTable.expand }),
    );
    await user.click(locationButton('Z01-R001-L01'));

    const table = await screen.findByRole('table', { name: t.stock.title('Z01-R001-L01') });
    /* 좁은 구획에서 칸을 깨지 않고 옆으로 미는 감싸개 안에 선다. */
    expect(table.closest('.layout-stock-scroll')).not.toBeNull();
    const rows = within(table).getAllByRole('row').slice(1);

    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText('Z01-R001-L01')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('ITEM-A')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('ITEM-A 합성 품목')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('LOT-1')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('12 EA')).toBeInTheDocument();
    expect(await within(rows[0] as HTMLElement).findByText('정상')).toBeInTheDocument();
  });

  it('US2-5 ⭐ 랙을 고르면 하위 위치의 줄이 위치 칸과 함께 보이고, 빈 위치는 「재고 없음」이다', async () => {
    const { user } = renderScreen({
      layouts: [withDrawing(STOCK_MARKERS)],
      locations: TREE_ROWS,
      balances: BALANCES,
    });

    await loaded();
    await user.click(await waitFor(() => locationButton('Z01-R001')));

    const rack = await screen.findByRole('table', { name: t.stock.title('Z01-R001') });
    expect(within(rack).getAllByText('Z01-R001-L01')).toHaveLength(2);

    await user.click(locationButton('SYS-STAGING'));
    expect(await screen.findByText(t.stock.empty)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /재고$/ })).toBeNull();
  });

  it('EC-7 ⭐ 재고를 못 받으면 배치는 보이고 표식은 모두 기본 모양이며 「다시 시도」가 선다', async () => {
    const { user, stockGets } = renderScreen({
      layouts: [withDrawing(STOCK_MARKERS)],
      locations: TREE_ROWS,
      stock: [
        () => jsonResponse({ message: '서버에 문제가 있습니다.' }, { status: 500 }),
        () => jsonResponse({ items: BALANCES, page: { page: 1, size: 200, total: 2 } }),
      ],
    });

    await loaded();

    expect(await screen.findByText(t.stock.loadFailed)).toBeInTheDocument();
    for (const pin of within(board()).getAllByRole('button')) {
      expect(pin).not.toHaveClass('marker-overlay-pin-muted');
    }
    expect(screen.queryByText(t.stock.legendStocked)).toBeNull();

    await user.click(screen.getByRole('button', { name: t.stock.retry }));

    await waitFor(() => {
      expect(within(board()).getByRole('button', { name: 'SYS-STAGING' })).toHaveClass(
        'marker-overlay-pin-muted',
      );
    });
    expect(stockGets).toHaveLength(2);
  });

  it('⭐ 재고가 잘렸으면 「재고 일부만 보입니다」가 선다', async () => {
    renderScreen({
      layouts: [withDrawing(STOCK_MARKERS)],
      locations: TREE_ROWS,
      stock: [() => jsonResponse({ items: BALANCES, page: { page: 1, size: 200, total: 9999 } })],
    });

    await loaded();
    expect(await screen.findByText(t.stock.truncated)).toBeInTheDocument();
  });

  it('EC-8 FR-014 ⛔ 편집 창에는 재고 모양 · 범례 · 재고 표가 없다', async () => {
    const { user } = renderScreen({
      layouts: [withDrawing(STOCK_MARKERS)],
      locations: TREE_ROWS,
      balances: BALANCES,
    });

    await loaded();
    await waitFor(() => {
      expect(within(board()).getByRole('button', { name: 'SYS-STAGING' })).toHaveClass(
        'marker-overlay-pin-muted',
      );
    });
    await user.click(screen.getByRole('button', { name: t.editor.open }));

    const dialog = await screen.findByRole('dialog', { name: t.editor.title(WAREHOUSE_LABEL) });
    const editorBoard = await within(dialog).findByRole('group', { name: t.map.imageLabel });

    for (const pin of within(editorBoard).getAllByRole('button')) {
      expect(pin).not.toHaveClass('marker-overlay-pin-muted');
    }
    expect(within(dialog).queryByText(t.stock.legendStocked)).toBeNull();
    expect(within(dialog).queryByText(t.stock.pickHint)).toBeNull();
  });

  it('⭐ 저장한 뒤 재고를 다시 읽는다', async () => {
    const { user, stockGets } = renderScreen({
      layouts: [withDrawing(STOCK_MARKERS)],
      locations: TREE_ROWS,
      balances: BALANCES,
    });

    await loaded();
    await waitFor(() => {
      expect(stockGets).toHaveLength(1);
    });
    await user.click(screen.getByRole('button', { name: t.editor.open }));

    const dialog = await screen.findByRole('dialog', { name: t.editor.title(WAREHOUSE_LABEL) });
    await user.click(
      within(within(dialog).getByRole('region', { name: t.panes.locations })).getByRole('button', {
        name: 'SYS-STAGING',
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: t.map.remove }));
    await user.click(within(dialog).getByRole('button', { name: t.map.save }));

    expect(await screen.findByText(t.map.saved)).toBeInTheDocument();
    await waitFor(() => {
      expect(stockGets).toHaveLength(2);
    });
  });
});

/*
 * 2차 변경(FR-015 · FR-016 · R2-3 · R2-7) — 도면에는 구역 · 랙만. 층 · 셀을 고르면 그 위치가 든 랙(없으면 구역) 표식을 강조하고,
 * 목록 「도면」 칸은 구역 · 랙 줄에만 찍음/아직을 보인다.
 */
describe('W-CO-08 조회 화면 — 구역 · 랙만 배치 (2차)', () => {
  /** 구역 Z01(1) › 랙 Z01-R001(7) › 층 Z01-R001-L01(9) › 셀 Z01-R001-L01-C01(10), 적치 대기(3). */
  const ROWS_WITH_CELL: LocationSeed[] = [
    ...TREE_ROWS,
    locationSeed(10, 'Z01-R001-L01-C01', { parentLocationId: 9, locationLevelCode: 'CELL' }),
  ];
  /** 랙 표식과, 2차 전에 저장된 셀 표식. */
  const MARKERS = [
    { locationId: 7, x: 0.2, y: 0.2 },
    { locationId: 10, x: 0.6, y: 0.6 },
  ];

  it('US2-2 ⭐ 셀을 고르면 랙 표식이 강조되고 재고 머리에 「도면에서 Z01-R001 안」, 셀 표식은 판에 없다', async () => {
    const { user } = renderScreen({
      layouts: [withDrawing(MARKERS)],
      locations: ROWS_WITH_CELL,
      balances: [stockRow(10, 'ITEM-A', 'LOT-1', 5)],
    });

    await loaded();
    await waitFor(() => locationButton('Z01-R001'));
    expect(within(board()).queryByRole('button', { name: 'Z01-R001-L01-C01' })).toBeNull();

    await user.click(
      within(rowOf('Z01-R001')).getByRole('button', { name: wl.locationTable.expand }),
    );
    await user.click(
      within(rowOf('Z01-R001-L01')).getByRole('button', { name: wl.locationTable.expand }),
    );
    await user.click(locationButton('Z01-R001-L01-C01'));

    expect(within(board()).getByRole('button', { name: 'Z01-R001' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const heading = screen.getByRole('heading', { name: /Z01-R001-L01-C01/ });
    expect(heading).toHaveTextContent(t.locations.insideOnDrawing('Z01-R001'));
    expect(heading).not.toHaveTextContent(t.locations.notOnDrawing);
    /* 재고 표는 고른 셀 기준 그대로다. */
    expect(
      await screen.findByRole('table', { name: t.stock.title('Z01-R001-L01-C01') }),
    ).toBeInTheDocument();
  });

  it('US2-2 R2-7 ⭐ 목록 「도면」 칸은 구역 · 랙 줄에만 찍음/아직이고, 층 · 셀 줄은 비어 있다', async () => {
    const { user } = renderScreen({ layouts: [withDrawing(MARKERS)], locations: ROWS_WITH_CELL });

    await loaded();
    await waitFor(() => locationButton('Z01-R001'));
    await user.click(screen.getByRole('button', { name: wl.locationTable.collapseAll }));
    await user.click(screen.getByRole('button', { name: wl.locationTable.expandAll }));

    expect(within(rowOf('Z01-R001')).getByText(t.locations.onMap)).toBeInTheDocument();
    expect(within(rowOf('Z01')).getByText(t.locations.notOnMap)).toBeInTheDocument();
    for (const code of ['Z01-R001-L01', 'Z01-R001-L01-C01']) {
      /* 저장된 셀 표식이 있어도 「찍음」이 아니다 — 그리지 않는 표식이다. */
      expect(within(rowOf(code)).queryByText(t.locations.onMap)).toBeNull();
      expect(within(rowOf(code)).queryByText(t.locations.notOnMap)).toBeNull();
    }
  });
});
