import type { InspectionSheet } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
} from '../../test/api-harness';
import { PopInspectionSheetScreen } from './screen';

const t = messages.popInspectionSheet;
const WORKER_NO = 'SYN-W-01';

const sheet = (overrides: Partial<InspectionSheet> = {}): InspectionSheet => ({
  inspectionSheetId: 9,
  serialNumberId: 3,
  serialNo: 'AAR4WY1200010',
  itemId: 5,
  itemCode: 'AAR4',
  itemName: 'OA 본체',
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
  pcbLotNo: null,
  sdLotNo: null,
  stapleLotNo: null,
  fwProductionVersion: null,
  fwQualityVersion: null,
  materialText: null,
  structureText: null,
  rohsFlag: true,
  productNameText: null,
  powerText: null,
  motorText: null,
  tempPackNote: null,
  overallResultCode: null,
  lotCandidates: { pcb: ['PCB-1', 'PCB-2'], sd: [], staple: [] },
  fourMChanges: [],
  writtenWorkerNo: WORKER_NO,
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
      result: null,
      items: [
        {
          inspectionSheetTemplateItemId: 101,
          sequenceNo: 1,
          checkItemCode: 'S 403',
          nameKo: '배선',
          nameVi: null,
          methodCode: 'FULL',
          judgmentCode: null,
        },
        {
          inspectionSheetTemplateItemId: 102,
          sequenceNo: 2,
          checkItemCode: 'O 003',
          nameKo: '레버',
          nameVi: null,
          methodCode: 'SAMPLE',
          judgmentCode: null,
        },
      ],
    },
  ],
  ngs: [],
  events: [],
  ...overrides,
});

interface Recorded {
  method: string;
  path: string;
  headers: Headers;
  body: string;
}

const setup = (current: InspectionSheet = sheet()) => {
  const requests: Recorded[] = [];
  const stub = createStubFetch([
    {
      match: (r) => r.method === 'POST' && r.url.includes(':open-by-serial'),
      respond: () => jsonResponse(current),
    },
    {
      match: (r) => r.method === 'GET' && new URL(r.url).pathname.endsWith('/inspection-sheets/9'),
      respond: () => jsonResponse(current, { headers: { ETag: '"3"' } }),
    },
    {
      match: (r) => r.method === 'PUT',
      respond: () => jsonResponse(current, { headers: { ETag: '"4"' } }),
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
    <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, workerNo: WORKER_NO }}>
      <PopInspectionSheetScreen />
    </PopIdentityProvider>,
    { fetch, route: '/pop/inspection-sheet' },
  );
  return { user, requests };
};

const openSerial = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole('textbox', { name: t.serial.label }), 'AAR4WY1200010');
  await user.click(screen.getByRole('button', { name: t.serial.open }));
  await screen.findByRole('region', { name: t.step.heading });
};

