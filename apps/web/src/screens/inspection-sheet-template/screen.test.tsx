import type { InspectionSheetTemplate } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider, type Session } from '../../patterns/session';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
} from '../../test/api-harness';
import { InspectionSheetTemplateScreen } from './screen';

const t = messages.inspectionSheetTemplate;
const LIST = '/quality/inspection-sheet-templates';

const session: Session = {
  userId: 8101,
  loginId: 'SYN-LOGIN-01',
  userName: '합성 사용자 가',
  scopes: [{ businessUnitId: 8301 }],
  mustChangePassword: false,
};

const template = (overrides: Partial<InspectionSheetTemplate> = {}): InspectionSheetTemplate => ({
  inspectionSheetTemplateId: 11,
  itemId: 5,
  itemCode: 'AAR4',
  itemName: 'OA 본체',
  templateVersion: 2,
  businessUnitId: 8301,
  formLayoutCode: 'OP',
  statusCode: 'DRAFT',
  materialText: '방청 처리',
  structureText: null,
  rohsFlag: true,
  productNameText: null,
  powerText: null,
  motorText: null,
  remarks: null,
  confirmedBy: null,
  confirmedAt: null,
  lotSources: [],
  steps: [
    {
      stepCode: 'PROCESS_1',
      sequenceNo: 1,
      nameKo: '공정검사1',
      nameVi: null,
      signRequired: true,
      items: [
        {
          inspectionSheetTemplateItemId: 101,
          sequenceNo: 1,
          checkItemCode: 'S 403',
          nameKo: '배선',
          nameVi: null,
          methodCode: 'FULL',
        },
      ],
    },
  ],
  ...overrides,
});

interface Recorded {
  method: string;
  path: string;
  headers: Headers;
  body: string;
}

const setup = (detail: InspectionSheetTemplate, plantCode = 'PL13') => {
  const requests: Recorded[] = [];
  const stub = createStubFetch([
    /* OA 공장 판단(omf-all-around#89) — 계정 범위(사업부 8301 전체)가 덮는 공장의 코드. */
    {
      match: (r) =>
        new URL(r.url).pathname.endsWith('/mdm/code-values') &&
        new URL(r.url).searchParams.get('codeGroupCode') === 'INSPECTION_SHEET_PLANT',
      respond: () =>
        jsonResponse({
          items: [{ code: 'PL13', codeName: 'OA Plant' }],
          page: { page: 1, size: 100, total: 1 },
        }),
    },
    {
      match: (r) => new URL(r.url).pathname.endsWith('/mdm/plants'),
      respond: () =>
        jsonResponse({
          items: [
            {
              plantId: 8401,
              plantCode,
              plantName: '합성 공장',
              businessUnitId: 8301,
              isActive: true,
            },
          ],
          page: { page: 1, size: 100, total: 1 },
        }),
    },
    {
      match: (r) => r.method === 'GET' && new URL(r.url).pathname.endsWith(LIST),
      respond: () => jsonResponse({ items: [detail], page: { page: 1, size: 50, total: 1 } }),
    },
    {
      match: (r) => r.method === 'GET' && new URL(r.url).pathname.endsWith(`${LIST}/11`),
      respond: () => jsonResponse(detail, { headers: { ETag: '"4"' } }),
    },
    {
      match: (r) => new URL(r.url).pathname.endsWith('/mdm/business-units'),
      respond: () =>
        jsonResponse({
          items: [
            {
              businessUnitId: 8301,
              businessUnitCode: 'OA',
              businessUnitName: 'OA 사업부',
              isActive: true,
            },
          ],
          page: { page: 1, size: 50, total: 1 },
        }),
    },
    {
      match: (r) => r.method === 'PUT',
      respond: () => jsonResponse(detail, { headers: { ETag: '"5"' } }),
    },
    {
      match: (r) => r.method === 'POST' && new URL(r.url).pathname.endsWith(':confirm'),
      respond: () => jsonResponse(detail),
    },
    {
      match: (r) => r.method === 'POST',
      respond: () =>
        jsonResponse(
          { ...detail, inspectionSheetTemplateId: 12, statusCode: 'DRAFT' },
          { status: 201 },
        ),
    },
  ]);
  const fetch: StubFetch = async (request) => {
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname,
      headers: new Headers(request.headers),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });
    return stub(request);
  };
  const user = userEvent.setup();
  renderWithProviders(
    <SessionProvider>
      <InspectionSheetTemplateScreen />
    </SessionProvider>,
    { fetch, session },
  );
  return { user, requests };
};

const openRow = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: t.list.openRow('AAR4', 2) }));
  await screen.findByText(t.editor.stepSection);
};

