import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInspectionDrawings } from '../../patterns/inspection-drawings';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { VersionDrawings, drawingFileProblem } from './version-drawings';

const t = messages.inspectionStandard.versionSection;
const VERSION = 11;
const BASE = `/quality/inspection-plan-versions/${String(VERSION)}/drawings`;

const Harness = ({ isEditable }: { isEditable: boolean }) => (
  <VersionDrawings
    versionId={VERSION}
    drawings={useInspectionDrawings(VERSION)}
    isEditable={isEditable}
  />
);

const attachment = (attachmentId: number) => ({
  attachmentId,
  targetTypeCode: 'INSPECTION_PLAN_VERSION',
  targetId: VERSION,
  fileName: `d${String(attachmentId)}.png`,
  contentType: 'image/png',
  byteSize: 10,
  uploadedAt: '2026-11-03T00:00:00Z',
  uploadedBy: 1,
});

/** 서버 도면 목록을 흉내 낸다 — 쓰기 요청을 기록하고 목록에 반영한다. */
const drawingServer = (initial: number[]) => {
  let ids = [...initial];
  let next = Math.max(0, ...initial) + 1;
  const writes: { method: string; path: string; idempotency: string | null }[] = [];
  const fetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname.endsWith('/app/attachments')) {
      return jsonResponse({ items: ids.map(attachment) });
    }
    if (request.method === 'GET' && url.pathname.endsWith('/content')) {
      return new Response(new Blob(['x'], { type: 'image/png' }), {
        headers: { 'Content-Type': 'image/png' },
      });
    }
    writes.push({
      method: request.method,
      path: url.pathname,
      idempotency: request.headers.get('Idempotency-Key'),
    });
    const id = Number(url.pathname.split('/').at(-1));
    if (request.method === 'POST') {
      ids = [...ids, next];
      next += 1;
      return jsonResponse(attachment(ids.at(-1) as number), { status: 201 });
    }
    if (request.method === 'PUT') return jsonResponse(attachment(id));
    if (request.method === 'DELETE') {
      ids = ids.filter((each) => each !== id);
      return new Response(null, { status: 204 });
    }
    throw new Error(`스텁 없음: ${request.method} ${url.pathname}`);
  };
  return { fetch, writes };
};

const png = (name = 'a.png') => new File(['x'], name, { type: 'image/png' });

describe('검사 기준 도면 탭 추가·수정·제거 (omf-all-around#227)', () => {
  beforeEach(() => {
    let seq = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:d/${String(++seq)}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PNG·JPEG 가 아니거나 10MB 를 넘으면 보내기 전에 막는다', () => {
    expect(drawingFileProblem(png())).toBeNull();
    expect(drawingFileProblem(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBeNull();
    expect(drawingFileProblem(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBe(
      t.drawingFileInvalid,
    );
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    expect(drawingFileProblem(big)).toBe(t.drawingFileTooLarge);
  });

  it('확정 버전이면 단추 없이 보기만 한다', async () => {
    const { fetch } = drawingServer([1]);
    renderWithProviders(<Harness isEditable={false} />, { fetch, session: null });
    expect(await screen.findByRole('img', { name: t.drawingAlt(1) })).toBeVisible();
    expect(screen.queryByRole('button', { name: t.drawingAdd })).toBeNull();
    expect(screen.queryByRole('button', { name: t.drawingRemove })).toBeNull();
  });

  it('도면이 없는 작성 중 버전은 「등록된 도면이 없습니다」만 보이고, 고른 그림을 붙인 뒤 그 도면을 보인다', async () => {
    const user = userEvent.setup();
    const { fetch, writes } = drawingServer([]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    expect(await screen.findByText(t.drawingsNone)).toBeVisible();
    expect(screen.queryByRole('button', { name: t.drawingReplace })).toBeNull();

    await user.upload(screen.getByTestId('drawing-file-input'), png());

    expect(await screen.findByRole('img', { name: t.drawingAlt(1) })).toBeVisible();
    expect(writes).toEqual([
      { method: 'POST', path: `${BASE}`, idempotency: expect.any(String) as string },
    ]);
  });

  it('그림이 아닌 파일은 서버에 보내지 않고 이유를 보인다', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { fetch, writes } = drawingServer([1]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    await screen.findByRole('img', { name: t.drawingAlt(1) });

    await user.upload(
      screen.getByTestId('drawing-file-input'),
      new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }),
    );

    expect(screen.getByText(t.drawingFileInvalid)).toBeVisible();
    expect(writes).toEqual([]);
  });

  it('[도면 수정]은 보고 있는 도면 자리를 바꾼다', async () => {
    const user = userEvent.setup();
    const { fetch, writes } = drawingServer([1, 2]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    await screen.findByRole('img', { name: t.drawingAlt(1) });
    await user.click(screen.getByRole('button', { name: t.drawingNext }));

    await user.click(screen.getByRole('button', { name: t.drawingReplace }));
    await user.upload(screen.getByTestId('drawing-file-input'), png('b.png'));

    await waitFor(() =>
      expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([`PUT ${BASE}/2`]),
    );
    expect(await screen.findByRole('img', { name: t.drawingAlt(2) })).toBeVisible();
  });

  it('[도면 제거]는 확인 창을 거쳐 보고 있는 도면을 제거하고, 취소하면 보내지 않는다', async () => {
    const user = userEvent.setup();
    const { fetch, writes } = drawingServer([1, 2]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    await screen.findByRole('img', { name: t.drawingAlt(1) });

    await user.click(screen.getByRole('button', { name: t.drawingRemove }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: messages.common.cancel }),
    );
    expect(writes).toEqual([]);

    await user.click(screen.getByRole('button', { name: t.drawingRemove }));
    const dialog = screen.getByRole('dialog', { name: t.drawingRemoveTitle });
    await user.click(within(dialog).getByRole('button', { name: t.drawingRemoveConfirm }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([`DELETE ${BASE}/1`]);
    await waitFor(() => expect(screen.queryByRole('button', { name: t.drawingNext })).toBeNull());
  });
});