describe('POP 제품 검사표 입력', () => {
  it('시리얼로 검사표를 열고 머리 값과 단계를 보인다 — 사번을 싣는다', async () => {
    const { user, requests } = setup();
    await openSerial(user);

    const open = requests.find((r) => r.path.endsWith(':open-by-serial'))!;
    expect(JSON.parse(open.body)).toEqual({ serialNo: 'AAR4WY1200010' });
    expect(open.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(screen.getByText('WO-070')).toBeInTheDocument();
    expect(screen.getByLabelText(t.header.pcbLotNo)).toBeInTheDocument();
  });

  it('전수 항목을 판정해야 저장되고, NG 를 재검 OK 로 저장하면 1차 NG · 최종 OK 로 보낸다', async () => {
    const { user, requests } = setup();
    await openSerial(user);

    const save = screen.getByRole('button', { name: t.step.save });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole('button', { name: t.step.itemJudgment('S 403', 'NG') }));
    await user.click(screen.getByRole('checkbox', { name: t.step.recheckOk }));
    await user.click(save);

    await waitFor(() => expect(requests.some((r) => r.method === 'PUT')).toBe(true));
    const put = requests.find((r) => r.method === 'PUT')!;
    expect(put.path).toMatch(/\/steps\/PROCESS_1$/u);
    expect(put.headers.get('If-Match')).toBe('"3"');
    expect(JSON.parse(put.body)).toEqual({
      firstJudgmentCode: 'NG',
      finalJudgmentCode: 'OK',
      items: [{ inspectionSheetTemplateItemId: 101, judgmentCode: 'NG' }],
    });
  });

  it('전수 항목이 남았으면 「임시 저장」으로 항목 판정만 보낸다 — 바뀐 것이 없으면 저장 단추가 꺼진다', async () => {
    const { user, requests } = setup();
    await openSerial(user);

    expect(screen.getByRole('button', { name: t.step.save })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: t.step.itemJudgment('O 003', 'OK') }));
    await user.click(screen.getByRole('button', { name: t.step.draftSave }));

    await waitFor(() => expect(requests.some((r) => r.method === 'PUT')).toBe(true));
    expect(JSON.parse(requests.find((r) => r.method === 'PUT')!.body)).toEqual({
      items: [{ inspectionSheetTemplateItemId: 102, judgmentCode: 'OK' }],
    });
  });

  it('NG 를 더해 내용을 적고 저장하면 NG 블록을 통째로 보낸다 — 내용이 비면 막는다', async () => {
    const { user, requests } = setup();
    await openSerial(user);

    const ngs = screen.getByRole('region', { name: t.ng.heading });
    await user.click(within(ngs).getByRole('button', { name: t.ng.add }));
    await user.click(within(ngs).getByRole('button', { name: t.ng.save }));
    expect(within(ngs).getByText(t.ng.contentRequired)).toBeInTheDocument();
    expect(requests.some((r) => r.path.endsWith('/ngs'))).toBe(false);

    await user.type(within(ngs).getByRole('textbox', { name: t.ng.ngContent }), '배선 정리 불량');
    await user.type(within(ngs).getByRole('textbox', { name: t.ng.repairWorkerNo }), WORKER_NO);
    await user.click(within(ngs).getByRole('button', { name: t.ng.save }));

    await waitFor(() => expect(requests.some((r) => r.path.endsWith('/ngs'))).toBe(true));
    const put = requests.find((r) => r.path.endsWith('/ngs'))!;
    expect(put.headers.get('If-Match')).toBe('"3"');
    expect(JSON.parse(put.body).ngs).toEqual([
      expect.objectContaining({
        ngContent: '배선 정리 불량',
        repairWorkerNo: WORKER_NO,
        repairedAt: null,
      }),
    ]);
  });

  it('완료된 검사표는 입력을 막고 이유를 보인다', async () => {
    const { user } = setup(sheet({ statusCode: 'COMPLETED' }));
    await openSerial(user);

    expect(screen.getByText(t.summary.completed)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: t.step.heading })).getByRole('button', {
        name: t.step.save,
      }),
    ).toBeDisabled();
  });

  it('저장된 NG 는 이력 한 줄(상태 · 공정 · 항목 · 내용)로 보이고 [수정]으로 연다 — 바뀐 것이 없으면 저장이 꺼진다', async () => {
    const { user } = setup(
      sheet({
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
            repairDepartmentCode: null,
            repairWorkerNo: null,
            repairWorkerName: null,
            repairedAt: null,
            recheckResultCode: 'OK',
            recheckWorkerNo: null,
            recheckWorkerName: null,
            recheckedAt: null,
          },
        ],
      }),
    );
    await openSerial(user);

    const ngs = screen.getByRole('region', { name: t.ng.heading });
    expect(within(ngs).getByText('배선 정리 불량')).toBeInTheDocument();
    expect(within(ngs).getByText(t.ng.statusRecheck('OK'))).toBeInTheDocument();
    expect(within(ngs).queryByRole('textbox', { name: t.ng.ngContent })).not.toBeInTheDocument();
    expect(within(ngs).getByRole('button', { name: t.ng.save })).toBeDisabled();

    await user.click(within(ngs).getByRole('button', { name: `${t.ng.block(1)} ${t.ng.edit}` }));
    expect(within(ngs).getByRole('textbox', { name: t.ng.ngContent })).toHaveValue(
      '배선 정리 불량',
    );
  });
});
