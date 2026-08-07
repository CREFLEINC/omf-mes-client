import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BomDetailPane } from './bom-detail-pane';
import { bomFixtures, uomFixtures } from './fixtures';
import type { LookupEntry } from './types';

const uomEntries: LookupEntry[] = uomFixtures.map((uom) => ({
  value: String(uom.uomId),
  label: `${uom.uomCode} · ${uom.uomName}`,
  isActive: uom.isActive,
}));

const renderPane = (overrides: Partial<Parameters<typeof BomDetailPane>[0]> = {}) => {
  render(
    <BomDetailPane
      bom={bomFixtures[0]!}
      uomEntries={uomEntries}
      isUomLoading={false}
      {...overrides}
    />,
  );
};

const pane = (): HTMLElement => screen.getByRole('region', { name: '자재 명세서 정보' });

/**
 * C03 — **원본 구획에 폼 컨트롤이 0개이고 저장 버튼이 없다.**
 *
 * 품목 원본 구획과 같은 자리를 두 번째로 되풀이한다. 계약이 「전 필드 읽기 전용」이라 적었고
 * `PUT /planning/boms/{bomId}`가 아예 없다 — 잠근 입력칸조차 두지 않는다.
 */
describe('BomDetailPane — 쓰기 수단이 없다 (C03)', () => {
  it('폼 컨트롤이 하나도 없다', () => {
    renderPane();

    const region = pane();
    expect(within(region).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(region).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(region).queryAllByRole('switch')).toHaveLength(0);
    expect(within(region).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(region).queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('버튼이 하나도 없다', () => {
    renderPane();

    expect(within(pane()).queryAllByRole('button')).toHaveLength(0);
  });

  /* 이 화면 전용 문구를 만들지 않는다 — 품목 원본 구획과 같은 공통 문구다. */
  it('외부 정본이라는 공통 안내를 낸다', () => {
    renderPane();

    expect(
      within(pane()).getByText(
        '외부 시스템에서 받은 자료라 여기서 수정할 수 없습니다. 원본 시스템에서 변경하세요.',
      ),
    ).toBeInTheDocument();
  });
});

describe('BomDetailPane — 표기', () => {
  it('헤더 여섯 자리를 값 표기로 낸다', () => {
    renderPane();

    expect(screen.getByLabelText('BOM 코드')).toHaveTextContent('SYN-BOM-01');
    expect(screen.getByLabelText('Rev')).toHaveTextContent('Rev 1');
    expect(screen.getByLabelText('유효기간')).toHaveTextContent('2026-01-01 ~ 2026-12-31');
  });

  /* 값 목록이 확정되지 않아 이름을 지어내지 않는다. */
  it('상태 코드를 이름으로 바꾸지 않는다', () => {
    renderPane();

    expect(screen.getByLabelText('상태')).toHaveTextContent('SYN-BOM-STATUS-A');
  });

  it('기본이 아니면 값 없음 표기를 낸다', () => {
    renderPane();

    expect(screen.getByLabelText('기본')).toHaveTextContent('—');
  });

  it('기본이면 표식을 낸다', () => {
    renderPane({ bom: bomFixtures[1]! });

    expect(screen.getByLabelText('기본')).toHaveTextContent('기본');
  });

  /* 수량과 단위는 따로 읽히지 않는다 — 구성품 표의 소요량과 같은 형태로 담는다. */
  it('기준 수량과 단위를 한 칸에 담는다', () => {
    renderPane();

    expect(screen.getByLabelText('기준 수량')).toHaveTextContent('100 SYN-UOM-01 · 합성 단위 A');
  });

  /* 번호를 화면에 내지 않는다 — 내부 식별자라 사용자가 쓸 수 없는 값이다. */
  it('목록에 없는 단위 번호를 그대로 내지 않는다', () => {
    renderPane({ bom: bomFixtures[1]! });

    expect(screen.getByLabelText('기준 수량')).toHaveTextContent('250 알 수 없음');
    expect(screen.getByLabelText('기준 수량')).not.toHaveTextContent('9999');
  });

  /* 아직 못 받은 것과 값이 없는 것은 다른 사실이다. */
  it('단위 목록을 받는 중에는 「알 수 없음」을 내지 않는다', () => {
    renderPane({ uomEntries: [], isUomLoading: true });

    expect(screen.getByLabelText('기준 수량')).toHaveTextContent('100 불러오는 중…');
  });

  it('유효 종료가 없으면 값 없음 표기를 낸다', () => {
    renderPane({ bom: bomFixtures[1]! });

    expect(screen.getByLabelText('유효기간')).toHaveTextContent('2026-03-01 ~ —');
  });
});
