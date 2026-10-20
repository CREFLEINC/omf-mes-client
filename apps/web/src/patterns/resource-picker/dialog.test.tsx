import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import { ResourcePickerDialog } from './dialog';
import { RESOURCE_PAGE_SIZE } from './queries';

const t = messages.resourcePicker;

const EQUIPMENTS_PATH = '/mdm/equipments';
const MOLDS_PATH = '/mdm/molds';

const pathOf = (request: Request): string => new URL(request.url).pathname;

const EQUIPMENTS = [
  {
    equipmentId: 8001,
    plantId: 9001,
    equipmentCode: 'SYN-EQ-01',
    equipmentName: '합성 설비 A',
    productionLineId: 7001,
    isActive: true,
  },
  {
    equipmentId: 8002,
    plantId: 9001,
    equipmentCode: 'SYN-EQ-02',
    equipmentName: '합성 설비 B',
    productionLineId: null,
    isActive: false,
  },
];

const MOLDS = [
  {
    moldId: 8501,
    plantId: 9001,
    moldCode: 'SYN-MOLD-01',
    moldName: '합성 금형 A',
    isActive: true,
  },
];

interface Options {
  /** 나간 조회를 담아 둔다 — 무엇을 싣는지가 이 창의 핵심이다. */
  searches?: URL[];
  empty?: boolean;
  fails?: boolean;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (request) => [EQUIPMENTS_PATH, MOLDS_PATH].includes(pathOf(request)),
    respond: (request) => {
      options.searches?.push(new URL(request.url));
      if (options.fails === true) return jsonResponse({ message: '실패' }, { status: 500 });

      const items =
        options.empty === true ? [] : pathOf(request) === EQUIPMENTS_PATH ? EQUIPMENTS : MOLDS;

      return jsonResponse({
        items,
        page: { page: 1, size: RESOURCE_PAGE_SIZE, total: items.length },
      });
    },
  },
];

const renderDialog = (
  props: Partial<Parameters<typeof ResourcePickerDialog>[0]> = {},
  options: Options = {},
) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  renderWithProviders(
    <ResourcePickerDialog
      kind="equipment"
      plantId={9001}
      onClose={onClose}
      onConfirm={onConfirm}
      {...props}
    />,
    { fetch: createStubFetch(routes(options)), route: '/' },
  );

  return { onConfirm, onClose, user: userEvent.setup() };
};

const dialog = () => within(screen.getByRole('dialog'));

describe('ResourcePickerDialog — 조회', () => {
  it('검색어는 「찾기」나 엔터를 쳐야 나가고, 치는 동안에는 부르지 않는다', async () => {
    const searches: URL[] = [];
    const { user } = renderDialog({}, { searches });

    await waitFor(() => {
      expect(searches).toHaveLength(1);
    });
    /* 빈 검색어를 문자열로 보내지 않는다 — 축을 아예 싣지 않는다. */
    expect(searches[0]?.searchParams.has('q')).toBe(false);

    await user.type(dialog().getByLabelText(t.keywordLabel), 'EQ');
    expect(searches).toHaveLength(1);

    await user.click(dialog().getByRole('button', { name: t.search }));
    await waitFor(() => {
      expect(searches.at(-1)?.searchParams.get('q')).toBe('EQ');
    });

    await user.clear(dialog().getByLabelText(t.keywordLabel));
    await user.type(dialog().getByLabelText(t.keywordLabel), 'B{Enter}');
    await waitFor(() => {
      expect(searches.at(-1)?.searchParams.get('q')).toBe('B');
    });
  });

  /* 사용 중지한 설비도 고칠 줄에 남아 있을 수 있어 함께 받는다. */
  it('설비는 공장·라인으로 좁히고 사용 중지한 것까지 한 쪽씩 받는다', async () => {
    const searches: URL[] = [];
    renderDialog({ lineId: 7001 }, { searches });

    await waitFor(() => {
      expect(searches).toHaveLength(1);
    });
    const sent = searches[0];

    expect(sent?.pathname).toBe(EQUIPMENTS_PATH);
    expect(sent?.searchParams.get('plantId')).toBe('9001');
    expect(sent?.searchParams.get('productionLineId')).toBe('7001');
    expect(sent?.searchParams.get('includeInactive')).toBe('true');
    expect(sent?.searchParams.get('size')).toBe(String(RESOURCE_PAGE_SIZE));
  });

  it('라인을 주지 않으면 라인 축을 싣지 않는다', async () => {
    const searches: URL[] = [];
    renderDialog({}, { searches });

    await waitFor(() => {
      expect(searches).toHaveLength(1);
    });
    expect(searches[0]?.searchParams.has('productionLineId')).toBe(false);
  });

  /* 금형 목록에는 같은 공구 유형의 다른 것도 섞여 있다 — 금형만 고르게 한다. */
  it('금형은 금형 유형만 찾는다', async () => {
    const searches: URL[] = [];
    renderDialog({ kind: 'mold' }, { searches });

    expect(await dialog().findByRole('checkbox', { name: 'SYN-MOLD-01' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: t.title.mold })).toBeInTheDocument();

    const sent = searches[0];
    expect(sent?.pathname).toBe(MOLDS_PATH);
    expect(sent?.searchParams.get('toolTypeCode')).toBe('MOLD');
    expect(sent?.searchParams.get('plantId')).toBe('9001');
    expect(sent?.searchParams.get('includeInactive')).toBe('true');
  });
});

describe('ResourcePickerDialog — 고르기', () => {
  it('고르지 않으면 선택을 누를 수 없고, 체크한 줄을 넘긴다', async () => {
    const { onConfirm, user } = renderDialog();

    const checkbox = await dialog().findByRole('checkbox', { name: 'SYN-EQ-01' });
    expect(dialog().getByRole('button', { name: t.pick })).toBeDisabled();

    await user.click(checkbox);
    await user.click(dialog().getByRole('button', { name: t.pick }));

    expect(onConfirm).toHaveBeenCalledWith({
      id: 8001,
      plantId: 9001,
      code: 'SYN-EQ-01',
      name: '합성 설비 A',
      productionLineId: 7001,
      isActive: true,
    });
  });

  it('다른 줄을 체크하면 앞의 고름을 밀어낸다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(await dialog().findByRole('checkbox', { name: 'SYN-EQ-01' }));
    await user.click(dialog().getByRole('checkbox', { name: 'SYN-EQ-02' }));

    expect(dialog().getByRole('checkbox', { name: 'SYN-EQ-01' })).not.toBeChecked();

    await user.click(dialog().getByRole('button', { name: t.pick }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: 8002 }));
  });

  it('사용 중지한 것은 이름 옆에 밝힌다', async () => {
    renderDialog();

    expect(await dialog().findByText(`합성 설비 B · ${t.inactive}`)).toBeInTheDocument();
  });

  it('취소는 고르지 않고 닫는다', async () => {
    const { onClose, onConfirm, user } = renderDialog();

    await user.click(dialog().getByRole('button', { name: t.cancel }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ResourcePickerDialog — 빈 결과와 실패', () => {
  it('맞는 것이 없으면 그렇다고 알린다', async () => {
    renderDialog({}, { empty: true });

    expect(await dialog().findByText(t.noResult)).toBeInTheDocument();
  });

  it('조회가 실패하면 경고를 내고 고를 수 없다', async () => {
    renderDialog({}, { fails: true });

    expect(await dialog().findByText(t.searchFailed)).toBeInTheDocument();
    expect(dialog().queryByRole('checkbox')).not.toBeInTheDocument();
    expect(dialog().getByRole('button', { name: t.pick })).toBeDisabled();
  });
});
