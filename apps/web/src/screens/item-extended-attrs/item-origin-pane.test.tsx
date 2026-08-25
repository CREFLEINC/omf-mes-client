import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { itemFixtures } from './fixtures';
import { ItemOriginPane } from './item-origin-pane';
import type { LookupEntry } from './types';

const uomEntries: LookupEntry[] = [
  { value: '7001', label: 'SYN-UOM-01 · 합성 단위 A', isActive: true },
  { value: '7002', label: 'SYN-UOM-02 · 합성 단위 B', isActive: false },
];

const renderPane = (overrides: Partial<Parameters<typeof ItemOriginPane>[0]> = {}) =>
  render(
    <ItemOriginPane
      item={itemFixtures[0]!}
      uomEntries={uomEntries}
      isUomLoading={false}
      {...overrides}
    />,
  );

/**
 * M01 — 원본 구획에 쓰기 수단이 없다.
 *
 * 이 화면의 첫 번째 함정이다(이슈 #14 §6). **잠그는 것이 아니라 두지 않는다** —
 * 계약의 `ItemUpdate`가 원본 4열을 담지 않고, 원본을 고치는 경로 자체가 없다.
 */
describe('ItemOriginPane — 쓰기 경로가 없다 (M01 · 결정 1)', () => {
  it('폼 입력칸이 하나도 없다', () => {
    renderPane();

    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('버튼이 하나도 없다 — 저장도 사용 중지도 없다', () => {
    renderPane();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  /*
   * 안내는 `editability`가 아니라 **고정 문구**다. 계약은 「항상 RECEIVED_FROM_ERP」라 적었으나
   * 목 서버는 `reason:'EDITABLE'`을 준다 — 쓰기 경로가 없다는 사실이 더 강한 근거다.
   * **공통 문구를 그대로 쓴다** — 이 화면 전용 문구를 만들지 않는다.
   */
  it('구획 머리에 외부 수신본 안내가 보인다', () => {
    renderPane();

    expect(
      screen.getByText(
        '외부 시스템에서 받은 자료라 여기서 수정할 수 없습니다. 원본 시스템에서 변경하세요.',
      ),
    ).toBeInTheDocument();
  });
});

describe('ItemOriginPane — 원본 4열의 값 표기', () => {
  it('네 열에 이름이 붙어 있다', () => {
    renderPane();

    expect(screen.getByLabelText('품목코드')).toHaveTextContent('SYN-ITEM-01');
    expect(screen.getByLabelText('품목명')).toHaveTextContent('합성 품목 A');
    expect(screen.getByLabelText('품목유형')).toHaveTextContent('SYN-TYPE-A');
    expect(screen.getByLabelText('기준 단위')).toHaveTextContent('SYN-UOM-01 · 합성 단위 A');
  });

  /* 확장 속성은 이 구획이 아니다 — 원본과 확장이 한 구획에 섞이면 경계가 사라진다. */
  it('확장 속성을 이 구획에 내지 않는다', () => {
    renderPane();

    expect(screen.queryByLabelText('LOT 관리 유형')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('선출 정책')).not.toBeInTheDocument();
  });

  /* 번호는 내부 식별자라 사용자가 쓸 수 없는 값이고, 보이면 자료로 읽힌다. */
  it('선택 목록에 없는 기준 단위는 「알 수 없음」이고 번호를 내지 않는다', () => {
    renderPane({ item: itemFixtures[2]! });

    expect(screen.getByLabelText('기준 단위')).toHaveTextContent('알 수 없음');
    expect(screen.queryByText('9999')).not.toBeInTheDocument();
  });

  /*
   * 단위 목록이 도착하기 전에는 어떤 번호도 이름으로 옮길 수 없다.
   * 그 상태를 「알 수 없음」으로 내면 값이 잘못 담긴 것처럼 읽힌다.
   */
  it('단위 목록을 받는 중이면 「알 수 없음」을 내지 않는다', () => {
    renderPane({ uomEntries: [], isUomLoading: true });

    expect(screen.getByLabelText('기준 단위')).toHaveTextContent('이름 불러오는 중');
    expect(screen.getByLabelText('기준 단위')).not.toHaveTextContent('알 수 없음');
  });

  it('단위 조회가 실패하면 번호 대신 실패 상태를 낸다', () => {
    renderPane({ item: itemFixtures[2]!, uomEntries: [], isUomLoading: false, isUomError: true });

    expect(screen.getByLabelText('기준 단위')).toHaveTextContent('이름을 불러오지 못했습니다');
    expect(screen.queryByText('9999')).not.toBeInTheDocument();
  });

  it('품목유형이 비어 있으면 미지정 표기다 — 빈 칸을 남기지 않는다', () => {
    renderPane({ item: itemFixtures[1]! });

    expect(screen.getByLabelText('품목유형')).toHaveTextContent('—');
  });

  /* 값 목록이 미정이라 이름을 지어내지 않는다. */
  it('품목유형은 코드 문자열을 그대로 낸다', () => {
    renderPane({ item: itemFixtures[2]! });

    expect(screen.getByLabelText('품목유형')).toHaveTextContent('SYN-TYPE-B');
  });

  it('구획에 접근 이름이 있다', () => {
    renderPane();

    expect(screen.getByRole('region', { name: '품목 원본 정보' })).toBeInTheDocument();
  });
});
