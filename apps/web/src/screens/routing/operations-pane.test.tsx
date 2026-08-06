import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { routingOperationFixtures } from './fixtures';
import { toOperationDrafts } from './operation-order';
import { OperationsPane, type OperationsPaneProps } from './operations-pane';

const DRAFTS = toOperationDrafts(routingOperationFixtures);

const PROCESS_LABELS: Record<string, string> = { '9001': '사출', '9002': '조립' };

const renderPane = (overrides: Partial<OperationsPaneProps> = {}) =>
  render(
    <OperationsPane
      drafts={DRAFTS}
      processLabel={(processId) => PROCESS_LABELS[processId] ?? processId}
      isLoading={false}
      isRevisionSelected
      loadError={null}
      optionsNotice={null}
      {...overrides}
    />,
  );

const bodyRows = (): HTMLElement[] => screen.getAllByRole('row').slice(1);

describe('OperationsPane', () => {
  /*
   * 서버 채번은 서버 재량이다(연번일 수도, 간격 채번일 수도 있다).
   * 그 값을 그대로 보이면 사용자가 그것을 자료로 읽고 「10번 공정」이라고 부르게 된다.
   */
  it('서버가 순서 값 10·20을 줘도 표시 번호는 1·2다', () => {
    renderPane();

    const rows = bodyRows();
    expect(within(rows[0] as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.queryByText('20')).not.toBeInTheDocument();
  });

  it('공정과 공정명을 다른 열로 낸다', () => {
    renderPane();

    const first = bodyRows()[0] as HTMLElement;
    expect(within(first).getByText('사출')).toBeInTheDocument();
    expect(within(first).getByText('1차 사출')).toBeInTheDocument();
  });

  /*
   * 확인 아이콘을 7개 늘어놓으면 보조기술에서 의미가 잡히지 않고 열이 화면 폭을 먹는다.
   * 켜진 것의 이름만 이어 한 칸에 낸다.
   */
  it('관리 항목 열에 켜진 항목의 이름만 이어 낸다', () => {
    renderPane();

    const first = bodyRows()[0] as HTMLElement;
    expect(within(first).getByText('MES 관리 · 실적 관리 · 검사 관리')).toBeInTheDocument();
  });

  it('관리 항목이 전부 꺼져 있으면 「없음」을 낸다', () => {
    renderPane();

    expect(within(bodyRows()[1] as HTMLElement).getByText('없음')).toBeInTheDocument();
  });

  it('표준 수율을 비율 그대로 내고 라벨에 허용 범위를 적는다', () => {
    renderPane();

    expect(screen.getByText('표준 수율(0~1)')).toBeInTheDocument();
    expect(within(bodyRows()[0] as HTMLElement).getByText('0.98')).toBeInTheDocument();
    // 퍼센트 환산을 하지 않는다 — 100배 오입력이 조용히 통과하는 길이 열린다.
    expect(screen.queryByText('98')).not.toBeInTheDocument();
  });

  it('표준 C/T 라벨에 단위 「초」가 있고 값이 없으면 빈 값 표식을 낸다', () => {
    renderPane();

    expect(screen.getByText('표준 C/T(초)')).toBeInTheDocument();
    expect(within(bodyRows()[0] as HTMLElement).getByText('45')).toBeInTheDocument();
    expect(within(bodyRows()[1] as HTMLElement).getAllByText('—').length).toBeGreaterThan(0);
  });

  /*
   * 정렬은 보는 방식이고 재배치는 편집이라 함께 쓰면 결과가 어긋난다.
   * 디자인 시스템도 정렬이 켜지면 순서 이동 버튼을 비활성화한다.
   */
  it('정렬 가능한 열을 두지 않는다 — 헤더에 정렬 버튼도 aria-sort도 없다', () => {
    renderPane();

    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBeGreaterThan(0);

    for (const header of headers) {
      expect(within(header).queryByRole('button')).toBeNull();
      expect(header).not.toHaveAttribute('aria-sort');
    }
  });

  it('Rev를 고르기 전에는 선택 안내만 낸다', () => {
    renderPane({ isRevisionSelected: false, drafts: [] });

    expect(screen.getByText('가운데에서 Rev를 먼저 고르세요')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('라인이 0건이면 빈 상태를 낸다', () => {
    renderPane({ drafts: [] });

    expect(screen.getByText('등록된 공정이 없습니다')).toBeInTheDocument();
  });

  it('조회에 실패하면 표도 빈 상태도 내지 않고 받은 오류 표시만 낸다', () => {
    renderPane({ drafts: [], loadError: <p>공정을 불러오지 못했습니다</p> });

    expect(screen.getByText('공정을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 공정이 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 동안에는 스켈레톤을 낸다', () => {
    renderPane({ drafts: [], isLoading: true });

    expect(screen.getByRole('status', { name: '공정 라인을 불러오는 중' })).toBeInTheDocument();
  });

  it('범위 밖 액션과 아직 붙지 않은 액션을 감추지 않고 사유와 함께 비활성으로 둔다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '공정 추가' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '선후행 설정' })).toBeDisabled();
    expect(
      screen.getByText(
        '선후행 설정은 아직 할 수 없습니다. 공정 사이의 선후 관계를 정하는 방식이 정해지면 이 버튼을 쓸 수 있습니다.',
      ),
    ).toBeInTheDocument();
  });

  it('선택 목록 안내를 받으면 표 위에 낸다', () => {
    renderPane({ optionsNotice: <p>선택 목록을 불러오지 못했습니다.</p> });

    expect(screen.getByText('선택 목록을 불러오지 못했습니다.')).toBeInTheDocument();
  });
});
