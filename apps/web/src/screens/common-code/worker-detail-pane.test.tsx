import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { workerFixtures } from './fixtures';
import type { LookupEntry } from './types';
import { WorkerDetailPane } from './worker-detail-pane';

const businessUnits: LookupEntry[] = [
  { value: '4001', label: 'SYN-BU-01 · 합성 사업부 A', isActive: true },
];
const plants: LookupEntry[] = [{ value: '6001', label: '합성 공장 1', isActive: true }];
const departments: LookupEntry[] = [
  { value: '3001', label: 'SYN-DEPT-01 · 합성 부서 A', isActive: true },
];

const renderPane = (overrides: Partial<Parameters<typeof WorkerDetailPane>[0]> = {}) =>
  render(
    <WorkerDetailPane
      worker={workerFixtures[0]!}
      businessUnitEntries={businessUnits}
      plantEntries={plants}
      departmentEntries={departments}
      {...overrides}
    />,
  );

describe('WorkerDetailPane — 쓰기 경로가 없다 (결정 9)', () => {
  /*
   * C59 — 계약에 `POST /mdm/workers`도 `PUT /mdm/workers/{id}`도 없다.
   * 폼 컨트롤을 잠그는 것이 아니라 **아예 두지 않는다** — 잠근 칸은 「언젠가 열린다」는 뜻이다.
   */
  it('폼 입력칸이 하나도 없다', () => {
    renderPane();

    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('버튼이 하나도 없다 — 저장도 수정도 사용 중지도 없다', () => {
    renderPane();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  /*
   * C60 — 이 안내는 `editability`가 아니라 **고정 문구**다.
   * 계약은 「항상 RECEIVED_FROM_ERP」라고 적었으나 목 서버는 `reason:'EDITABLE'`을 준다.
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

describe('WorkerDetailPane — 값 표기', () => {
  it('사번과 성명을 그대로 낸다', () => {
    renderPane();

    expect(screen.getByText('SYN-W-0001')).toBeInTheDocument();
    expect(screen.getByText('합성 작업자 A')).toBeInTheDocument();
  });

  /* C62 — 번호가 아니라 이름을 낸다. 번호는 사용자가 쓸 수 없는 내부 식별자다. */
  it('사업부·공장·부서를 이름으로 낸다', () => {
    renderPane();

    expect(screen.getByText('SYN-BU-01 · 합성 사업부 A')).toBeInTheDocument();
    expect(screen.getByText('합성 공장 1')).toBeInTheDocument();
    expect(screen.getByText('SYN-DEPT-01 · 합성 부서 A')).toBeInTheDocument();
  });

  it('선택 목록에 없는 번호는 「알 수 없음」이고 번호를 내지 않는다', () => {
    renderPane({ worker: workerFixtures[2]! });

    expect(screen.getByText('알 수 없음')).toBeInTheDocument();
    expect(screen.queryByText('9999')).not.toBeInTheDocument();
  });

  it('값이 없는 부서는 미지정 표기다', () => {
    renderPane({ worker: workerFixtures[1]! });

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  /* C62 — 상태 코드는 값 목록이 미정이다. 이름을 지어내지 않는다. */
  it('상태 코드는 원본 문자열 그대로 낸다', () => {
    renderPane({ worker: workerFixtures[1]! });

    expect(screen.getByText('SYN-UNKNOWN-STATUS')).toBeInTheDocument();
  });

  it('상태 코드가 비어 있으면 미지정 표기로 낸다 — 빈 칸을 남기지 않는다', () => {
    renderPane({ worker: workerFixtures[2]! });

    const status = screen.getByLabelText('상태');
    expect(status).toHaveTextContent('—');
  });

  /* C63 — 번호도 편집 수단도 두지 않는다. */
  it('계정 연결은 연결 여부만 낸다', () => {
    renderPane();

    expect(screen.getByText('연결됨')).toBeInTheDocument();
    expect(screen.queryByText('7001')).not.toBeInTheDocument();
  });

  it('계정이 없으면 연결 안 됨이다', () => {
    renderPane({ worker: workerFixtures[1]! });

    expect(screen.getByText('연결 안 됨')).toBeInTheDocument();
  });

  it('사용 여부를 값으로 낸다', () => {
    renderPane();
    expect(screen.getByText('사용 중')).toBeInTheDocument();
  });

  it('미사용 작업자는 미사용으로 낸다', () => {
    renderPane({ worker: workerFixtures[2]! });
    expect(screen.getByText('미사용')).toBeInTheDocument();
  });

  /* 값 표기도 이름을 갖는다 — 라벨이 없으면 무엇의 값인지 보조기술이 읽을 수 없다. */
  it('값마다 이름이 붙어 있다', () => {
    renderPane();

    expect(screen.getByLabelText('사번')).toHaveTextContent('SYN-W-0001');
    expect(screen.getByLabelText('계정 연결')).toHaveTextContent('연결됨');
  });
});
