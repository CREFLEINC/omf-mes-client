import { AlertBanner, Button, Card, Chip, Radio, RadioGroup } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { dateTimeText, itemText, qtyNumber, qtyText } from './row-view';
import type { WorkOrder } from './types';
import { sortForPick, statusKeyOf, type WorkOrderStatusKey } from './work-order-status';
import { isEmergency } from './work-order-type';

import { PopPageNav, pageBoundaryOf, type PageMetaLike } from '../../patterns/pop-page-nav';

const t = messages.workStart.list;
const labels = messages.workStart.selection;

/** 상태 하나에 색 하나(C-19). */
export const STATUS_CHIP: Readonly<Record<WorkOrderStatusKey, 'info' | 'warning' | 'idle'>> = {
  inProgress: 'info',
  suspended: 'warning',
  released: 'idle',
};

const SCOPE_EQUIPMENT = 'equipment';
const SCOPE_ALL = 'all';

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
  /** 전체 설비 범위인가. */
  isShowingAll: boolean;
  /** 단말에 설비가 매핑되지 않았는가. 좁힐 설비가 없어 범위 선택을 두지 않는다. */
  isEquipmentMissing?: boolean;
  /** 설비를 몰라 기본 목록을 세우지 못했는가. */
  isEquipmentUnknown: boolean;
  /** 사번 확인 전에는 고를 수 없다. */
  canSelect: boolean;
  selectedId: number | null;
  onSelect: (workOrder: WorkOrder) => void;
  onToggleScope: () => void;
  onRetry: () => void;
  /** 단위 번호를 코드로 옮긴다. 못 옮기면 `null`. 수량만 낸다. */
  uomCodeOf: (uomId: number | undefined) => string | null;
}

/**
 * 왼쪽 작업지시 구획(T-P-S 왼쪽 대상 목록). 이 화면에서 스크롤하는 자리는 이 구획의 목록 하나다.
 *
 * - 범위는 두 개 중 하나라 라디오 세그먼트다(C-12). 버튼 이름을 상태에 따라 바꾸지 않는다(C-3).
 * - 카드는 행 전체 터치로 고른다(C-1). 카드 정보는 T-P-W의 W/O 카드 기준(번호, 상태, 품목, 지시와 실적)이다.
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
  isEquipmentMissing = false,
  isEquipmentUnknown,
  canSelect,
  selectedId,
  onSelect,
  onToggleScope,
  onRetry,
  uomCodeOf,
}: WorkOrderListProps) => {
  const rows = sortForPick(workOrders ?? []);

  return (
    <section className="pane work-start-list" aria-label={t.title}>
      <div className="work-start-list-head">
        <h2 className="pane-title">{t.title}</h2>

        {/* 범위는 조회 축 하나(설비)를 뺄 뿐이다. 다른 조건은 그대로다(§5-5). */}
        {!isEquipmentMissing && (
          <RadioGroup
            name="work-start-scope"
            orientation="horizontal"
            className="work-start-scope"
            aria-label={t.scopeLabel}
            value={isShowingAll ? SCOPE_ALL : SCOPE_EQUIPMENT}
            onChange={(value) => {
              if ((value === SCOPE_ALL) !== isShowingAll) onToggleScope();
            }}
          >
            <Radio value={SCOPE_EQUIPMENT}>{t.scopeEquipment}</Radio>
            <Radio value={SCOPE_ALL}>{t.scopeAll}</Radio>
          </RadioGroup>
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
          <p className="field-note">{isShowingAll ? t.emptyAll : t.empty}</p>
        ) : null
      ) : (
        <ul className="pop-card-list" aria-label={t.caption}>
          {rows.map((row) => {
            const statusKey = statusKeyOf(row);
            const item = itemText(row);
            const process = (row.processName ?? '').trim();
            const order = qtyText(row.orderQty, uomCodeOf(row.uomId));
            const good = qtyNumber(row.progress?.goodQty);
            const plannedStart = dateTimeText(row.plannedStartAt);
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
                   * `aria-disabled`로 두지 않는다. DS `Card`는 `interactive`일 때 자기 값을 나중에
                   * 얹어 밖에서 넘긴 값을 지운다. `disabled`를 넘겨야 잠긴 카드로 읽힌다.
                   */
                  disabled={!canSelect}
                  onClick={() => {
                    if (!canSelect) return;

                    onSelect(row);
                  }}
                >
                  <Card.Body>
                    <p className="work-start-card-head">
                      <span className="work-start-wo-no">{row.workOrderNo}</span>
                      {statusKey !== null && (
                        <Chip status={STATUS_CHIP[statusKey]} size="md">
                          {t.status[statusKey]}
                        </Chip>
                      )}
                      {isEmergency(row) && (
                        <Chip status="error" size="md">
                          {t.emergencyBadge}
                        </Chip>
                      )}
                      {/* 「이 설비」 범위는 모두 같은 설비라 코드를 되풀이하지 않는다. */}
                      {row.plannedEquipmentId == null ? (
                        <Chip status="info" size="md">
                          {t.unassignedEquipmentBadge}
                        </Chip>
                      ) : (
                        (isShowingAll || isEquipmentMissing) &&
                        row.plannedEquipmentCode != null && (
                          <Chip status="idle" size="md">
                            {row.plannedEquipmentCode}
                          </Chip>
                        )
                      )}
                    </p>
                    {(item !== null || process !== '') && (
                      <p className="work-start-card-line">
                        {item !== null && (
                          <span>
                            <span className="work-start-label">{labels.item}</span> {item}
                          </span>
                        )}
                        {process !== '' && (
                          <span>
                            <span className="work-start-label">{labels.process}</span> {process}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="work-start-card-line">
                      {order !== null && <span>{good === null ? order : t.qty(good, order)}</span>}
                      {plannedStart !== null && <span>{t.plannedStart(plannedStart)}</span>}
                    </p>
                  </Card.Body>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {!isError && (
        <div className="work-start-list-foot">
          {total !== undefined && total > 0 && <p className="field-note">{t.total(total)}</p>}
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
