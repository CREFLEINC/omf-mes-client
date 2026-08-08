import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EXPIRY_SOON_DAYS } from './expiry';
import { balance, expiredLotDetail, heldLotDetail, plainLotDetail } from './fixtures';
import { LotDetailPane, type LotDetailPaneProps } from './lot-detail-pane';
import type { ReferenceSource } from './lookups';

const t = messages.stockStatus;

/** 「오늘」을 고정한다 — 유효기한 표식이 실행 날짜에 따라 뒤집히면 안 된다. */
const TODAY = new Date(2026, 7, 8);

const source = (values: [number, string][], overrides: Partial<ReferenceSource> = {}) =>
  ({
    entries: values.map(([id, label]) => ({ value: String(id), label, isActive: true })),
    isError: false,
    isLoading: false,
    ...overrides,
  }) satisfies ReferenceSource;

const UOMS = source([[9501, 'SAMPLE-EA']]);
const PARTNERS = source([[9601, 'SAMPLE-PTR-01 · 합성 거래처 가']]);

/** LOT별 보기의 줄 하나. 수량 다섯은 상세 조회가 아니라 이 줄에서 온다. */
const ROW = balance({ groupBy: 'LOT', lotId: 9401 });

const renderPane = (overrides: Partial<LotDetailPaneProps> = {}) => {
  const onRetryReferences = vi.fn<() => void>();

  render(
    <LotDetailPane
      row={ROW}
      detail={heldLotDetail(TODAY)}
      today={TODAY}
      uomLookup={UOMS}
      partnerLookup={PARTNERS}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { onRetryReferences, user: userEvent.setup() };
};

/**
 * 라벨에 짝지어진 값. 이름과 값이 어긋나는 자리를 값으로 잡는다.
 *
 * **이름 칸(`<dt>`)으로만 찾는다** — 아래 표의 열 머리글에 같은 낱말(비고·단위)이 있어
 * 글자만으로 찾으면 엉뚱한 자리를 집는다.
 */
const valueOf = (label: string): string => {
  const term = screen.getAllByRole('term').find((node) => node.textContent === label);
  const cell = term?.closest('div');

  if (cell === undefined || cell === null) {
    throw new Error(`「${label}」의 값 칸을 찾지 못했습니다.`);
  }

  return within(cell).getByRole('definition').textContent ?? '';
};

describe('LotDetailPane — 수량 다섯', () => {
  /*
   * 목록에는 보유·가용·보류 셋만 두고 **예약·피킹은 여기서 낸다**(계획 결정 13).
   * 열 폭 예산이 목록에 다섯을 담지 못한다.
   */
  it('보유·예약·피킹·보류·가용 다섯이 보인다', () => {
    renderPane();

    expect(valueOf(t.detail.onHandQty)).toContain('120');
    expect(valueOf(t.detail.reservedQty)).toContain('20');
    expect(valueOf(t.detail.pickedQty)).toContain('5');
    expect(valueOf(t.detail.blockedQty)).toContain('10');
    expect(valueOf(t.detail.availableQty)).toContain('77');
  });

  /*
   * **서버가 준 가용(77)이 보유−예약−피킹−보류(85)와 다르다** — 화면이 다시 빼면
   * 이 단언이 깨진다(이슈 §6의 금지 항목).
   */
  it('가용을 화면이 다시 계산하지 않는다', () => {
    renderPane();

    expect(valueOf(t.detail.availableQty)).toContain('77');
    expect(valueOf(t.detail.availableQty)).not.toContain('85');
  });

  /*
   * **어느 수량인지는 조회 조건이 정한다.** 계약의 LOT 상세는 초기 수량만 갖고 지금 남은 양은
   * 잔액 줄이 나른다 — 밝히지 않으면 사용자가 그 LOT의 전체 재고로 읽는다.
   */
  it('수량이 조회 조건에 걸린 줄의 것임을 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.detail.quantitiesNote)).toBeInTheDocument();
  });

  it('수량의 단위를 이름으로 낸다', () => {
    renderPane();

    expect(screen.getAllByText('SAMPLE-EA').length).toBeGreaterThan(0);
  });
});

describe('LotDetailPane — 유효기한 표식', () => {
  /* 기준 일수째는 임박 안쪽의 마지막 날이다 — 픽스처가 그 경계로 만들어져 있다. */
  it('임박한 LOT에 임박 표식이 붙고 경과 표식은 붙지 않는다', () => {
    renderPane({ detail: heldLotDetail(TODAY) });

    expect(screen.getByText(t.detail.expirySoon)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.expiryPassed)).not.toBeInTheDocument();
  });

  it('기한이 지난 LOT에 경과 표식이 붙고 임박 표식은 붙지 않는다', () => {
    renderPane({ detail: expiredLotDetail(TODAY) });

    expect(screen.getByText(t.detail.expiryPassed)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.expirySoon)).not.toBeInTheDocument();
  });

  /* 선행 단언의 짝 — 표식이 늘 붙는 것이 아님을 값으로 고정한다. */
  it('유효기한이 없으면 표식도 안내도 없다', () => {
    renderPane({ detail: plainLotDetail() });

    expect(screen.queryByText(t.detail.expirySoon)).not.toBeInTheDocument();
    expect(screen.queryByText(t.detail.expiryPassed)).not.toBeInTheDocument();
    expect(screen.queryByText(t.detail.expiryNote(EXPIRY_SOON_DAYS))).not.toBeInTheDocument();
    expect(valueOf(t.detail.expiryDate)).toBe(t.values.empty);
  });

  /*
   * **표식일 뿐 조치가 아니다** — 기한이 지나도 보류가 자동으로 걸리지 않는다는 사실을
   * 화면이 말한다(이슈 §4 미결 5). 기준 일수도 미확정이라 상수에서 받아 적는다.
   */
  it('표식이 붙으면 자동 보류가 없다는 사실을 함께 밝힌다', () => {
    renderPane({ detail: expiredLotDetail(TODAY) });

    expect(screen.getByText(t.detail.expiryNote(EXPIRY_SOON_DAYS))).toBeInTheDocument();
  });
});

