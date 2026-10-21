import type { InspectionSheet } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SessionProvider, type Session } from '../../patterns/session';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
} from '../../test/api-harness';
import { InspectionSheetScreen } from './screen';

const t = messages.inspectionSheet;

const session = (permissions: string[]): Session => ({
  userId: 8101,
  loginId: 'SYN-LOGIN-01',
  userName: '합성 사용자 가',
  scopes: [{ businessUnitId: 8301 }],
  mustChangePassword: false,
  roles: [],
  permissions,
});

const sheet = (overrides: Partial<InspectionSheet> = {}): InspectionSheet => ({
  inspectionSheetId: 9,
  serialNumberId: 3,
  serialNo: 'SN-0001',
  itemId: 5,
  itemCode: 'AAR4',
  itemName: 'FS-539',
  lotId: 40,
  lotNo: 'PL-001',
  workOrderId: 70,
  workOrderNo: 'WO-070',
  inspectionSheetTemplateId: 11,
  templateVersion: 1,
  formLayoutCode: 'OP',
  statusCode: 'IN_PROGRESS',
  modelText: 'AAR4',
  specText: 'WY5',
  destinationText: null,
  pcbLotNo: 'PCB-1',
  sdLotNo: null,
  stapleLotNo: null,
  fwProductionVersion: '1.02',
  fwQualityVersion: null,
  materialText: null,
  structureText: null,
  rohsFlag: true,
  productNameText: null,
  powerText: null,
  motorText: null,
  tempPackNote: null,
  overallResultCode: null,
  lotCandidates: { pcb: [], sd: [], staple: [] },
  fourMChanges: [
    {
      lotNo: 'ML-4M',
      itemCode: 'F537',
      itemName: 'PCB ASSY',
      changeTypeCode: 'MATERIAL',
      remarks: '공급처 변경',
    },
  ],
  writtenWorkerNo: 'W-1',
  writtenWorkerName: '작업자',
  createdAt: '2026-10-21T01:00:00Z',
  approvedBy: null,
  approvedByName: null,
  approvedAt: null,
  checkedBy: null,
  checkedByName: null,
  checkedAt: null,
  steps: [
    {
      stepCode: 'PROCESS_1',
      sequenceNo: 1,
      nameKo: '공정검사1',
      nameVi: null,
      signRequired: true,
      result: {
        firstJudgmentCode: 'NG',
        finalJudgmentCode: 'OK',
        sourceCode: 'SHEET',
        inspectedWorkerNo: 'W-1',
        inspectedWorkerName: '작업자',
        inspectedAt: '2026-10-21T02:00:00Z',
        signedBy: null,
        signedByName: null,
        signedAt: null,
      },
      items: [
        {
          inspectionSheetTemplateItemId: 101,
          sequenceNo: 1,
          checkItemCode: 'S 403',
          nameKo: '배선',
          nameVi: null,
          methodCode: 'FULL',
          judgmentCode: 'NG',
        },
      ],
    },
  ],
  ngs: [
    {
      sequenceNo: 1,
      foundDepartmentCode: 'QUALITY',
      foundStepCode: 'PROCESS_1',
      occurrenceProcessText: null,
      standardNo: null,
      checkItemCode: 'S 403',
      ngContent: '배선 정리 불량',
      investigationText: null,
      ngTypeCode: 'WORK',
      repairDepartmentCode: 'PRODUCTION',
      repairWorkerNo: 'W-1',
      repairWorkerName: '작업자',
      repairedAt: null,
      recheckResultCode: 'OK',
      recheckWorkerNo: null,
      recheckWorkerName: null,
      recheckedAt: null,
    },
  ],
  events: [],
  ...overrides,
});

interface Recorded {
  method: string;
  path: string;
  headers: Headers;
  body: string;
}

const setup = (permissions: string[], current: InspectionSheet = sheet(), plantCode = 'PL13') => {
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
      match: (r) =>
        r.method === 'GET' && new URL(r.url).pathname.endsWith('/quality/inspection-sheets'),
      respond: () =>
        jsonResponse({
          items: [
            {
              inspectionSheetId: 9,
              serialNo: 'SN-0001',
              itemCode: 'AAR4',
              itemName: 'FS-539',
              lotNo: 'PL-001',
              workOrderNo: 'WO-070',
              statusCode: current.statusCode,
              recordedStepCount: 1,
              stepCount: 7,
              ngStepCount: 1,
              writtenWorkerName: '작업자',
              approvedByName: null,
              checkedByName: null,
              createdAt: '2026-10-21T01:00:00Z',
            },
          ],
          page: { page: 1, size: 50, total: 1 },
        }),
    },
    {
      match: (r) => r.method === 'GET' && new URL(r.url).pathname.endsWith('/inspection-sheets/9'),
      respond: () => jsonResponse(current, { headers: { ETag: '"6"' } }),
    },
    {
      match: (r) => new URL(r.url).pathname.endsWith('/mdm/code-values'),
      respond: () =>
        jsonResponse({
          items: [{ code: 'MATERIAL', codeName: '자재' }],
          page: { page: 1, size: 50, total: 1 },
        }),
    },
    {
      match: (r) => r.method === 'POST',
      respond: () => jsonResponse(current, { headers: { ETag: '"7"' } }),
    },
  ]);
  const fetch: StubFetch = async (request) => {
    requests.push({
      method: request.method,
      path: decodeURIComponent(new URL(request.url).pathname),
      headers: new Headers(request.headers),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });
    return stub(request);
  };
  const user = userEvent.setup();
  renderWithProviders(
    <SessionProvider>
      <InspectionSheetScreen />
    </SessionProvider>,
    { fetch, session: session(permissions) },
  );
  return { user, requests };
};

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: t.list.openRow('SN-0001') }));
  await screen.findByRole('table', { name: t.detail.stepsCaption });
};

