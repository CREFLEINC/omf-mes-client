import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChannelPane } from './channel-pane';
import { channelItems, makeChannel, makeEquipment } from './fixtures';
import type { ChannelFilters } from './types';

const t = messages.collectionChannel;

const equipment = makeEquipment(3001, 'EQ-101', '가상 성형기 1호');

const filters = (overrides: Partial<ChannelFilters> = {}): ChannelFilters => ({
  includeInactive: false,
  unmappedOnly: false,
  ...overrides,
});

const renderPane = (props: Partial<Parameters<typeof ChannelPane>[0]> = {}) =>
  render(
    <ChannelPane
      equipment={equipment}
      channels={channelItems}
      isLoading={false}
      filters={filters()}
      onChangeFilters={() => undefined}
      limitNote={null}
      onAdd={() => undefined}
      onEdit={() => undefined}
      canImport
      onImport={() => undefined}
      onChangeActivation={() => undefined}
      loadError={null}
      {...props}
    />,
  );

/**
 * ⛔ **조회가 실패한 자리에 요약을 남기지 않는다.**
 *
 * 저장 뒤 목록을 다시 불러오다 실패하면 **앞서 받은 목록은 캐시에 남는다** — 표는 오류
 * 배너로 바뀌었는데 「미매핑 2개」만 그대로면 **보이지 않는 줄을 두고 하는 말**이 된다.
 * 화면 전체로는 아직 그 자리에 닿는 손잡이가 없어(쓰기가 다음 슬라이스다) 페인에서 잰다.
 */
describe('채널 페인 — 요약이 서는 조건', () => {
  it('받은 목록이 있으면 미매핑 건수를 말한다', () => {
    renderPane();

    expect(screen.getByText(t.channels.unmappedSummary(2))).toBeInTheDocument();
  });

  it('조회가 실패한 자리에는 앞서 받은 목록의 요약을 남기지 않는다', () => {
    renderPane({ loadError: <p>불러오지 못했습니다</p> });

    expect(screen.queryByText(t.channels.unmappedSummaryTitle)).not.toBeInTheDocument();
    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
  });

  /** 로딩 중에는 받은 것이 없어 건수가 0이다 — 조건이 이미 막는다. */
  it('불러오는 중에는 요약이 서지 않는다', () => {
    renderPane({ channels: [], isLoading: true });

    expect(screen.queryByText(t.channels.unmappedSummaryTitle)).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: t.channels.loading })).toBeInTheDocument();
  });

  it('목록이 잘렸다는 안내를 표 위에 세운다', () => {
    renderPane({ limitNote: t.channels.mayHaveMore(200) });

    expect(screen.getByText(t.channels.mayHaveMore(200))).toBeInTheDocument();
  });
});

/** ⚠ **빈 문자열도 빈 칸을 만든다.** 계약이 막지 않으므로 화면이 같은 자리로 보낸다. */
describe('채널 페인 — 값이 없는 칸', () => {
  it('신호 이름이 빈 문자열로 와도 기록 없음이라 적는다', () => {
    renderPane({
      channels: [makeChannel(7001, 'CYCLE_TIME', { signalName: '', unitCode: 'SEC' })],
    });

    expect(screen.getByText(t.fields.notRecorded)).toBeInTheDocument();
  });
});

/**
 * ⭐ **조건 열이 없으면 표가 거짓말을 한다** — 같은 채널명이 두 줄 서는데 무엇이 다른지
 * 보이지 않으면 중복으로 읽힌다(설계 회신 `omf-mes#203` 질문1 · 통지 #388).
 */
describe('조건 열', () => {
  const scoped = [
    makeChannel(7101, 'DIM_A', { signalName: '외경 A', itemId: 21, itemCode: 'ITM-201' }),
    makeChannel(7102, 'DIM_A', { signalName: '두께', processId: 31, processCode: 'PRC-301' }),
    makeChannel(7103, 'DIM_A', { signalName: '기본' }),
    makeChannel(7104, 'DIM_A', {
      signalName: '외경 A · 프레스',
      itemId: 22,
      itemCode: 'ITM-202',
      processId: 32,
      processCode: 'PRC-302',
    }),
  ];

  it('표의 열로 선다', () => {
    renderPane({ channels: scoped });

    expect(screen.getByRole('columnheader', { name: t.scope.columnHeader })).toBeInTheDocument();
  });

  it('축마다 무엇으로 맞았는지 적는다', () => {
    renderPane({ channels: scoped });

    expect(screen.getByText(t.scope.entry(t.scope.item, 'ITM-201'))).toBeInTheDocument();
    expect(screen.getByText(t.scope.entry(t.scope.process, 'PRC-301'))).toBeInTheDocument();
  });

  /**
   * ⛔ **두 축이 걸린 줄은 둘 다 보여야 한다** — 하나만 세우면 그 줄이 더 넓은 범위로
   * 읽히고, 같은 채널명의 다른 줄과 구별되지 않는다.
   */
  it('두 축이 걸리면 둘 다 세운다', () => {
    renderPane({ channels: scoped });

    expect(screen.getByText(t.scope.entry(t.scope.item, 'ITM-202'))).toBeInTheDocument();
    expect(screen.getByText(t.scope.entry(t.scope.process, 'PRC-302'))).toBeInTheDocument();
  });

  /** ⛔ 빈 칸으로 두지 않는다 — 「안 정했다」가 아니라 「언제나 적용된다」다. */
  it('조건이 없는 줄은 빈 칸이 아니라 「전체」다', () => {
    renderPane({ channels: scoped });

    expect(screen.getByText(t.scope.all)).toBeInTheDocument();
  });
});
