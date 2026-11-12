import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, type StubRoute } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import {
  board,
  listBody,
  loaded,
  locationSeed,
  type LocationSeed,
  pathOf,
  renderEditor,
  rowOf,
  stubObjectUrls,
  t,
  withDrawing,
  wl,
} from './test-harness';

/**
 * 편집 창 별칭 고치기(#267 FR-007a · 계약 §4 · plan R-5b) — 연필 → 팝오버 → 바로 저장. 배치도 편집 상태(draft · dirty)와 따로.
 */

stubObjectUrls();

const ROWS: LocationSeed[] = [
  locationSeed(1, 'Z01', { locationName: 'Z01', isLeaf: false }),
  locationSeed(7, 'Z01-R001', {
    parentLocationId: 1,
    locationLevelCode: 'RACK',
    locationName: 'Z01-R001',
  }),
];
const MARKERS = [
  { locationId: 1, x: 0.5, y: 0.1, width: 0.2, height: 0.05 },
  { locationId: 7, x: 0.5, y: 0.5, width: 0.3, height: 0.1 },
];

interface Recorded {
  path: string;
  ifMatch: string | null;
  body: Record<string, unknown>;
}

/** 위치 상세 · 수정 · 목록을 한 벌로 — 저장하면 목록도 새 별칭을 돌려준다(서버와 같게). */
const aliasServer = (options: { putStatus?: number } = {}) => {
  const rows = ROWS.map((row) => ({ ...row }));
  const puts: Recorded[] = [];
  const routes: StubRoute[] = [
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/mdm/locations',
      respond: () => jsonResponse(listBody(rows)),
    },
    {
      match: (request) =>
        request.method === 'GET' && /^\/mdm\/locations\/\d+$/.test(pathOf(request)),
      respond: (request) => {
        const id = Number(pathOf(request).split('/').pop());
        return jsonResponse(
          {
            location: rows.find((row) => row.locationId === id),
            editability: { codeEditable: false, reason: 'EDITABLE' },
          },
          { headers: { ETag: '"3"' } },
        );
      },
    },
    {
      match: (request) =>
        request.method === 'PUT' && /^\/mdm\/locations\/\d+$/.test(pathOf(request)),
      respond: async (request) => {
        const id = Number(pathOf(request).split('/').pop());
        const body = (await request.clone().json()) as Record<string, unknown>;
        puts.push({ path: pathOf(request), ifMatch: request.headers.get('If-Match'), body });
        if (options.putStatus === 409) {
          return jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 });
        }
        const row = rows.find((each) => each.locationId === id)!;
        row.aliasName = (body.aliasName as string | null) ?? null;
        row.locationName = String(body.locationName);
        return jsonResponse(row);
      },
    },
  ];
  return { routes, puts };
};

const pencil = (code: string): HTMLElement =>
  within(rowOf(code)).getByRole('button', { name: wl.aliasEdit.edit(code) });

const popover = (code: string): HTMLElement =>
  screen.getByRole('dialog', { name: t.aliasPopover.title(code) });

describe('W-CO-08 편집 창 — 별칭 고치기 (#267 FR-007a)', () => {
  it('FR-007a ⭐ 연필 → 팝오버에서 저장하면 표식 이름이 바로 바뀌고, 배치도 저장은 꺼진 채다', async () => {
    const server = aliasServer();
    const { user, onClose } = renderEditor({
      layouts: [withDrawing(MARKERS)],
      locations: ROWS,
      extraRoutes: server.routes,
    });

    await loaded();
    expect(within(board()).getByRole('button', { name: 'Z01-R001' })).toBeInTheDocument();

    await user.click(pencil('Z01-R001'));
    expect(within(popover('Z01-R001')).getByText(t.aliasPopover.note)).toBeInTheDocument();
    const input = within(popover('Z01-R001')).getByRole('textbox', {
      name: wl.aliasEdit.edit('Z01-R001'),
    });
    await user.type(input, 'A열 1번 랙{Enter}');

    await waitFor(() => expect(server.puts).toHaveLength(1));
    expect(server.puts[0]).toEqual({
      path: '/mdm/locations/7',
      ifMatch: '"3"',
      body: { locationName: 'A열 1번 랙', aliasName: 'A열 1번 랙' },
    });
    expect(
      await within(board()).findByRole('button', { name: 'Z01-R001 A열 1번 랙' }),
    ).toHaveTextContent('A열 1번 랙');
    expect(screen.queryByRole('dialog', { name: t.aliasPopover.title('Z01-R001') })).toBeNull();

    /* ⛔ 배치 변경이 아니다 — 저장 단추는 꺼진 채, 닫을 때 묻지 않는다. */
    expect(screen.getByRole('button', { name: t.map.save })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: t.editor.cancel }));
    expect(screen.queryByRole('dialog', { name: t.editor.discardTitle })).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('FR-007a Esc 는 팝오버만 닫는다 — 저장하지 않고 편집 창은 그대로다', async () => {
    const server = aliasServer();
    const { user, onClose } = renderEditor({
      layouts: [withDrawing(MARKERS)],
      locations: ROWS,
      extraRoutes: server.routes,
    });

    await loaded();
    await user.click(pencil('Z01'));
    const input = within(popover('Z01')).getByRole('textbox', { name: wl.aliasEdit.edit('Z01') });
    await user.type(input, '바뀜');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: t.aliasPopover.title('Z01') })).toBeNull();
    expect(server.puts).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('FR-007a 남이 먼저 고쳤으면(409) 팝오버에 충돌 안내가 뜨고 열린 채다', async () => {
    const server = aliasServer({ putStatus: 409 });
    const { user } = renderEditor({
      layouts: [withDrawing(MARKERS)],
      locations: ROWS,
      extraRoutes: server.routes,
    });

    await loaded();
    await user.click(pencil('Z01'));
    await user.type(
      within(popover('Z01')).getByRole('textbox', { name: wl.aliasEdit.edit('Z01') }),
      'A동{Enter}',
    );

    expect(await within(popover('Z01')).findByText(wl.aliasEdit.conflict)).toBeInTheDocument();
  });

  it('FR-007a ⛔ 세션 권한에 W-06-07 이 없으면 연필이 없다', async () => {
    renderEditor(
      { layouts: [withDrawing(MARKERS)], locations: ROWS },
      { session: { ...SYNTHETIC_SESSION, permissions: ['W-CO-08'] } },
    );

    await loaded();
    expect(
      within(rowOf('Z01')).queryByRole('button', { name: wl.aliasEdit.edit('Z01') }),
    ).toBeNull();
  });

  it('FR-007a W-CO-08 과 W-06-07 이 다 있으면 구역 · 랙 줄에 연필이 있다', async () => {
    renderEditor(
      { layouts: [withDrawing(MARKERS)], locations: ROWS },
      { session: { ...SYNTHETIC_SESSION, permissions: ['W-CO-08', 'W-06-07'] } },
    );

    await loaded();
    expect(pencil('Z01')).toBeInTheDocument();
    expect(pencil('Z01-R001')).toBeInTheDocument();
  });
});
