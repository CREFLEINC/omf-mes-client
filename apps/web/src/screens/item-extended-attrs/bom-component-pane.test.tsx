import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BomComponentPane } from './bom-component-pane';
import {
  bomComponentFixtures,
  itemFixtures,
  processFixtures,
  routingOperationFixtures,
  uomFixtures,
} from './fixtures';
import type { LookupEntry } from './types';

const itemNameEntries: LookupEntry[] = itemFixtures.map((item) => ({
  value: String(item.itemId),
  label: `${item.itemCode} · ${item.itemName}`,
  isActive: item.isActive,
}));

const uomEntries: LookupEntry[] = uomFixtures.map((uom) => ({
  value: String(uom.uomId),
  label: `${uom.uomCode} · ${uom.uomName}`,
  isActive: uom.isActive,
}));

/** Rev 둘을 편 결과. 옛 Rev의 줄(8003)이 들어 있어야 3행이 이름을 얻는다(M32). */
const routingOperationEntries: LookupEntry[] = [
  { value: '8001', label: 'Rev 2 · 1. 합성 공정 A', isActive: true },
  { value: '8002', label: 'Rev 2 · 2. 합성 공정 B', isActive: true },
  { value: '8003', label: 'Rev 1 · 1. 합성 공정 C', isActive: true },
];

const processEntries: LookupEntry[] = processFixtures.map((process) => ({
  value: String(process.processId),
  label: `${process.processCode} · ${process.processName}`,
  isActive: process.isActive,
}));

const renderPane = (overrides: Partial<Parameters<typeof BomComponentPane>[0]> = {}) => {
  const onEdit = vi.fn<(bomComponentId: number) => void>();

  render(
    <BomComponentPane
      components={bomComponentFixtures}
      isLoading={false}
      itemNameEntries={itemNameEntries}
      isItemNameLoading={false}
      uomEntries={uomEntries}
      isUomLoading={false}
      routingOperationEntries={routingOperationEntries}
      isRoutingOperationLoading={false}
      processEntries={processEntries}
      isProcessLoading={false}
      optionsNotice={null}
      loadError={null}
      onEdit={onEdit}
      {...overrides}
    />,
  );

  return { onEdit, user: userEvent.setup() };
};

const pane = (): HTMLElement => screen.getByRole('region', { name: '구성품' });

const dataRows = (): HTMLElement[] => within(pane()).getAllByRole('row').slice(1);

/**
 * M23 — **원본 열은 값 표기다.**
 *
 * 한 행에 원본 열 여섯과 확장 열 넷이 섞여 있고 서버가 그 경계를 강제하지 않는다.
 * 원본 열에 입력칸을 두면 사용자가 고칠 수 있는 값으로 읽고, 그 기대가 저장에서 깨진다.
 */
describe('BomComponentPane — 원본 열에 편집 수단이 없다 (M23)', () => {
  it('표에 입력칸이 하나도 없다', () => {
    renderPane();

    const region = pane();
    expect(within(region).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(region).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(region).queryAllByRole('switch')).toHaveLength(0);
    expect(within(region).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(region).queryAllByRole('spinbutton')).toHaveLength(0);
  });

  /** 계약에 구성품 추가·삭제가 없다 — 그 액션을 두면 누를 수 없는 버튼이 남는다. */
  it('줄마다 편집 액션 하나뿐이다', () => {
    renderPane();

    const buttons = within(pane()).getAllByRole('button');

    expect(buttons).toHaveLength(bomComponentFixtures.length);
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toMatch(/확장 열 수정$/);
    }
  });

  it('편집 액션이 그 줄의 번호를 알린다', async () => {
    const { onEdit, user } = renderPane();

    await user.click(
      screen.getByRole('button', { name: '1. SYN-ITEM-02 · 합성 품목 B 확장 열 수정' }),
    );

    expect(onEdit).toHaveBeenCalledWith(7001);
  });

  /* 소비처가 아직 없으면 열지 못하는 버튼을 두지 않는다. */
  it('편집 콜백이 없으면 액션도 없다', () => {
    renderPane({ onEdit: undefined });

    expect(within(pane()).queryAllByRole('button')).toHaveLength(0);
  });
});

