import {
  Breadcrumb,
  Button,
  Chip,
  Dialog,
  EmptyState,
  PageHeader,
  Skeleton,
  Table,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { LoadErrorBanner } from './load-error-banner';
import {
  lookupNote,
  useEquipmentOptions,
  useInspectionItemOptions,
  useUserOptions,
} from './lookups';
import {
  derivedTypeLabel,
  EMPTY_DRAFT,
  hasErrors,
  toCreateBody,
  validateDraft,
  type DraftErrors,
  type OrderDraft,
} from './order-draft';
import { OrderForm } from './order-form';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  useBreakdownCandidates,
  useInspectionCandidates,
  useOrderCancel,
  useOrderCreate,
  useOrderDetail,
  useOrderList,
  type OrderListQuery,
} from './queries';
import { TriggerPicker } from './trigger-picker';
import {
  ISSUED_STATUS,
  orderStatusLabel,
  type OrderView,
  type SelectOption,
  type TriggerDraft,
} from './types';

const t = messages.maintenanceOrder;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ORDERS: OrderView[] = [];
const EMPTY_TRIGGERS: TriggerDraft[] = [];

const optional = (value: string | null): string =>
  value === null || value.trim() === '' ? t.list.notAvailable : value;

const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

/**
 * W-05-05 컨테이너 — 고장·점검 불합격·주기 도래를 묶어 보전 지시를 낸다.
 *
 * ⛔ **일괄 발행 경로가 없다.** 이 화면은 트리거 여럿을 지시 **하나**로 묶으므로 요청도 한 번만
 * 나간다. 툴 예방보전 화면(W-05-02)은 반대다 — 툴 하나마다 지시 하나이므로 대상 수만큼 부른다.
 * **카디널리티가 반대**라 한 경로가 둘을 다 하면 부분 실패가 뒤엉킨다.
 *
 * ⭐ **트리거는 같은 설비끼리만** 묶인다. 하나를 고르면 다른 설비의 줄이 잠긴다.
 *
 * ⭐ **보전 유형을 화면이 고르지 않는다** — 트리거 조합이 정한다. 화면은 무엇이 될지 미리
 * 보여 주기만 한다.
 *
 * ⭐ **취소하려면 상세를 먼저 부른다** — 잠금 토큰이 상세 경로에 보관되므로, 부르지 않으면
 * 요청이 아예 나가지 않는다. 그래서 확인 창을 열 때 그 조회가 함께 돈다.
 *
 * **고른 트리거는 주소가 아니라 화면이 들고 있다** — 발행 전의 편집 상태이고, 주소에 실으면
 * 공유한 주소가 남의 편집 중간 상태를 여는 셈이 된다.
 */