describe('LotDetailPane — LOT 속성', () => {
  it('LOT 번호·유형·상태·제조 시각·초기 수량·비고를 낸다', () => {
    renderPane();

    expect(screen.getByText('SAMPLE-LOT-0001')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE_LOT_T_A')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE_LOT_S_A')).toBeInTheDocument();
    expect(valueOf(t.detail.manufacturedAt)).not.toBe(t.values.empty);
    expect(valueOf(t.detail.initialQty)).toContain('150');
    expect(valueOf(t.detail.remarks)).toBe('합성 비고입니다');
  });

  it('비고가 없으면 빈칸이 아니라 대시다', () => {
    renderPane({ detail: plainLotDetail() });

    expect(valueOf(t.detail.remarks)).toBe(t.values.empty);
  });
});

describe('LotDetailPane — 외부 식별자', () => {
  it('식별자와 유형을 낸다', () => {
    renderPane();

    expect(screen.getByText('SAMPLE-EXT-0001')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-EXT-0002')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE_EXT_T_A')).toBeInTheDocument();
  });

  /* 발급처가 비어 있는 것이 정상이다 — 우리 쪽에서 붙인 번호다. 대시로 두면 누락으로 읽힌다. */
  it('발급처가 없으면 「(자체 부여)」로 적는다', () => {
    renderPane();

    expect(screen.getByText(t.detail.issuedBySelf)).toBeInTheDocument();
    /* 선행 단언 — 발급처가 있는 줄은 이름으로 보인다. */
    expect(screen.getByText('SAMPLE-PTR-01 · 합성 거래처 가')).toBeInTheDocument();
  });

  it('외부 식별자가 없으면 그 사실을 낸다', () => {
    renderPane({ detail: plainLotDetail() });

    expect(screen.getByText(t.detail.noExternalIdentifiers)).toBeInTheDocument();
  });
});

describe('LotDetailPane — 보류', () => {
  it('해제되지 않은 보류를 함께 낸다', () => {
    renderPane();

    expect(screen.getByText(t.detail.holds.wholeLot)).toBeInTheDocument();
    expect(screen.getByText('SAMPLE_HOLD_R_A')).toBeInTheDocument();
  });

  it('보류 구획에 의심자재 등록 경로가 안내된다', () => {
    renderPane();

    expect(screen.getByText(t.detail.holds.suspectMaterialPath)).toBeInTheDocument();
  });
});

describe('LotDetailPane — 조회 전용', () => {
  /*
   * **등록·수정·보류 해제 수단이 하나도 없다.** 계약에 `PUT /trace/lots/{lotId}`가 있으나
   * 이 화면은 조회다. 참조가 성했으면 버튼도 링크도 없어야 한다.
   */
  it('참조가 성하면 버튼도 링크도 없다', () => {
    renderPane();

    // 선행 단언 — 구획이 실제로 그려졌다.
    expect(screen.getByText('SAMPLE-LOT-0001')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  /* 기한이 지난 LOT에도 걸 수단이 없다 — 자동으로도 손으로도 이 화면에서 보류하지 않는다. */
  it('기한이 지난 LOT에도 보류 수단이 없다', () => {
    renderPane({ detail: expiredLotDetail(TODAY) });

    expect(screen.getByText(t.detail.expiryPassed)).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  /* 내부 번호를 문자열로 만드는 자리가 없다(#44). */
  it('내부 번호가 구획에 보이지 않는다', () => {
    const { container } = render(
      <LotDetailPane
        row={ROW}
        detail={heldLotDetail(TODAY)}
        today={TODAY}
        uomLookup={UOMS}
        partnerLookup={PARTNERS}
        onRetryReferences={vi.fn()}
      />,
    );

    // 선행 단언 — 이름이 실제로 보인다. 없으면 아래 단언이 아무것도 검사하지 않는다.
    expect(screen.getByText('SAMPLE-LOT-0001')).toBeInTheDocument();

    for (const id of ['9401', '9301', '9501', '9601', '9701', '9801']) {
      expect(container).not.toHaveTextContent(id);
    }
  });
});

describe('LotDetailPane — 참조 실패', () => {
  /*
   * **문구가 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.**
   * 이 구획이 이름을 내는 참조는 단위와 발급처 둘이다.
   */
  it('실패하면 사유와 다시 시도가 이 구획에 나온다', async () => {
    const { onRetryReferences, user } = renderPane({
      uomLookup: source([], { isError: true }),
    });

    expect(screen.getByText(t.detail.referencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('발급처만 실패해도 같은 자리가 밝힌다', () => {
    renderPane({ partnerLookup: source([], { isError: true }) });

    expect(screen.getByText(t.detail.referencesFailed)).toBeInTheDocument();
  });

  /* 짝 방향 — 성했을 때는 안내가 없다. 늘 떠 있으면 뜻이 없다. */
  it('참조가 성하면 실패 안내가 없다', () => {
    renderPane();

    expect(screen.queryByText(t.detail.referencesFailed)).not.toBeInTheDocument();
  });

  /* 아직 오지 않은 것을 「알 수 없음」으로 적으면 정상 값이 잘못된 값으로 읽힌다(#47). */
  it('참조가 아직 오지 않았으면 로딩 표기다', () => {
    renderPane({ uomLookup: source([], { isLoading: true }) });

    expect(screen.getAllByText(t.values.referenceLoading).length).toBeGreaterThan(0);
    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();
  });
});
