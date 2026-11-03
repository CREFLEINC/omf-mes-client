import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInspectionDrawings } from '../../patterns/inspection-drawings';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { VersionDrawings, drawingFileProblem, useVersionDrawingDraft } from './version-drawings';

const t = messages.inspectionStandard.versionSection;
const VERSION = 11;
const BASE = `/quality/inspection-plan-versions/${String(VERSION)}/drawings`;

const Harness = ({ isEditable }: { isEditable: boolean }) => {
  const drawings = useInspectionDrawings(VERSION);
  const draft = useVersionDrawingDraft(VERSION, drawings);
  return (
    <>
      <span data-testid="draft-count">{draft.list.length}</span>
      <VersionDrawings drawings={drawings} draft={draft} isEditable={isEditable} />
    </>
  );
};

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
      /* 본문은 글자로 준다 — 화면 쪽 Blob 을 응답에 넣으면 내용이 「[object Blob]」으로 바뀐다. 그림 내용은 'x'. */
      return new Response('x', {
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

describe('검사 기준 도면 탭 추가·수정·제거 후 저장 (omf-all-around#227)', () => {
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
    expect(
      screen.queryByRole('button', { name: messages.inspectionStandard.actions.tempSave }),
    ).toBeNull();
  });

  it('추가는 [저장]을 눌러야 보낸다 — 그 전에는 화면에만 붙고, 저장 단추는 변경이 있어야 눌린다', async () => {
    const user = userEvent.setup();
    const { fetch, writes } = drawingServer([]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    expect(await screen.findByText(t.drawingsNone)).toBeVisible();
    expect(
      screen.getByRole('button', { name: messages.inspectionStandard.actions.tempSave }),
    ).toBeDisabled();
    expect(screen.queryByRole('button', { name: t.drawingReplace })).toBeNull();

    await user.upload(screen.getByTestId('drawing-file-input'), png());

    expect(await screen.findByRole('img', { name: t.drawingAlt(1) })).toBeVisible();
    expect(screen.getByTestId('draft-count')).toHaveTextContent('1');
    expect(writes).toEqual([]);

    await user.click(
      screen.getByRole('button', { name: messages.inspectionStandard.actions.tempSave }),
    );

    await waitFor(() =>
      expect(writes).toEqual([
        { method: 'POST', path: BASE, idempotency: expect.any(String) as string },
      ]),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: messages.inspectionStandard.actions.tempSave }),
      ).toBeDisabled(),
    );
  });

  it('그림이 아닌 파일은 담지 않고 이유를 보인다', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { fetch, writes } = drawingServer([1]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    await screen.findByRole('img', { name: t.drawingAlt(1) });

    await user.upload(
      screen.getByTestId('drawing-file-input'),
      new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }),
    );

    expect(screen.getByText(t.drawingFileInvalid)).toBeVisible();
    expect(
      screen.getByRole('button', { name: messages.inspectionStandard.actions.tempSave }),
    ).toBeDisabled();
    expect(writes).toEqual([]);
  });

  it('[도면 수정]은 보고 있는 도면 자리를 바꾸고, 저장하면 그 도면만 보낸다', async () => {
    const user = userEvent.setup();
    const { fetch, writes } = drawingServer([1, 2]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    await screen.findByRole('img', { name: t.drawingAlt(1) });
    await user.click(screen.getByRole('button', { name: t.drawingNext }));

    await user.click(screen.getByRole('button', { name: t.drawingReplace }));
    await user.upload(
      screen.getByTestId('drawing-file-input'),
      new File(['b'], 'b.png', { type: 'image/png' }),
    );
    expect(writes).toEqual([]);
    expect(screen.getByRole('img', { name: t.drawingAlt(2) })).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: messages.inspectionStandard.actions.tempSave }),
    );

    await waitFor(() =>
      expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([`PUT ${BASE}/2`]),
    );
  });

  it('[도면 제거]는 확인 창을 거쳐 화면에서 빼고, 저장하면 지운다', async () => {
    const user = userEvent.setup();
    const { fetch, writes } = drawingServer([1, 2]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    await screen.findByRole('img', { name: t.drawingAlt(1) });

    await user.click(screen.getByRole('button', { name: t.drawingRemove }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: messages.common.cancel }),
    );
    expect(screen.getByTestId('draft-count')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: t.drawingRemove }));
    const dialog = screen.getByRole('dialog', { name: t.drawingRemoveTitle });
    await user.click(within(dialog).getByRole('button', { name: t.drawingRemoveConfirm }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('draft-count')).toHaveTextContent('1');
    expect(writes).toEqual([]);

    await user.click(
      screen.getByRole('button', { name: messages.inspectionStandard.actions.tempSave }),
    );

    await waitFor(() =>
      expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([`DELETE ${BASE}/1`]),
    );
  });

  it('이미 붙은 도면과 같은 그림은 추가 · 수정 모두 막고 이유를 보인다', async () => {
    const user = userEvent.setup();
    const { fetch, writes } = drawingServer([1]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    await screen.findByRole('img', { name: t.drawingAlt(1) });

    /* 저장된 도면(내용 'x')과 같은 그림 — 이름이 달라도 막는다. */
    await user.upload(screen.getByTestId('drawing-file-input'), png('other-name.png'));
    expect(await screen.findByText(t.drawingDuplicate)).toBeVisible();
    expect(screen.getByTestId('draft-count')).toHaveTextContent('1');

    /* 저장 전 추가한 그림과 같은 그림도 막는다. */
    await user.upload(
      screen.getByTestId('drawing-file-input'),
      new File(['y'], 'y.png', { type: 'image/png' }),
    );
    await waitFor(() => expect(screen.getByTestId('draft-count')).toHaveTextContent('2'));
    await user.click(screen.getByRole('button', { name: t.drawingReplace }));
    await user.upload(
      screen.getByTestId('drawing-file-input'),
      new File(['x'], 'again.png', { type: 'image/png' }),
    );
    expect(await screen.findByText(t.drawingDuplicate)).toBeVisible();
    expect(writes).toEqual([]);
  });

  it('[도면 추가]는 여러 장을 한 번에 붙이고, 막힌 파일만 이름과 이유를 보인다', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { fetch, writes } = drawingServer([1]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    await screen.findByRole('img', { name: t.drawingAlt(1) });

    /* [도면 추가]를 눌러야 파일 칸이 여러 장 고르기로 열린다. */
    await user.click(screen.getByRole('button', { name: t.drawingAdd }));
    expect(screen.getByTestId('drawing-file-input')).toHaveProperty('multiple', true);
    await user.upload(screen.getByTestId('drawing-file-input'), [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
      new File(['a'], 'a-copy.png', { type: 'image/png' }),
      new File(['%PDF'], 'c.pdf', { type: 'application/pdf' }),
    ]);

    await waitFor(() => expect(screen.getByTestId('draft-count')).toHaveTextContent('3'));
    expect(screen.getByText(`a-copy.png — ${t.drawingDuplicate}`)).toBeVisible();
    expect(screen.getByText(`c.pdf — ${t.drawingFileInvalid}`)).toBeVisible();
    expect(writes).toEqual([]);

    await user.click(
      screen.getByRole('button', { name: messages.inspectionStandard.actions.tempSave }),
    );
    await waitFor(() =>
      expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([`POST ${BASE}`, `POST ${BASE}`]),
    );
  });

  it('바닥에는 [임시 저장]만 둔다 — [취소] 단추가 없다', async () => {
    const { fetch } = drawingServer([1]);
    renderWithProviders(<Harness isEditable />, { fetch, session: null });
    await screen.findByRole('img', { name: t.drawingAlt(1) });
    expect(screen.queryByRole('button', { name: messages.common.cancel })).toBeNull();
  });
});