export const MaintenanceOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = searchParams.get('status') ?? '';
  const page = isPositiveInteger(searchParams.get('page') ?? '')
    ? Number(searchParams.get('page'))
    : 1;

  const listQuery = useMemo<OrderListQuery>(
    () => ({
      ...(statusFilter === '' ? {} : { statusCode: statusFilter }),
      ...(page > 1 ? { page } : {}),
    }),
    [statusFilter, page],
  );

  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);
  const [triggers, setTriggers] = useState<TriggerDraft[]>(EMPTY_TRIGGERS);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [isConfirming, setConfirming] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);

  const breakdowns = useBreakdownCandidates();
  const inspections = useInspectionCandidates();
  const orders = useOrderList(listQuery);
  const cancelDetail = useOrderDetail(cancelTarget);

  const equipments = useEquipmentOptions();
  const users = useUserOptions();
  const items = useInspectionItemOptions();

  const create = useOrderCreate(() => {
    /* 발행이 끝나면 폼과 고른 트리거를 비운다 — 남아 있으면 같은 지시를 또 낸다. */
    setDraft(EMPTY_DRAFT);
    setTriggers(EMPTY_TRIGGERS);
    setErrors({});
    setConfirming(false);
  });

  const cancel = useOrderCancel(cancelTarget, () => {
    setCancelTarget(null);
  });

  const toOptions = (entries: { value: string; label: string }[]): SelectOption[] =>
    entries.map((entry) => ({ value: entry.value, label: entry.label }));

  const rows = orders.data?.items ?? EMPTY_ORDERS;
  const pageView = toPageView(orders.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /**
   * 트리거를 넣거나 뺀다. **넣을 때 대상 설비를 함께 정한다** — 고른 트리거와 대상이 갈리면
   * 지시가 엉뚱한 설비를 가리키고, 발행한 뒤에는 취소 말고 되돌릴 길이 없다.
   */
  const toggleTrigger = (trigger: TriggerDraft): void => {
    setTriggers((current) => {
      const exists = current.some((item) => item.key === trigger.key);
      const next = exists
        ? current.filter((item) => item.key !== trigger.key)
        : [...current, trigger];

      /* 마지막 하나를 빼면 대상도 비운다 — 남겨 두면 트리거 없는 설비가 걸린 채로 있다. */
      setDraft((prev) => ({
        ...prev,
        target: next.length === 0 ? '' : String(next[0]?.equipmentId ?? ''),
      }));

      return next;
    });
  };

  /** 고른 트리거 하나를 뺀다. 마지막 하나를 빼면 대상도 함께 비운다. */
  const removeTrigger = (key: string): void => {
    setTriggers((current) => {
      const next = current.filter((item) => item.key !== key);

      setDraft((prev) => ({
        ...prev,
        target: next.length === 0 ? '' : String(next[0]?.equipmentId ?? ''),
      }));

      return next;
    });
  };

  const requestSubmit = (): void => {
    const nextErrors = validateDraft(draft, triggers);

    setErrors(nextErrors);

    if (hasErrors(nextErrors)) return;

    setConfirming(true);
  };

  const listColumns: Column<OrderView>[] = [
    {
      key: 'order',
      header: t.list.orderNo,
      render: (row) => (
        <span className="stacked-cell">
          <span>{optional(row.maintenanceOrderNo)}</span>
          <span>{optional(row.targetCode)}</span>
        </span>
      ),
    },
    { key: 'plannedDate', header: t.list.plannedDate, render: (row) => row.plannedDate },
    {
      key: 'statusCode',
      header: t.list.status,
      render: (row) => <Chip size="sm">{orderStatusLabel(row.statusCode)}</Chip>,
    },
    {
      key: 'cancel',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="text"
          /* ⛔ 발행 상태가 아니면 취소가 성립하지 않는다 — 잠그고 사유를 함께 낸다. */
          disabled={row.statusCode !== ISSUED_STATUS}
          onClick={() => {
            setCancelTarget(row.maintenanceOrderId);
          }}
        >
          {t.list.cancel}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {(breakdowns.isError || inspections.isError) && (
        <LoadErrorBanner
          error={breakdowns.error ?? inspections.error}
          onRetry={() => {
            void breakdowns.refetch();
            void inspections.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.triggers}>
        <h2>{t.triggers.heading}</h2>
        <TriggerPicker
          breakdowns={breakdowns.data ?? []}
          inspections={inspections.data ?? []}
          isLoading={breakdowns.isPending || inspections.isPending}
          selected={triggers}
          equipmentOptions={toOptions(equipments.entries)}
          onToggle={toggleTrigger}
          onRemove={removeTrigger}
        />
      </section>

      <section className="pane" aria-label={t.panes.form}>
        <SaveErrorBanner error={create.error} />
        <OrderForm
          draft={draft}
          triggers={triggers}
          errors={{ ...errors, ...create.fieldErrors }}
          equipmentOptions={toOptions(equipments.entries)}
          userOptions={toOptions(users.entries)}
          itemOptions={toOptions(items.entries)}
          equipmentNote={lookupNote(equipments, t.form.equipmentLookupFailed)}
          userNote={lookupNote(users, t.form.userLookupFailed)}
          itemNote={lookupNote(items, t.form.itemLookupFailed)}
          isSaving={create.isSaving}
          onChange={setDraft}
          onSubmit={requestSubmit}
          onReset={() => {
            setDraft(EMPTY_DRAFT);
            setTriggers(EMPTY_TRIGGERS);
            setErrors({});
            create.reset();
          }}
        />
      </section>

      <section className="pane" aria-label={t.panes.list}>
        <h2>{t.panes.list}</h2>
        <SaveErrorBanner error={cancel.error} />
        {orders.isError ? (
          <LoadErrorBanner
            error={orders.error}
            onRetry={() => {
              void orders.refetch();
            }}
          />
        ) : orders.isPending ? (
          <Skeleton variant="rect" height="10rem" />
        ) : (
          <>
            <div className="wide-table">
              <Table
                columns={listColumns}
                rows={rows}
                getRowId={(row) => String(row.maintenanceOrderId)}
                density="compact"
                empty={
                  <EmptyState size="sm" live title={t.list.emptyTitle} description={t.list.empty} />
                }
              />
            </div>
            <PageNav
              view={pageView}
              onChange={(nextPage) => {
                const params = new URLSearchParams();

                if (statusFilter !== '') params.set('status', statusFilter);
                if (nextPage > 1) params.set('page', String(nextPage));
                setSearchParams(params);
              }}
            />
          </>
        )}
        <p className="pane-lead">{t.list.cancelLockedStatus}</p>
      </section>

      {/* 발행 확인 — 무엇이 하나로 묶이는지 되읽어 준다. */}
      <Dialog
        open={isConfirming}
        onClose={() => {
          setConfirming(false);
        }}
        title={t.confirm.title}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setConfirming(false);
              }}
              disabled={create.isSaving}
            >
              {t.confirm.cancel}
            </Button>
            <Button
              onClick={() => {
                create.write(toCreateBody(draft, triggers));
              }}
              disabled={create.isSaving}
            >
              {t.confirm.submit}
            </Button>
          </>
        }
      >
        <p className="dialog-lead">{t.confirm.lead}</p>
        <p className="dialog-lead">
          <strong>
            {[
              derivedTypeLabel(triggers),
              t.confirm.triggerCount(triggers.length),
              t.confirm.itemCount(draft.itemIds.length),
              draft.plannedDate,
            ]
              .filter((part) => part !== '')
              .join(' · ')}
          </strong>
        </p>
      </Dialog>

      {/*
       * 취소 확인 — **상세를 불러야 잠금 토큰이 선다.** 그래서 조회가 끝날 때까지 진행을 잠근다:
       * 잠그지 않으면 눌러도 요청이 나가지 않고 「최신 정보를 불러오는 중입니다」만 뜬다.
       */}
      <Dialog
        open={cancelTarget !== null}
        onClose={() => {
          setCancelTarget(null);
        }}
        title={t.list.cancelConfirmTitle}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setCancelTarget(null);
              }}
              disabled={cancel.isSaving}
            >
              {t.confirm.cancel}
            </Button>
            <Button
              onClick={() => {
                cancel.write(undefined);
              }}
              disabled={cancel.isSaving || cancelDetail.isPending}
            >
              {t.confirm.submit}
            </Button>
          </>
        }
      >
        <p className="dialog-lead">{t.list.cancelConfirm}</p>
      </Dialog>
    </>
  );
};
