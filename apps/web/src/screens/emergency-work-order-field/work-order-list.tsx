import { AlertBanner, Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PopPageNav, pageBoundaryOf, type PageMetaLike } from '../../patterns/pop-page-nav';
import { popTouchClass } from '../../patterns/pop-touch';
import { dateTimeText, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';

export interface WorkOrderListProps {
  /** 못 받았으면 `undefined` — 빈 배열과 다른 사실이다. */
  workOrders: WorkOrder[] | undefined;
  /** 목록을 물었는가. 유형 값을 몰라 조회를 열지 않은 상태와 「없다」를 가른다. */
  isAsked: boolean;
  /** 물었고 아직 답이 오지 않았는가. */
  isLoading: boolean;
  /** 필터 전체 건수. 목록이 잘렸는지는 이 값으로만 알 수 있다. */
  total: number | undefined;
  /** 받은 쪽 정보. 쪽 넘김이 이 값으로 선다(#1005). */
  pageMeta: PageMetaLike | undefined;
  onPageChange: (page: number) => void;
  isError: boolean;
  selectedId: number | null;
  uomLabel: (uomId: number | undefined) => string;
  onSelect: (workOrder: WorkOrder | null) => void;
}

/**
 * 긴급 W/O 목록 구획 — 2단 배치의 **좌 칸**.
 *
 * ⭐ **표다.** 스펙 §7 이 이 목록을 `Table`(comfortable)로 적었고, POP 목록의 정본이
 * 「표 + 선택 칸 없음 + 줄 전체를 누르는 자리」로 한 벌로 모였다(`913a82c` — §3 목록 그림에
 * 선택 칸이 없고 §7 이 `Table` 하나만 적는다. 여러 건을 고르는 화면만 `Checkbox`·`RadioGroup`
 * 을 지정한다). 앞선 판은 카드 목록이었는데, 「좁은 칸에 열을 세우면 접힌다」는 그 판의 근거는
 * **줄 전체가 누르는 자리가 되면서 해소됐다** — 자재LOT 등록 화면이 같은 형태로 선다.
 *
 * ⛔ **빈 목록을 오류로 다루지 않는다.** 긴급 W/O 는 없는 것이 정상이고, 발행은 관리웹의
 * 몫이다 — 그래서 빈 상태 문구가 「어디서 만들어지는지」까지 말한다.
 *
 * ⛔ **받지 못한 것은 다르다.** 「없다」와 「모른다」를 같은 화면으로 말하면, 조회가 실패한
 * 사이에 긴급 지시가 밀려도 화면이 조용하다.
 *
 * ⛔ **아직 답이 안 온 것과 묻지 않은 것도 「없다」가 아니다.** 값이 비었다는 사실만 보고
 * 「없습니다」를 세우면, 받는 중인 몇 초 동안 현장 작업자가 **긴급 지시가 없다고 읽고 자리를
 * 뜬다.** 유형 값을 몰라 아예 묻지 못한 경우는 더 나쁘다 — 그 단언이 영구히 남는다.
 */
export const WorkOrderList = ({
  workOrders,
  isAsked,
  isLoading,
  total,
  pageMeta,
  onPageChange,
  isError,
  selectedId,
  uomLabel,
  onSelect,
}: WorkOrderListProps) => {
  const t = messages.emergencyWorkOrderField.list;

  const rows = workOrders ?? [];
  const isTruncated = total !== undefined && total > rows.length;

  const columns: Column<WorkOrder>[] = [
    {
      key: 'workOrder',
      header: t.columns.workOrder,
      align: 'center',
      /*
       * ⚠ **조작은 첫 칸의 버튼 하나가 갖는다.** 칸마다 버튼을 두면 한 줄에 탭 정지가 셋
       *    생기고 읽어 주는 이름도 셋이 된다 — 정본 목록과 같은 구조다.
       */
      render: (row) => {
        const isSelected = row.workOrderId === selectedId;

        return (
          <button
            type="button"
            className={`pop-row-select ${popTouchClass('normal')}${
              isSelected ? ' pop-row-select-on' : ''
            }`}
            aria-pressed={isSelected}
            aria-label={`${isSelected ? t.deselect : t.select} ${row.workOrderNo}`}
            onClick={() => {
              onSelect(isSelected ? null : row);
            }}
          >
            <span>
              <Chip status="error" size="md">
                {t.emergencyBadge}
              </Chip>{' '}
              {row.workOrderNo}
            </span>
          </button>
        );
      },
    },
    {
      key: 'item',
      header: t.columns.item,
      align: 'center',
      /* 발행 시각은 품목 아래에 쌓는다 — 정본 목록이 날짜를 그 자리에 둔다. */
      render: (row) => (
        <span className="stacked-cell pop-stacked-center">
          <span>{itemText(row)}</span>
          {/*
           * ⚠ **낱말 단위로만 접힌다**(#1147). 좌단이 좁아 한 줄로 두면 표가 구획을 넘쳐 수량
           *    열이 잘렸다. 그렇다고 그냥 접으면 「2026-」·「09-」처럼 날짜가 붙임표에서 쪼개진다.
           */}
          <span className="pop-emergency-released">
            {[t.columns.releasedAt, ...dateTimeText(row.releasedAt).split(' ')].map(
              (word, index) => (
                <span key={index}>{word}</span>
              ),
            )}
          </span>
        </span>
      ),
    },
    {
      key: 'quantity',
      header: t.columns.quantity,
      align: 'center',
      render: (row) => `${qtyText(row.orderQty)} ${uomLabel(row.uomId)}`,
    },
  ];

  return (
    <section className="pane" aria-label={t.title}>
      <h2>{t.title}</h2>

      {isError ? (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.loadError}</AlertBanner>
        </div>
      ) : (
        <>
          {/*
           * ⛔ 「없다」는 **묻고 답을 받은 뒤에만** 말할 수 있다. 받는 중이거나 묻지 않은
           *    동안에는 아무것도 단언하지 않는다.
           */}
          {rows.length === 0 ? (
            isAsked && !isLoading ? (
              <div className="banner-slot">
                <AlertBanner variant="info">{t.empty}</AlertBanner>
              </div>
            ) : null
          ) : (
            /*
             * 줄의 어느 칸을 눌러도 그 줄의 버튼을 대신 누른다.
             *
             * 디자인 시스템의 `Table` 은 행 클릭을 받지 않고 행에 식별자도 남기지 않는다.
             * 그래서 눌린 자리에서 «위로» 행을 찾아 그 안의 버튼을 누른다 — 정렬·그룹이
             * 켜져도 같은 행 안에서만 움직인다.
             */
            <div
              role="presentation"
              className="pop-row-target pop-emergency-list"
              onClick={(event) => {
                const from = event.target as HTMLElement;

                // 버튼을 직접 눌렀으면 그쪽이 이미 처리한다 — 여기서 또 누르면 두 번 뒤집힌다.
                if (from.closest('.pop-row-select') !== null) return;

                from.closest('tr')?.querySelector<HTMLButtonElement>('.pop-row-select')?.click();
              }}
            >
              <Table
                aria-label={t.caption}
                columns={columns}
                rows={rows}
                density="comfortable"
                getRowId={(row) => String(row.workOrderId)}
              />
            </div>
          )}

          {isTruncated && <p>{t.truncated(rows.length, total)}</p>}

          {/*
           * ⛔ **잘렸다고 «말하기만» 하지 않는다**(#1005 · G-34). 긴급 W/O 는 몰려서
           * 발행되므로 20건을 넘기 쉽고, 넘길 조작이 없으면 21번째부터 손이 닿지 않는다.
           */}
          <PopPageNav
            boundary={pageBoundaryOf(pageMeta)}
            label={t.pageNav}
            onChange={onPageChange}
          />

          {/*
           * 발행 자리를 여기서 찾지 않게 한다 — 이 화면에는 만드는 액션이 없다.
           * ⭐ 스펙이 ⓘ 를 붙인 자리라 안내 배너로 세운다.
           */}
          {rows.length > 0 && (
            <div className="banner-slot">
              <AlertBanner variant="info">{t.issuedElsewhere}</AlertBanner>
            </div>
          )}
        </>
      )}
    </section>
  );
};
