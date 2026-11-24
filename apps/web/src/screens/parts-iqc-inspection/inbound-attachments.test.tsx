import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { InboundAttachDialog, InboundAttachmentTable } from './inbound-attachments';

/**
 * omf-all-around#296 — 검사 결과 상자의 파일 첨부: 파일 · 연결할 자재 관리 LOT 를 고르고 [저장]하면 고른 LOT 마다 붙고,
 * 표는 여러 LOT 에 붙은 같은 파일을 한 줄로 모은다. 지어낸 값만 쓴다.
 */
const t = messages.iqcInboundLot.attachments;

const lot = (lotId: number) => ({
  lotId,
  lotNo: `TST-ITEM|1000|991111|TS01|${String(lotId).padStart(4, '0')}`,
  lotQty: 1000,
  package: null,
  statusCode: 'INSPECTION_PENDING',
  goodsReceived: false,
});
const LOTS = [lot(1), lot(2), lot(3)];

const attachment = (attachmentId: number, targetId: number, fileName: string) => ({
  attachmentId,
  targetId,
  fileName,
  contentType: 'application/pdf',
  byteSize: 2048,
  uploadedAt: '2099-11-11T01:00:00Z',
  uploadedBy: 9,
});

const path = (request: Request) => new URL(request.url).pathname;