/** C16 — 스크랩률은 0~1 비율이며 퍼센트가 아니다(A-8). */
describe('BomComponentPane — 스크랩률 (C16)', () => {
  it('비율을 그대로 낸다', () => {
    renderPane();

    expect(within(dataRows()[0]!).getByText('0.05')).toBeInTheDocument();
  });

  /* 경계값 둘 — 「0%」·「100%」가 아니다. */
  it('0과 1도 비율 그대로다', () => {
    renderPane();

    expect(within(dataRows()[1]!).getByText('0')).toBeInTheDocument();
    expect(within(dataRows()[2]!).getByText('1')).toBeInTheDocument();
  });

  it('표에 퍼센트 기호가 없다', () => {
    renderPane();

    expect(pane().textContent).not.toContain('%');
  });
});

describe('BomComponentPane — 표기', () => {
  it('구성품 이름을 번호 대신 낸다', () => {
    renderPane();

    expect(within(dataRows()[0]!).getByText('SYN-ITEM-02 · 합성 품목 B')).toBeInTheDocument();
  });

  /* 실패한 행만 이름을 잃는다 — 번호를 대신 내지 않는다. */
  it('이름을 못 찾은 줄만 「알 수 없음」이 된다', () => {
    renderPane();

    expect(within(dataRows()[1]!).getByText('알 수 없음')).toBeInTheDocument();
    expect(dataRows()[1]!.textContent).not.toContain('9001');
  });

  /* 아직 못 받은 것과 값이 없는 것은 다른 사실이다. */
  it('이름을 받는 중에는 「알 수 없음」을 내지 않는다', () => {
    renderPane({ itemNameEntries: [], isItemNameLoading: true });

    expect(within(dataRows()[0]!).getByText('불러오는 중…')).toBeInTheDocument();
    expect(within(dataRows()[0]!).queryByText('알 수 없음')).not.toBeInTheDocument();
  });

  it('소요량과 단위를 한 칸에 담는다', () => {
    renderPane();

    expect(within(dataRows()[0]!).getByText('2 SYN-UOM-01 · 합성 단위 A')).toBeInTheDocument();
  });

  it('필수 여부를 말로 낸다', () => {
    renderPane();

    expect(within(dataRows()[0]!).getByText('필수')).toBeInTheDocument();
    expect(within(dataRows()[1]!).getByText('선택')).toBeInTheDocument();
  });

  /* ERP 원본 값이다 — 계약이 이 값을 감추라고 하지 않았다. */
  it('원본 순서 값을 그대로 낸다', () => {
    renderPane();

    expect(within(dataRows()[0]!).getByText('1')).toBeInTheDocument();
    expect(within(dataRows()[2]!).getByText('3')).toBeInTheDocument();
  });

  it('등록 공정과 실사용 공정을 한 칸에 담는다', () => {
    renderPane();

    expect(
      within(dataRows()[0]!).getByText('Rev 2 · 2. 합성 공정 B · SYN-PROC-01 · 합성 공정 가'),
    ).toBeInTheDocument();
  });

  /**
   * M32 — **옛 Rev의 공정도 이름을 얻어야 한다.**
   * 최신 Rev만 평탄화하면 이 줄이 「알 수 없음」이 된다.
   */
  it('옛 Rev의 등록 공정도 이름으로 나온다', () => {
    renderPane();

    expect(within(dataRows()[2]!).getByText(/Rev 1 · 1\. 합성 공정 C/)).toBeInTheDocument();
  });

  it('공정을 비운 줄은 값 없음 표기를 낸다', () => {
    renderPane();

    expect(within(dataRows()[1]!).getByText('— · —')).toBeInTheDocument();
  });

  it('켜진 확장 표시만 칩으로 낸다', () => {
    renderPane();

    expect(within(dataRows()[0]!).getByText('LOT 추적')).toBeInTheDocument();
    expect(within(dataRows()[0]!).getByText('백플러시')).toBeInTheDocument();
    expect(within(dataRows()[2]!).queryByText('LOT 추적')).not.toBeInTheDocument();
    expect(within(dataRows()[2]!).getByText('백플러시')).toBeInTheDocument();
  });

  it('빈 목록에 안내를 낸다', () => {
    renderPane({ components: [] });

    expect(screen.getByText('등록된 구성품이 없습니다')).toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 자리표시를 낸다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '구성품을 불러오는 중' })).toBeInTheDocument();
  });

  /* 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  it('조회 실패는 표를 밀어낸다', () => {
    renderPane({ loadError: <p>조회에 실패했습니다</p>, isLoading: true });

    expect(screen.getByText('조회에 실패했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: '구성품을 불러오는 중' })).toBeNull();
  });

  it('선택 목록 안내를 표 위에 낸다', () => {
    renderPane({ optionsNotice: <p>선택 목록이 일부만 표시됩니다</p> });

    expect(within(pane()).getByText('선택 목록이 일부만 표시됩니다')).toBeInTheDocument();
  });
});