describe('제품 검사표 조회', () => {
  it('목록에 입력 단계·NG 단계를 보이고, 열면 단계 판정·NG·머리 값을 보인다', async () => {
    const { user } = setup(['W-03-13']);
    const row = await within(await screen.findByRole('table', { name: t.list.caption })).findByRole(
      'row',
      { name: /SN-0001/ },
    );
    expect(row).toHaveTextContent('1/7');

    await open(user);

    expect(
      within(screen.getByRole('table', { name: t.detail.stepsCaption })).getByText('NG → OK'),
    ).toBeInTheDocument();
    expect(screen.getByText('배선 정리 불량 (작업)')).toBeInTheDocument();
    expect(screen.getByText('1.02')).toBeInTheDocument();
    expect(
      await screen.findByText(/자재 · F537 PCB ASSY · ML-4M · 공급처 변경/u),
    ).toBeInTheDocument();
  });

  it('서명 권한이 없으면 서명·승인 단추가 없고 안내만 보인다', async () => {
    const { user } = setup(['W-03-13']);
    await open(user);

    expect(screen.getByText(t.actions.noPermission)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.approve })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.actions.signRow('공정검사1') }),
    ).not.toBeInTheDocument();
  });

  it('서명 권한이 있으면 단계 서명과 승인을 상세의 ETag 로 잠가 보낸다', async () => {
    const { user, requests } = setup(['W-03-13', 'W-03-14']);
    await open(user);

    await user.click(screen.getByRole('button', { name: t.actions.signRow('공정검사1') }));
    await waitFor(() =>
      expect(requests.some((r) => r.path.endsWith('/steps/PROCESS_1:sign'))).toBe(true),
    );
    expect(requests.find((r) => r.path.endsWith(':sign'))!.headers.get('If-Match')).toBe('"6"');

    await user.click(screen.getByRole('button', { name: t.actions.approve }));
    await waitFor(() =>
      expect(requests.some((r) => r.path.endsWith('/inspection-sheets/9:approve'))).toBe(true),
    );
  });

  it('승인 취소는 사유가 비면 보내지 않고, 적으면 사유를 실어 보낸다', async () => {
    const { user, requests } = setup(
      ['W-03-13', 'W-03-14'],
      sheet({ approvedBy: 1, approvedByName: '관리자', approvedAt: '2026-10-21T03:00:00Z' }),
    );
    await open(user);

    await user.click(screen.getByRole('button', { name: t.actions.reopen }));
    const dialog = await screen.findByRole('dialog', { name: t.reopenDialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.reopenDialog.ok }));
    expect(within(dialog).getByText(t.reopenDialog.required)).toBeInTheDocument();
    expect(requests.some((r) => r.path.endsWith(':reopen'))).toBe(false);

    await user.type(within(dialog).getByLabelText(t.reopenDialog.reason), '머리 값 오기');
    await user.click(within(dialog).getByRole('button', { name: t.reopenDialog.ok }));
    await waitFor(() => expect(requests.some((r) => r.path.endsWith(':reopen'))).toBe(true));
    expect(JSON.parse(requests.find((r) => r.path.endsWith(':reopen'))!.body)).toEqual({
      reason: '머리 값 오기',
    });
  });

  it('A4 출력은 고른 언어의 양식 칸으로 그 검사표를 그리고 인쇄 창을 연다 — PDF 기본 이름은 시리얼·언어', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(document.title).toBe(t.print.fileName('SN-0001', 'vi'));
      const page = document.querySelector('.sheet-print-root');
      expect(page).not.toBeNull();
      expect(page).toHaveTextContent('Số sê-ri máy');
      expect(page).toHaveTextContent('SN-0001');
      expect(page).toHaveTextContent('배선 정리 불량');
      expect(page).toHaveTextContent('□OK ■NG');
      expect(page).toHaveTextContent('Hàng thay đổi (theo lịch sử đưa vào)');
      expect(page).toHaveTextContent('Có · 자재 · ML-4M');
    });
    const { user } = setup(['W-03-13']);
    await open(user);

    await user.click(screen.getByRole('button', { name: 'Tiếng Việt' }));
    await user.click(screen.getByRole('button', { name: t.print.button }));

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.querySelector('.sheet-print-root')).toBeNull());
    print.mockRestore();
  });

  it('부품 공장 범위만 있는 계정은 「OA 사업부 전용」 안내만 보이고 목록을 조회하지 않는다', async () => {
    const { requests } = setup(['W-03-13', 'W-03-14'], sheet(), 'PL11');

    expect(await screen.findByText(messages.common.oaOnly.notice)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: t.list.caption })).not.toBeInTheDocument();
    expect(requests.some((r) => r.path.endsWith('/quality/inspection-sheets'))).toBe(false);
  });
});
