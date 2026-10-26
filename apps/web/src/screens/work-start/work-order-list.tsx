import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { WorkOrderInfo } from './work-order-info';
import type { WorkOrder } from './types';
import { sortForPick, statusKeyOf, type WorkOrderStatusKey } from './work-order-status';
import { isEmergency } from './work-order-type';

import { PopRowHead } from '../../patterns/pop-list-row';
import { PopPageNav, pageBoundaryOf, type PageMetaLike } from '../../patterns/pop-page-nav';

const t = messages.workStart.list;

/** 상태 하나에 색 하나(C-19). */
export const STATUS_CHIP: Readonly<Record<WorkOrderStatusKey, 'info' | 'warning' | 'idle'>> = {
  inProgress: 'info',
  suspended: 'warning',
  released: 'idle',
};

/**
 * W/O 제목 줄의 칩(C-21). 예외 칩(긴급, 설비 미지정)을 먼저, 맨 끝에 상태 칩 하나를 둔다.
 * 목록 카드와 「선택한 작업지시」가 같은 칩을 쓴다.
 */
export const WorkOrderChips = ({
  workOrder,
  isEquipmentUnassigned,
}: {
  workOrder: WorkOrder;
  isEquipmentUnassigned: boolean;
}) => {
  const statusKey = statusKeyOf(workOrder);

  return (
    <>
      {isEmergency(workOrder) && (
        <Chip status="error" size="md">
          {t.emergencyBadge}
        </Chip>
      )}
      {isEquipmentUnassigned && (
        <Chip status="info" size="md">
          {t.unassignedEquipmentBadge}
        </Chip>
      )}
      {statusKey !== null && (
        <Chip status={STATUS_CHIP[statusKey]} size="md">
          {t.status[statusKey]}
        </Chip>
      )}
    </>
  );
};

export interface WorkOrderListProps {
  /** 못 받았으면 `undefined`. 빈 배열과 다른 사실이다. */
  workOrders: WorkOrder[] | undefined;
  /** 목록을 물었는가. 설비를 몰라 조회를 열지 않은 상태와 「없다」를 가른다. */
  isAsked: boolean;
  isLoading: boolean;
  isError: boolean;
  /** 필터 전체 건수. */
  total: number | undefined;
  /** 받은 쪽 정보. 쪽 넘김이 이 값으로 선다(#1005). */
  pageMeta: PageMetaLike | undefined;
  onPageChange: (page: number) => void;
  /** 전체 설비 보기인가. */
  isShowingAll: boolean;
  /**
   * 단말 설비의 이름(없으면 코드). 돌아가는 버튼과 빈 목록 문구가 「이 설비」 대신 이 이름을
   * 쓴다(사용자 결정 2026-10-23). 모르면 `null`.
   */
  equipmentName: string | null;
  /** 단말에 설비가 매핑되지 않았는가. 좁힐 설비가 없어 [전체 설비 보기]를 두지 않는다. */
  isEquipmentMissing?: boolean;
  /** 설비를 몰라 기본 목록을 세우지 못했는가. */
  isEquipmentUnknown: boolean;
  selectedId: number | null;
  onSelect: (workOrder: WorkOrder) => void;
  /** [전체 설비 보기]와 [← 설비 이름]. 기본 목록과 전체 설비 목록을 오간다. */
  onToggleScope: () => void;
  onRetry: () => void;
  /** 단위 번호를 코드로 옮긴다. 못 옮기면 `null`. 수량만 낸다. */
  uomCodeOf: (uomId: number | undefined) => string | null;
}

/**
 * 왼쪽 작업지시 구획(T-P-S 왼쪽 대상 목록). 이 화면에서 스크롤하는 자리는 이 구획의 목록 하나다.
 *
 * - 기본 목록은 단말 설비의 작업지시다. [전체 설비 보기]를 누르면 다른 목록에 들어가듯 제목이
 *   「전체 설비 작업지시」로 바뀌고, 제목 왼쪽 [← 설비 이름]으로 돌아온다(사용자 결정 2026-10-26).
 * - 카드는 행 전체 터치로 고른다(C-1). 카드는 제목 줄(W/O 번호, 오른쪽 끝 상태 칩)과 정보 영역
 *   (「라벨 값」 쌍)으로 나뉜다(C-21). 두 목록에서 카드 항목은 같다(C-10, PG-14).
 * - 진행 중인 W/O를 위에 둔다. 받은 쪽 안에서만 정렬한다(서버 정렬은 계약 대기).
 * - 빈 목록은 오류가 아니다. 「받는 중」, 「없다」, 「실패」를 다른 문장으로 말한다.
 */