describe('IQC 입하 LOT 파일 첨부', () => {
  it('파일 · LOT 를 고르지 않으면 저장하지 않고, 고르면 고른 LOT 마다 올린다', async () => {
    const user = userEvent.setup();
    const posted: { targetTypeCode: string; targetId: string; hasFile: boolean }[] = [];
    const fetch = createStubFetch([
      {
        match: (request) => request.method === 'POST' && path(request) === '/app/attachments',
        respond: async (request) => {
          /* 여러 부분 본문을 글로 읽어 칸 값을 꺼낸다(jsdom 의 `formData()` 는 파일 칸을 읽지 못한다). */
          const body = await request.clone().text();
          const field = (name: string): string =>
            new RegExp(
              `name="${name}"(?:; filename="([^"]*)")?\\r\\n(?:[^\\r\\n]*\\r\\n)?\\r\\n([^\\r\\n]*)`,
            )
              .exec(body)
              ?.slice(1)
              .find((part) => part !== undefined) ?? '';
          posted.push({
            targetTypeCode: field('targetTypeCode'),
            targetId: field('targetId'),
            /* jsdom 은 파일 이름 · 내용을 그대로 싣지 않는다 — 파일 칸이 실렸는지만 본다. */
            hasFile: body.includes('name="file"'),
          });
          return jsonResponse(attachment(posted.length, Number(field('targetId')), 'report.pdf'), {
            status: 201,
          });
        },
      },
    ]);
    let closed = false;
    renderWithProviders(
      <InboundAttachDialog
        inspectionRequestId={501}
        lots={LOTS}
        uomCode="EA"
        onClose={() => (closed = true)}
      />,
      { fetch, session: null },
    );

    const dialog = await screen.findByRole('dialog', { name: t.title });
    /* 받는 형식 · 크기 한도는 늘 펼쳐 두지 않고 「첨부할 파일」 옆 ⓘ 로 둔다. */
    expect(
      within(dialog).getByRole('button', { name: messages.inspectionDocuments.help }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.save }));
    expect(await within(dialog).findByText(t.fileRequired)).toBeInTheDocument();
    expect(posted).toHaveLength(0);

    await user.upload(
      within(dialog).getByLabelText(t.pick),
      new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' }),
    );
    /* 처음엔 아무 LOT 도 고르지 않는다(omf-all-around#356) — 둘을 골라 저장한다. */
    for (const lot of LOTS) {
      expect(within(dialog).getByRole('checkbox', { name: lot.lotNo })).not.toBeChecked();
    }
    await user.click(within(dialog).getByRole('checkbox', { name: LOTS[0]?.lotNo }));
    await user.click(within(dialog).getByRole('checkbox', { name: LOTS[1]?.lotNo }));
    await user.click(within(dialog).getByRole('button', { name: t.save }));

    await waitFor(() => expect(closed).toBe(true));
    expect(posted).toEqual([
      { targetTypeCode: 'LOT', targetId: '1', hasFile: true },
      { targetTypeCode: 'LOT', targetId: '2', hasFile: true },
    ]);
  });

  it('LOT 을 스캔해 왔으면 그 LOT 만 골라 둔다(omf-all-around#356)', async () => {
    renderWithProviders(
      <InboundAttachDialog
        inspectionRequestId={501}
        lots={LOTS}
        uomCode="EA"
        scannedLotId={2}
        onClose={() => undefined}
      />,
      { fetch: createStubFetch([]), session: null },
    );

    const dialog = await screen.findByRole('dialog', { name: t.title });
    expect(within(dialog).getByRole('checkbox', { name: LOTS[1]?.lotNo })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: LOTS[0]?.lotNo })).not.toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: LOTS[2]?.lotNo })).not.toBeChecked();
  });

  it('LOT 를 고르지 않고 저장하면 검사 의뢰에 한 번 붙인다(omf-all-around#296)', async () => {
    const user = userEvent.setup();
    const posted: { targetTypeCode: string; targetId: string }[] = [];
    const fetch = createStubFetch([
      {
        match: (request) => request.method === 'POST' && path(request) === '/app/attachments',
        respond: async (request) => {
          const body = await request.clone().text();
          const field = (name: string): string =>
            new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r\\n]*)`).exec(body)?.[1] ?? '';
          posted.push({ targetTypeCode: field('targetTypeCode'), targetId: field('targetId') });
          return jsonResponse(attachment(1, 501, 'report.pdf'), { status: 201 });
        },
      },
    ]);
    let closed = false;
    renderWithProviders(
      <InboundAttachDialog
        inspectionRequestId={501}
        lots={LOTS}
        uomCode="EA"
        onClose={() => (closed = true)}
      />,
      { fetch, session: null },
    );

    const dialog = await screen.findByRole('dialog', { name: t.title });
    await user.upload(
      within(dialog).getByLabelText(t.pick),
      new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' }),
    );
    await user.click(within(dialog).getByRole('button', { name: t.save }));

    await waitFor(() => expect(closed).toBe(true));
    expect(posted).toEqual([{ targetTypeCode: 'INSPECTION_REQUEST', targetId: '501' }]);
  });

  it('표는 여러 LOT 에 붙은 같은 파일을 한 줄로 모아 연결 LOT 를 함께 보인다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => request.method === 'GET' && path(request) === '/app/attachments',
        respond: (request) => {
          const params = new URL(request.url).searchParams;
          const targetId = Number(params.get('targetId'));
          if (params.get('targetTypeCode') === 'INSPECTION_REQUEST')
            return jsonResponse({ items: [attachment(20, 501, 'summary.xlsx')] });
          return jsonResponse({
            items:
              targetId === 3
                ? [attachment(13, 3, 'photo.png')]
                : [attachment(10 + targetId, targetId, 'report.pdf')],
          });
        },
      },
    ]);
    renderWithProviders(
      <InboundAttachmentTable
        inspectionRequestId={501}
        lots={LOTS}
        confirmedAt={null}
        uomCode="EA"
        canLink={false}
      />,
      {
        fetch,
        session: null,
      },
    );

    const table = await screen.findByRole('table', { name: t.tableTitle });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(4));
    const report = within(table).getByText('report.pdf').closest('tr') as HTMLElement;
    expect(report).toHaveTextContent('0001');
    expect(report).toHaveTextContent('0002');
    expect(report).not.toHaveTextContent('0003');
    /* LOT 없이 검사 의뢰에 붙은 파일은 연결 LOT 번호 칸이 「-」. */
    expect(within(table).getByText('summary.xlsx').closest('tr')).toHaveTextContent('-');
    expect(screen.getByText(t.count(3))).toBeInTheDocument();
  });

  it('LOT 없이 올린 파일은 [LOT 연결]로 고른 LOT 에 연결한다 — 확정 뒤에는 단추가 없다', async () => {
    const user = userEvent.setup();
    let linked: unknown = null;
    const fetch = createStubFetch([
      {
        match: (request) => request.method === 'GET' && path(request) === '/app/attachments',
        respond: (request) =>
          jsonResponse({
            items:
              new URL(request.url).searchParams.get('targetTypeCode') === 'INSPECTION_REQUEST' &&
              linked === null
                ? [attachment(20, 501, 'summary.xlsx')]
                : [],
          }),
      },
      {
        match: (request) =>
          request.method === 'POST' && path(request) === '/app/attachments/20:link-lots',
        respond: async (request) => {
          linked = await request.json();
          return jsonResponse({ items: [] });
        },
      },
    ]);
    const { unmount } = renderWithProviders(
      <InboundAttachmentTable
        inspectionRequestId={501}
        lots={LOTS}
        confirmedAt={null}
        uomCode="EA"
        canLink
      />,
      { fetch, session: null },
    );

    await user.click(await screen.findByRole('button', { name: t.linkLabel('summary.xlsx') }));
    const dialog = await screen.findByRole('dialog', { name: t.linkTitle });
    await user.click(
      within(dialog).getByRole('button', { name: messages.iqcInboundLot.drawer.selectNone }),
    );
    await user.click(within(dialog).getByRole('button', { name: t.save }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(t.lotRequired);
    expect(linked).toBeNull();

    await user.click(within(dialog).getByRole('checkbox', { name: /0002/ }));
    await user.click(within(dialog).getByRole('button', { name: t.save }));
    await waitFor(() => expect(linked).toEqual({ lotIds: [2] }));
    unmount();

    linked = null;
    renderWithProviders(
      <InboundAttachmentTable
        inspectionRequestId={501}
        lots={LOTS}
        confirmedAt="2099-11-11T02:00:00Z"
        uomCode="EA"
        canLink={false}
      />,
      { fetch, session: null },
    );
    await screen.findByText('summary.xlsx');
    expect(screen.queryByRole('button', { name: t.linkLabel('summary.xlsx') })).toBeNull();
  });
});