describe('검사표 기준', () => {
  it('목록에 모델·판·양식·상태를 보인다', async () => {
    setup(template());

    const row = await within(await screen.findByRole('table', { name: t.list.caption })).findByRole(
      'row',
      { name: /AAR4/ },
    );
    expect(row).toHaveTextContent('2');
    expect(row).toHaveTextContent(t.layouts.OP!);
    expect(row).toHaveTextContent(t.statuses.DRAFT!);
    /* 재료 · 확정자 열(#208) */
    expect(row).toHaveTextContent('방청 처리');
    expect(screen.getByRole('columnheader', { name: t.columns.material })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: t.columns.confirmedBy })).toBeInTheDocument();
  });

  it('작성중 기준의 단계 이름을 고쳐 저장하면 상세의 ETag 로 잠가 통째로 보낸다', async () => {
    const { user, requests } = setup(template());
    await openRow(user);

    const name = screen.getByLabelText(`${t.steps.PROCESS_1} ${t.editor.stepNameKo}`);
    await user.clear(name);
    await user.type(name, '조립 검사');
    expect(screen.getByRole('button', { name: t.editor.confirm })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: t.editor.save }));

    await waitFor(() => expect(requests.some((r) => r.method === 'PUT')).toBe(true));
    const put = requests.find((r) => r.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('"4"');
    expect(JSON.parse(put.body).steps).toEqual([
      expect.objectContaining({
        stepCode: 'PROCESS_1',
        nameKo: '조립 검사',
        items: [expect.objectContaining({ checkItemCode: 'S 403' })],
      }),
    ]);
  });

  it('단계 목록에서 고른 단계를 오른쪽에서 고치고, 저장 뒤 다시 그려도 그 단계에 머문다', async () => {
    const { user } = setup(template());
    await openRow(user);

    const list = screen.getByRole('list', { name: t.editor.stepList });
    expect(within(list).getByRole('button', { name: /공정검사1/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await user.click(within(list).getByRole('button', { name: /공정검사2/ }));
    const use = screen.getByRole('checkbox', { name: t.editor.stepUse(t.steps.PROCESS_2!) });
    expect(use).not.toBeChecked();
    await user.click(use);
    await user.click(screen.getByRole('button', { name: t.editor.save }));

    await screen.findByText(t.editor.saved);
    expect(
      within(screen.getByRole('list', { name: t.editor.stepList })).getByRole('button', {
        name: /공정검사2/,
      }),
    ).toHaveAttribute('aria-current', 'true');
  });

  it('작성중 기준을 확정하면 확인 뒤 :confirm 을 보낸다', async () => {
    const { user, requests } = setup(template());
    await openRow(user);

    await user.click(screen.getByRole('button', { name: t.editor.confirm }));
    const dialog = await screen.findByRole('dialog', { name: t.confirmDialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.confirmDialog.ok }));

    await waitFor(() => expect(requests.some((r) => r.path.endsWith(':confirm'))).toBe(true));
    expect(requests.find((r) => r.path.endsWith(':confirm'))!.headers.get('If-Match')).toBe('"4"');
  });

  it('확정된 기준은 고칠 수 없고, 새 판 만들기가 같은 모델·사업부로 복사해 등록한다', async () => {
    const { user, requests } = setup(
      template({ statusCode: 'CONFIRMED', confirmedBy: 1, confirmedAt: '2026-10-21T01:00:00Z' }),
    );
    await openRow(user);

    expect(screen.getByText(t.editor.readOnly)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.editor.save })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.editor.copyAsNew }));

    await waitFor(() =>
      expect(requests.some((r) => r.method === 'POST' && r.path.endsWith(LIST))).toBe(true),
    );
    const body = JSON.parse(
      requests.find((r) => r.method === 'POST' && r.path.endsWith(LIST))!.body,
    );
    expect(body).toMatchObject({
      itemId: 5,
      businessUnitId: 8301,
      formLayoutCode: 'OP',
      materialText: '방청 처리',
    });
    expect(body.steps).toHaveLength(1);
  });

  /* 새 기준의 모델 · 사업부 · 양식은 팝업에서 고른다 — 검사 기준 탭의 「기준 추가」 창과 같다(#208). */
  it('새 기준 등록은 기본 정보 팝업으로 열리고, 모델을 고르지 않으면 넘어가지 않는다', async () => {
    const { user, requests } = setup(template());
    await user.click(await screen.findByRole('button', { name: t.list.add }));

    const dialog = await screen.findByRole('dialog', { name: t.editor.newHeading });
    await user.click(within(dialog).getByRole('button', { name: t.editor.basicConfirm }));

    expect(within(dialog).getByText(t.editor.noModel)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: t.editor.newHeading })).toBeInTheDocument();
    expect(requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('새 기준 팝업에서 취소하면 등록을 그만둔다', async () => {
    const { user } = setup(template());
    await user.click(await screen.findByRole('button', { name: t.list.add }));

    const dialog = await screen.findByRole('dialog', { name: t.editor.newHeading });
    await user.click(within(dialog).getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('dialog', { name: t.editor.newHeading })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.editor.newHeading })).not.toBeInTheDocument();
  });

  it('부품 공장 범위만 있는 계정은 「OA 사업부 전용」 안내만 보이고 기준을 조회하지 않는다', async () => {
    const { requests } = setup(template(), 'PL11');

    expect(await screen.findByText(messages.common.oaOnly.notice)).toBeInTheDocument();
    expect(requests.some((r) => r.path.endsWith(LIST))).toBe(false);
  });
});