export const WorkOrderList = ({
  workOrders,
  isAsked,
  isLoading,
  isError,
  total,
  pageMeta,
  onPageChange,
  isShowingAll,
  equipmentName,
  isEquipmentMissing = false,
  isEquipmentUnknown,
  selectedId,
  onSelect,
  onToggleScope,
  onRetry,
  uomCodeOf,
}: WorkOrderListProps) => {
  const rows = sortForPick(workOrders ?? []);
  const scopeEquipment = equipmentName ?? t.scopeEquipmentUnknown;
  const title = isShowingAll ? t.allTitle : t.title;

  return (
    <section className="pane work-start-list" aria-label={title}>
      <div className="work-start-list-head">
        {/* 전체 설비 목록에서는 제목 왼쪽에 돌아가는 버튼을 둔다. 이름은 단말 설비의 실제 이름이다(C-13). */}
        {isShowingAll && !isEquipmentMissing && (
          <Button type="button" variant="outlined" size="lg" onClick={onToggleScope}>
            <span aria-hidden="true">← </span>
            {scopeEquipment}
          </Button>
        )}
        <h2 className="pane-title">{title}</h2>
        {/* 좁힐 설비가 없는 단말은 처음부터 전체 목록이라 버튼을 두지 않는다. */}
        {!isShowingAll && !isEquipmentMissing && (
          <Button
            type="button"
            variant="outlined"
            size="lg"
            className="work-start-show-all"
            onClick={onToggleScope}
          >
            {t.showAll}
          </Button>
        )}
      </div>

      {/* 설비를 몰라 기본 목록을 못 세운 상태는 빈 목록이 아니다. 사유와 할 일을 함께 보인다. */}
      {isEquipmentUnknown && !isShowingAll && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.equipmentUnknown}</AlertBanner>
        </div>
      )}

      {isError ? (
        <div className="banner-slot">
          <AlertBanner
            variant="error"
            action={
              <Button type="button" variant="outlined" size="sm" onClick={onRetry}>
                {t.retry}
              </Button>
            }
          >
            {t.loadError}
          </AlertBanner>
        </div>
      ) : rows.length === 0 ? (
        isLoading ? (
          <p className="field-note">{t.loading}</p>
        ) : isAsked ? (
          <p className="field-note">{isShowingAll ? t.emptyAll : t.empty(scopeEquipment)}</p>
        ) : null
      ) : (
        <ul className="pop-card-list" aria-label={t.caption}>
          {rows.map((row) => {
            const isSelected = selectedId === row.workOrderId;

            return (
              <li key={String(row.workOrderId)}>
                <Card
                  interactive
                  bordered
                  surface={isSelected ? 'high' : 'low'}
                  className="work-start-card"
                  aria-label={t.select(row.workOrderNo)}
                  aria-pressed={isSelected}
                  /*
                   * 사번이 없어도 고른다. 누른 것을 무시하지 않고, 화면이 사번 입력 창을 함께 연다
                   * (사용자 결정 2026-10-23, PG-27).
                   */
                  onClick={() => {
                    onSelect(row);
                  }}
                >
                  <Card.Body className="work-start-card-body">
                    {/* 제목 줄(C-21): W/O 번호(굵게, 고정폭)와 오른쪽 끝 칩. */}
                    <PopRowHead
                      title={<span className="work-start-wo-no">{row.workOrderNo}</span>}
                      chips={
                        <WorkOrderChips
                          workOrder={row}
                          isEquipmentUnassigned={row.plannedEquipmentId == null}
                        />
                      }
                    />
                    {/*
                     * 정보 영역(C-21). 계획 설비는 두 목록 모두 「설비 이름 (코드)」 쌍으로 보인다(C-10,
                     * PG-14). 설비가 정해지지 않은 W/O 는 「설비 미지정」 칩이 말한다.
                     */}
                    <WorkOrderInfo workOrder={row} uomCodeOf={uomCodeOf} />
                  </Card.Body>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {!isError && (
        <div className="work-start-list-foot">
          {total !== undefined && total > 0 && (
            <p className="field-note">
              {pageMeta === undefined || total <= pageMeta.size
                ? t.total(total)
                : t.range(
                    total,
                    (pageMeta.page - 1) * pageMeta.size + 1,
                    Math.min(pageMeta.page * pageMeta.size, total),
                  )}
            </p>
          )}
          {/* 잘렸다고 말하기만 하지 않는다. 키오스크라 주소창도 뒤로가기도 없다(#1005). */}
          <PopPageNav
            boundary={pageBoundaryOf(pageMeta)}
            label={t.pageNav}
            onChange={onPageChange}
          />
        </div>
      )}
    </section>
  );
};
