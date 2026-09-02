import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { EquipmentInspectionScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const equipment = {
  equipmentId: 7,
  plantId: 1,
  equipmentCode: 'PRS-01',
  equipmentName: '프레스 1호기',
  equipmentTypeCode: 'PRESS',
  statusCode: 'IN_SERVICE',
  calibrationRequired: false,
  isActive: true,
};

const measured = {
  equipmentInspectionItemId: 1,
  itemCode: 'CHK-01',
  itemName: '유압 압력',
  inspectionTypeCode: 'DAILY',
  judgmentMethodCode: 'MEASUREMENT',
  uomId: 9,
  lowerLimit: 12,
  upperLimit: 15,
  requiredFlag: true,
  sequenceNo: 1,
  cycleTypeCode: 'DAY',
  cycleInterval: 1,
  isActive: true,
};

const visual = {
  ...measured,
  equipmentInspectionItemId: 2,
  itemCode: 'CHK-02',
  itemName: '벨트 장력',
  judgmentMethodCode: 'VISUAL',
  uomId: null,
  lowerLimit: null,
  upperLimit: null,
  requiredFlag: false,
  sequenceNo: 2,
};

interface Options {
  items?: unknown[];
  level?: string;
  itemsStatus?: number;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (request: Request) => new URL(request.url).pathname === '/mdm/equipments',
    respond: () => jsonResponse({ items: [equipment], page: { page: 0, size: 200, total: 1 } }),
  },
  {
    match: (request: Request) =>
      new URL(request.url).pathname === '/mdm/equipments/7/inspection-items',
    respond: () =>
      options.itemsStatus === undefined
        ? jsonResponse({
            assigned: [],
            effective: options.items ?? [measured, visual],
            resolvedFromLevelCode: options.level ?? 'EQUIPMENT',
          })
        : jsonResponse({ message: '실패' }, { status: options.itemsStatus }),
  },
];

const submitRoute = (respond: (request: Request) => Response): StubRoute => ({
  match: (request: Request) =>
    new URL(request.url).pathname === '/maintenance/inspections' && request.method === 'POST',
  respond,
});

const SignedIn = ({ children }: { children: React.ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn({ workerNo: '900028', workerName: '김철수' });
    }
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (extra: StubRoute[] = [], options: Options = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <EquipmentInspectionScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]) },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText('설비 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const selectEquipment = async () => {
  await screen.findByLabelText('설비 스캔');
  scan('PRS-01');
  await screen.findByText('1. 유압 압력');
};

beforeEach(() => {
  store.clear();
});

