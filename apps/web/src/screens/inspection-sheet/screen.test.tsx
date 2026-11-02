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
import { downloadSheetXlsx } from './export';
import { InspectionSheetScreen } from './screen';

/* 엑셀 만들기(엑셀 부품 · 양식 파일)는 이 화면 시험 밖이다. */
vi.mock('./export', () => ({ downloadSheetXlsx: vi.fn(async () => undefined) }));

const t = messages.inspectionSheet;
const d = t.detail;

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
  query: URLSearchParams;
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
    /* 작업지시 조건 — 번호로 찾아 id 로 건다(사용자 지시 2026-11-02). */
    {
      match: (r) => new URL(r.url).pathname.endsWith('/production/work-orders'),
      respond: () =>
        jsonResponse({
          items: [
            { workOrderId: 71, workOrderNo: 'WO-070-1' },
            { workOrderId: 70, workOrderNo: 'WO-070' },
          ],
          page: { page: 1, size: 50, total: 2 },
        }),
    },
    {
      match: (r) =>
        r.method === 'GET' && new URL(r.url).pathname.endsWith('/quality/inspection-sheets'),
      respond: (r) => {
        /* 스캔 칸 — 이 LOT(PL-001) 밖의 LOT 번호로는 아무것도 없다(시리얼로 넘어간다). */
        const lotNo = new URL(r.url).searchParams.get('lotNo');
        if (lotNo !== null && lotNo !== 'PL-001')
          return jsonResponse({ items: [], page: { page: 1, size: 1, total: 0 } });
        return jsonResponse({
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
        });
      },
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
      match: (r) => r.method === 'PUT',
      respond: () => jsonResponse(current, { headers: { ETag: '"7"' } }),
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
      query: new URL(request.url).searchParams,
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
    // 투입 자재 변경 내역은 표 — 변경 유형 · 자재 · 자재 LOT · 비고(사용자 지시 2026-11-02).
    const fourM = screen.getByRole('table', { name: t.detail.fourM });
    const fourMRow = await within(fourM).findByRole('row', { name: /ML-4M/ });
    expect(fourMRow).toHaveTextContent('자재');
    expect(fourMRow).toHaveTextContent('PCB ASSY (F537)');
    expect(fourMRow).toHaveTextContent('공급처 변경');
    // 서명 필요 여부는 칸으로 따로.
    const steps = screen.getByRole('table', { name: t.detail.stepsCaption });
    expect(
      within(steps).getByRole('columnheader', { name: t.detail.stepColumns.signRequired }),
    ).toBeInTheDocument();
    expect(within(steps).getByRole('row', { name: /공정검사1/ })).toHaveTextContent(
      t.detail.signRequiredYes,
    );
    // 이력이 없어도 표 머리를 두고 빈 줄에 안내를 쓴다(사용자 지시 2026-11-02).
    await user.click(screen.getByRole('tab', { name: t.detail.tabs.events(0) }));
    expect(
      within(screen.getByRole('table', { name: t.detail.events })).getByText(t.detail.eventsEmpty),
    ).toBeInTheDocument();
  });

  /* 목록 · 상세 한 화면(#217) — 고르기 전에도 상세 자리에 안내가 서고, 고르면 그 자리에 검사표가 선다. */
  it('검사표를 고르기 전에는 상세 자리에 선택 안내가, 고르면 검사표가 선다', async () => {
    const { user } = setup(['W-03-13']);

    expect(await screen.findByText(t.list.pickTitle)).toBeInTheDocument();

    await open(user);

    expect(screen.queryByText(t.list.pickTitle)).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: t.detail.stepsCaption })).toBeInTheDocument();
  });

  /* 검사 실적 화면과 같은 짜임(#217) — 상태 칩이 「상태」 선택을 대신하고, 조회 줄은 [조회] [초기화]. */
  it('상태 칩은 건수를 보이고 누르면 그 상태로 바로 거르며, 초기화는 조건을 비운다', async () => {
    const { user, requests } = setup(['W-03-13']);
    const listCalls = () =>
      requests
        .filter((r) => r.method === 'GET' && r.path.endsWith('/quality/inspection-sheets'))
        .map((r) => r.query);
    const chips = await screen.findByRole('group', { name: t.list.statuses });
    expect(await within(chips).findByRole('button', { name: '전체 1' })).toBeInTheDocument();

    await user.click(within(chips).getByRole('button', { name: /^완료/ }));
    await waitFor(() =>
      expect(
        listCalls().some((q) => q.get('statusCode') === 'COMPLETED' && q.get('size') === '50'),
      ).toBe(true),
    );
    expect(within(chips).getByRole('button', { name: /^완료/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // 스캔 칸 하나 — 그 LOT 의 검사표가 있으면 LOT 번호로, 없으면 시리얼로 거른다(사용자 지시 2026-11-02).
    await user.type(screen.getByLabelText(t.list.scan), 'PL-001');
    await user.click(screen.getByRole('button', { name: t.list.search }));
    await waitFor(() =>
      expect(listCalls().some((q) => q.get('lotNo') === 'PL-001' && q.get('size') === '50')).toBe(
        true,
      ),
    );
    await user.clear(screen.getByLabelText(t.list.scan));
    await user.type(screen.getByLabelText(t.list.scan), 'SN-9');
    await user.click(screen.getByRole('button', { name: t.list.search }));
    await waitFor(() =>
      expect(listCalls().some((q) => q.get('serialNo') === 'SN-9' && q.get('size') === '50')).toBe(
        true,
      ),
    );
    expect(listCalls().some((q) => q.get('lotNo') === 'SN-9' && q.get('size') === '50')).toBe(
      false,
    );
    await user.click(screen.getByRole('button', { name: t.list.reset }));
    expect(screen.getByLabelText(t.list.scan)).toHaveValue('');
    expect(within(chips).getByRole('button', { name: /^전체/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('상세 보기 펼치기로 작업지시 번호를 적으면 그 작업지시의 번호(id)로 거른다', async () => {
    const { user, requests } = setup(['W-03-13']);
    await screen.findByRole('table', { name: t.list.caption });
    expect(screen.getByLabelText(t.list.workOrder)).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: t.list.detailOpen }));
    await user.type(screen.getByLabelText(t.list.workOrder), 'wo-070');
    await user.click(screen.getByRole('button', { name: t.list.search }));
    await waitFor(() =>
      expect(
        requests.some(
          (r) =>
            r.path.endsWith('/quality/inspection-sheets') &&
            r.query.get('workOrderId') === '70' &&
            r.query.get('size') === '50',
        ),
      ).toBe(true),
    );
    expect(screen.getByLabelText(t.list.model)).toBeVisible();
  });

  /* 양식(OP향 · PP향)으로 거른다(사용자 지시 2026-11-02 · 서버 선행 formLayoutCode). */
  it('종료일 옆 양식을 고르면 그 양식으로 거른다', async () => {
    const { user, requests } = setup(['W-03-13']);
    await screen.findByRole('table', { name: t.list.caption });

    await user.click(screen.getByLabelText(t.list.layout));
    // 고르면 바로 조회한다 — 조회 단추를 누르지 않는다(사용자 지시 2026-11-02).
    await user.click(screen.getByRole('option', { name: 'PP향 양식' }));

    await waitFor(() =>
      expect(
        requests.some(
          (r) =>
            r.path.endsWith('/quality/inspection-sheets') &&
            r.query.get('formLayoutCode') === 'PP' &&
            r.query.get('size') === '50',
        ),
      ).toBe(true),
    );
  });

  /* 사용자 시안 2026-11-02(#217) — 「보기」 단추 없이 줄을 눌러 열고, 상세는 머리 · 진행 · 탭 넷 · 확정 안내 · 꼬리 단추. */
  it('줄 아무 곳이나 누르면 상세가 열리고, 상세는 진행 · 탭 · 확정 안내 · 엑셀 다운로드를 보인다', async () => {
    const { user } = setup(['W-03-13']);
    const table = await screen.findByRole('table', { name: t.list.caption });
    const row = await within(table).findByRole('row', { name: /SN-0001/ });
    expect(within(table).queryByRole('button', { name: '보기' })).not.toBeInTheDocument();

    await user.click(within(row).getByText('1/7'));

    expect(
      await screen.findByRole('heading', { level: 2, name: new RegExp(t.detail.title) }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.detail.progress.inspection(1, 1))).toBeInTheDocument();
    expect(screen.getByRole('list', { name: t.detail.progress.label })).toHaveTextContent(
      t.detail.progress.done,
    );
    expect(screen.getByText(t.detail.finalizeNote)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.excel.button })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: t.detail.tabs.basic })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // 공정 줄 「상세 보기」는 그 공정만 팝업으로 연다(사용자 지시 2026-11-02).
    await user.click(screen.getByRole('button', { name: d.stepDetail.open('공정검사1') }));
    const stepDialog = await screen.findByRole('dialog', { name: d.stepDetail.title('공정검사1') });
    expect(
      within(stepDialog).getByRole('table', { name: d.items('공정검사1') }),
    ).toBeInTheDocument();
    expect(within(stepDialog).getByText('배선')).toBeInTheDocument();
    // 항목 순서(기준 순번)도 보인다.
    expect(
      within(stepDialog).getByRole('columnheader', { name: d.itemColumns.sequenceNo }),
    ).toBeInTheDocument();
    await user.click(within(stepDialog).getAllByRole('button', { name: d.close }).at(-1)!);
    expect(screen.queryByRole('dialog', { name: d.stepDetail.title('공정검사1') })).toBeNull();

    // 고른 줄을 다시 누르면 고르기가 풀린다(사용자 지시 2026-11-02).
    await user.click(within(row).getByText('1/7'));
    expect(await screen.findByText(t.list.pickTitle)).toBeInTheDocument();
  });

  /* 서명이 필요 없는 공정에는 「서명하기」가 없다(사용자 지시 2026-11-02). */
  it('서명 불필요 공정에는 서명하기 단추가 없다', async () => {
    const base = sheet();
    const { user } = setup(
      ['W-03-13', 'W-03-14'],
      sheet({ steps: [{ ...base.steps[0]!, signRequired: false }] }),
    );
    await open(user);

    expect(
      screen.queryByRole('button', { name: t.actions.signRow('공정검사1') }),
    ).not.toBeInTheDocument();
  });

  /* 서명된 공정에는 「서명하기」가 다시 서지 않는다(사용자 지시 2026-11-02). */
  it('이미 서명된 공정에는 서명하기 단추가 없다', async () => {
    const signed = sheet();
    const step = signed.steps[0]!;
    const { user } = setup(
      ['W-03-13', 'W-03-14'],
      sheet({
        steps: [
          {
            ...step,
            result: {
              ...step.result!,
              signedBy: 1,
              signedByName: '관리자',
              signedAt: '2026-10-21T03:00:00Z',
            },
          },
        ],
      }),
    );
    await open(user);

    expect(
      screen.queryByRole('button', { name: t.actions.signRow('공정검사1') }),
    ).not.toBeInTheDocument();
  });

  it('서명 권한이 없으면 서명·승인 단추가 없고 안내만 보인다', async () => {
    const { user } = setup(['W-03-13']);
    await open(user);

    // 권한이 없으면 공정별 검사 · 진행 현황 제목 옆에 안내(사용자 지시 2026-11-02).
    expect(screen.getAllByText(t.actions.noPermission)).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: t.actions.permissionSettings })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: t.actions.check })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.approve })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.actions.signRow('공정검사1') }),
    ).not.toBeInTheDocument();
  });

  it('서명 권한이 있으면 단계 서명과 승인을 상세의 ETag 로 잠가 보낸다', async () => {
    const { user, requests } = setup(['W-03-13', 'W-03-14']);
    await open(user);

    await user.click(screen.getByRole('button', { name: t.actions.signRow('공정검사1') }));
    // 바로 서명하지 않고 한 번 더 묻는다(사용자 지시 2026-11-02).
    const confirm = await screen.findByRole('dialog', { name: t.signDialog.title });
    expect(requests.some((r) => r.path.endsWith(':sign'))).toBe(false);
    await user.click(within(confirm).getByRole('button', { name: t.signDialog.ok }));
    await waitFor(() =>
      expect(requests.some((r) => r.path.endsWith('/steps/PROCESS_1:sign'))).toBe(true),
    );
    expect(requests.find((r) => r.path.endsWith(':sign'))!.headers.get('If-Match')).toBe('"6"');

    // 서명이 필요한 공정이 남아 있으면 승인 · 확인은 꺼지고 까닭이 보인다(사용자 지시 2026-11-02).
    expect(screen.getByRole('button', { name: t.actions.approve })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.check })).toBeDisabled();
    expect(screen.getByText(t.actions.blockedUnsigned('공정검사1'))).toBeInTheDocument();
  });

  it('막히는 조건이 없으면 승인이 켜지고 상세의 ETag 로 보낸다', async () => {
    const base = sheet();
    const step = base.steps[0]!;
    const { user, requests } = setup(
      ['W-03-13', 'W-03-14'],
      sheet({
        steps: [
          {
            ...step,
            result: {
              ...step.result!,
              signedBy: 1,
              signedByName: '관리자',
              signedAt: '2026-10-21T03:00:00Z',
            },
          },
        ],
      }),
    );
    await open(user);

    await user.click(screen.getByRole('button', { name: t.actions.approve }));
    // 바로 보내지 않고 확정 창에서 한 번 더(사용자 지시 2026-11-02).
    const confirm = await screen.findByRole('dialog', { name: t.confirmDialog.title.approve });
    expect(requests.some((r) => r.path.endsWith(':approve'))).toBe(false);
    await user.click(within(confirm).getByRole('button', { name: t.confirmDialog.ok.approve }));
    await waitFor(() =>
      expect(requests.some((r) => r.path.endsWith('/inspection-sheets/9:approve'))).toBe(true),
    );
    expect(requests.find((r) => r.path.endsWith(':approve'))!.headers.get('If-Match')).toBe('"6"');
  });

  it('승인 취소는 사유가 비면 보내지 않고, 적으면 사유를 실어 보낸다', async () => {
    const { user, requests } = setup(
      ['W-03-13', 'W-03-14'],
      sheet({ approvedBy: 1, approvedByName: '관리자', approvedAt: '2026-10-21T03:00:00Z' }),
    );
    await open(user);

    // 승인만 된 검사표 — 「승인 취소」(사용자 지시 2026-11-02).
    await user.click(screen.getByRole('button', { name: t.actions.reopen.approve }));
    const dialog = await screen.findByRole('dialog', { name: t.actions.reopen.approve });
    expect(within(dialog).getByText(t.reopenDialog.body.approve)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.actions.reopen.approve }));
    expect(within(dialog).getByText(t.reopenDialog.required)).toBeInTheDocument();
    expect(requests.some((r) => r.path.endsWith(':reopen'))).toBe(false);

    await user.type(within(dialog).getByLabelText(t.reopenDialog.reason), '머리 값 오기');
    await user.click(within(dialog).getByRole('button', { name: t.actions.reopen.approve }));
    await waitFor(() => expect(requests.some((r) => r.path.endsWith(':reopen'))).toBe(true));
    // 알림은 연 때의 갈래(승인 취소)로 — 저장 뒤 상태로 세지 않는다.
    expect(
      await screen.findByText(t.actions.reopened(t.actions.reopen.approve)),
    ).toBeInTheDocument();
    expect(JSON.parse(requests.find((r) => r.path.endsWith(':reopen'))!.body)).toEqual({
      reason: '머리 값 오기',
    });
  });

  /* 고객 양식(B-05-101) 엑셀 내려받기(사용자 지시 2026-11-02) — 양식 채우기는 xlsx-form.test.ts 가 본다. */
  it('엑셀 다운로드는 연 검사표 한 장을 고객 양식 엑셀로 내려받는다', async () => {
    const { user } = setup(['W-03-13']);
    await open(user);

    await user.click(screen.getByRole('button', { name: t.excel.button }));

    await waitFor(() => expect(downloadSheetXlsx).toHaveBeenCalledOnce());
    expect(vi.mocked(downloadSheetXlsx).mock.calls[0]?.[0].serialNo).toBe('SN-0001');
  });

  /* 꼬리 단추(엑셀 · 승인 · 확인)는 기본 정보 탭에서만(사용자 지시 2026-11-02). */
  it('꼬리 단추는 기본 정보 탭에서만 보인다', async () => {
    const { user } = setup(['W-03-13']);
    await open(user);

    expect(screen.getByRole('button', { name: t.excel.button })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: d.tabs.events(0) }));
    expect(screen.queryByRole('button', { name: t.excel.button })).not.toBeInTheDocument();
  });

  /* 승인 자리에 승인 취소, 확인 자리에 확인 — 자리 · 모양이 고정이다(사용자 지시 2026-11-02). */
  /* 승인된 검사표를 확인하면 완료된다 — 확정 창에 완료 안내, 끝나면 「완료」 안내(리뷰 2026-11-02). */
  it('승인된 검사표를 확인하면 확정 창에 완료 안내가 붙고, 완료되면 완료 알림을 띄운다', async () => {
    const step = sheet().steps[0]!;
    const current = sheet({
      steps: [
        {
          ...step,
          result: {
            ...step.result!,
            signedBy: 1,
            signedByName: '관리자',
            signedAt: '2026-10-21T03:00:00Z',
          },
        },
      ],
      approvedBy: 1,
      approvedByName: '관리자',
      approvedAt: '2026-10-21T03:00:00Z',
    });
    const { user, requests } = setup(['W-03-13', 'W-03-14'], current);
    await open(user);

    await user.click(screen.getByRole('button', { name: t.actions.check }));
    const confirm = await screen.findByRole('dialog', { name: t.confirmDialog.title.check });
    expect(within(confirm).getByText(t.confirmDialog.completes)).toBeInTheDocument();
    // 서버는 확인으로 완료된 검사표를 돌려준다.
    Object.assign(current, {
      checkedBy: 2,
      checkedByName: '확인자',
      checkedAt: '2026-10-21T03:10:00Z',
      statusCode: 'COMPLETED',
    });
    await user.click(within(confirm).getByRole('button', { name: t.confirmDialog.ok.check }));

    expect(await screen.findByText(t.actions.completed)).toBeInTheDocument();
    expect(requests.some((r) => r.path.endsWith('/inspection-sheets/9:check'))).toBe(true);
  });

  it('종료일이 시작일보다 빠르면 조회를 막고 까닭을 보인다', async () => {
    const { user, requests } = setup(['W-03-13']);
    await screen.findByRole('table', { name: t.list.caption });
    const before = requests.length;

    await user.type(screen.getByLabelText(t.list.from), '2026-10-31');
    await user.type(screen.getByLabelText(t.list.to), '2026-10-01');

    expect(screen.getByRole('button', { name: t.list.search })).toBeDisabled();
    expect(screen.getByText(t.list.periodReversed)).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(
      requests
        .slice(before)
        .some(
          (r) =>
            r.path.endsWith('/quality/inspection-sheets') && r.query.get('from') === '2026-10-31',
        ),
    ).toBe(false);
  });

  it('승인만 된 검사표는 승인 자리에 승인 취소, 그 옆에 확인이 선다', async () => {
    const { user } = setup(
      ['W-03-13', 'W-03-14'],
      sheet({ approvedBy: 1, approvedByName: '관리자', approvedAt: '2026-10-21T03:00:00Z' }),
    );
    await open(user);

    const names = within(
      screen.getByText(t.excel.button).closest('.inspection-sheet-detail-actions')!,
    )
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual([
      expect.stringContaining(t.excel.button),
      t.actions.reopen.approve,
      t.actions.check,
    ]);
  });

  /* 취소 단추 이름은 상태를 따른다 — 확인만 → 확인 취소, 둘 다 → 일괄 취소(사용자 지시 2026-11-02). */
  it.each([
    [{ checkedBy: 2, checkedByName: '확인자', checkedAt: '2026-10-21T03:00:00Z' }, 'check'],
    [
      {
        approvedBy: 1,
        approvedByName: '관리자',
        approvedAt: '2026-10-21T03:00:00Z',
        checkedBy: 2,
        checkedByName: '확인자',
        checkedAt: '2026-10-21T03:10:00Z',
        statusCode: 'COMPLETED' as const,
      },
      'all',
    ],
  ] as const)('취소 단추 — %o 이면 %s', async (overrides, kind) => {
    const { user } = setup(['W-03-13', 'W-03-14'], sheet(overrides));
    await open(user);

    await user.click(screen.getByRole('button', { name: t.actions.reopen[kind] }));
    const dialog = await screen.findByRole('dialog', { name: t.actions.reopen[kind] });
    expect(within(dialog).getByText(t.reopenDialog.body[kind])).toBeInTheDocument();
  });

  it('부품 공장 범위만 있는 계정은 「OA 사업부 전용」 안내만 보이고 목록을 조회하지 않는다', async () => {
    const { requests } = setup(['W-03-13', 'W-03-14'], sheet(), 'PL11');

    expect(await screen.findByText(messages.common.oaOnly.notice)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: t.list.caption })).not.toBeInTheDocument();
    expect(requests.some((r) => r.path.endsWith('/quality/inspection-sheets'))).toBe(false);
  });
});