describe('설비 점검 입력 화면', () => {
  it('스캔한 설비의 점검 항목을 순번대로 낸다', async () => {
    mount();

    await selectEquipment();

    expect(screen.getByText('2. 벨트 장력')).toBeInTheDocument();
    expect(screen.getByText('기준 12 ~ 15 9')).toBeInTheDocument();
  });

  /* 부여가 바뀌어도 다시 받기 전까지는 받아 둔 것으로 점검한다. */
  it('항목을 언제 받은 것인지 보인다', async () => {
    mount();

    await selectEquipment();

    expect(screen.getByText(/항목 기준: .* 수신/)).toBeInTheDocument();
  });

  /* 통제 근거 마스터가 비어 있으면 입력을 열지 않는다. */
  it('점검 항목이 부여돼 있지 않으면 입력을 열지 않는다', async () => {
    mount([], { items: [], level: 'NONE' });
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');

    expect(
      await screen.findByText('이 설비에 점검 항목이 등록돼 있지 않습니다'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '점검 완료' })).not.toBeInTheDocument();
  });

  /* 확인하지 못한 것을 등록되지 않은 것으로 말하면, 점검자는 항목이 지워진 줄 안다. */
  it('항목을 확인하지 못한 것과 등록되지 않은 것을 다른 말로 낸다', async () => {
    mount([], { itemsStatus: 500 });
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');

    expect(await screen.findByText(/점검 항목을 확인할 수 없습니다/)).toBeInTheDocument();
    expect(
      screen.queryByText('이 설비에 점검 항목이 등록돼 있지 않습니다'),
    ).not.toBeInTheDocument();
  });

  it('측정값을 적으면 기준으로 자동 판정한다', async () => {
    const user = userEvent.setup();
    mount();
    await selectEquipment();

    await user.type(screen.getByLabelText('측정값'), '13.4');

    expect(await screen.findByText('합격 1 · NG 0')).toBeInTheDocument();
  });

  /* 사람이 덮어쓸 수 있으면 기준이 뜻을 잃는다. */
  it('측정 항목에는 합격·NG 버튼을 두지 않는다', async () => {
    mount([], { items: [measured] });

    await selectEquipment();

    expect(screen.getByLabelText('측정값')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'NG' })).not.toBeInTheDocument();
  });

  it('범위 밖이면 NG로 판정하고 보전이 요청됨을 알린다', async () => {
    const user = userEvent.setup();
    mount();
    await selectEquipment();

    await user.type(screen.getByLabelText('측정값'), '20');

    expect(await screen.findByText('NG가 있어 보전이 요청됩니다.')).toBeInTheDocument();
  });

  it('필수 항목이 남으면 완료할 수 없고 무엇이 남았는지 말한다', async () => {
    mount();
    await selectEquipment();

    expect(screen.getByText('필수 항목 유압 압력이(가) 남았습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '점검 완료' })).toBeDisabled();
  });

  it('NG가 있으면 비고 없이 완료할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await selectEquipment();

    await user.type(screen.getByLabelText('측정값'), '20');

    expect(await screen.findByText('NG가 있어 비고를 적어야 합니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '점검 완료' })).toBeDisabled();

    await user.type(screen.getByLabelText('비고'), '누유 확인');

    expect(screen.getByRole('button', { name: '점검 완료' })).toBeEnabled();
  });

  it('계약 경로로 헤더와 라인을 한 번에 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      submitRoute((request) => {
        seen.push(request.clone());
        return jsonResponse({ inspectionId: 5 }, { status: 201 });
      }),
    ]);
    await selectEquipment();

    await user.type(screen.getByLabelText('측정값'), '13.4');
    await user.click(screen.getByRole('button', { name: '점검 완료' }));

    expect(await screen.findByText('점검을 기록했습니다')).toBeInTheDocument();
    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(await seen[0]!.json()).toMatchObject({
      equipmentId: 7,
      inspectionTypeCode: 'DAILY',
      lines: [{ inspectionItemId: 1, resultCode: 'OK', measuredValue: 13.4 }],
    });
  });

  /* 못 보낸 점검은 서버에 없어 작업 통제가 점검을 안 한 것으로 읽는다. */
  it('보내지 못하면 담아 두었다고만 말하고 통제에 반영되지 않음을 알린다', async () => {
    const user = userEvent.setup();
    mount([
      submitRoute(() => {
        throw new TypeError('Failed to fetch');
      }),
    ]);
    await selectEquipment();

    await user.type(screen.getByLabelText('측정값'), '13.4');
    await user.click(screen.getByRole('button', { name: '점검 완료' }));

    expect(await screen.findByText('점검을 담아 두었습니다')).toBeInTheDocument();
    expect(
      screen.getByText('연결되면 보냅니다. 아직 작업 통제에 반영되지 않습니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('점검을 기록했습니다')).not.toBeInTheDocument();
  });

  it('못 보낸 점검이 있으면 무엇에 반영되지 않는지 상시 보인다', async () => {
    const user = userEvent.setup();
    mount([
      submitRoute(() => {
        throw new TypeError('Failed to fetch');
      }),
    ]);
    await selectEquipment();

    await user.type(screen.getByLabelText('측정값'), '13.4');
    await user.click(screen.getByRole('button', { name: '점검 완료' }));
    await screen.findByText('점검을 담아 두었습니다');
    await user.click(screen.getByRole('button', { name: '다른 설비 점검' }));

    expect(
      await screen.findByText('미전송 점검 1건 — 작업 통제에 반영되지 않습니다'),
    ).toBeInTheDocument();
  });

  it('사번을 확인하기 전에는 완료할 수 없고 이유를 말한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <EquipmentInspectionScreen />
      </MemoryRouter>,
      { fetch: createStubFetch(routes()) },
    );
    await selectEquipment();

    await user.type(screen.getByLabelText('측정값'), '13.4');

    expect(screen.getByText('사번을 확인해야 점검할 수 있습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '점검 완료' })).toBeDisabled();
  });
});
