import {
  AlertBanner,
  Breadcrumb,
  Button,
  Chip,
  EmptyState,
  PageHeader,
  Radio,
  RadioGroup,
  Skeleton,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { useSession } from '../../patterns/session';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { LeaveGuard } from '../routing/leave-guard';
import { usePlants, useSaveWorkingDays, useWorkingDayPolicies, type DataScope } from './queries';
import {
  currentPolicy,
  nextMonday,
  offDays,
  previousWorkingDay,
  todayIn,
  toWorkingDays,
  dayOfWeek,
  type WeeklyWorkingDays,
} from './working-days';

type Plant = components['schemas']['Plant'];

const t = messages.plantWorkingDays;
const NO_SCOPES: readonly DataScope[] = [];

/** `YYYY-MM-DD` → `MM-DD`. */
const monthDay = (iso: string): string => iso.slice(5);
const weekdayOf = (iso: string): string => t.weekdays[dayOfWeek(iso)] ?? '';

interface Row {
  plant: Plant;
  today: string;
  saved: WeeklyWorkingDays;
  /** 오늘 적용되는 정책 행이 없다 — 서버가 주 5일제로 계산한다. */
  isDefault: boolean;
  /** 지금 적용 중인 행의 시작일. 행이 없으면 null. */
  since: string | null;
}

/**
 * W-CO-15 공장 근무일 설정(003 계획 기반 출고 요청 · US7, FR-033).
 *
 * 공장 목록 표에서 공장마다 주 5일제 · 주 6일제를 한 번에 고른다(검토 7 확정). 저장은 바뀐 공장만
 * 운영 정책 `WEEKLY_WORKING_DAYS` 의 「그날부터 적용」 행으로 남는다(R-10). 머리 · 안내 배너 · 저장 규칙은
 * W-CO-14 를 따른다.
 */
export const PlantWorkingDaysScreen = () => {
  const toast = useToast();
  const { session } = useSession();
  const plants = usePlants(session?.scopes ?? NO_SCOPES);
  const policies = useWorkingDayPolicies();
  /** 공장별로 고친 값. 저장한 값과 같으면 지운다. */
  const [edits, setEdits] = useState<ReadonlyMap<number, WeeklyWorkingDays>>(new Map());

  const save = useSaveWorkingDays(policies.data, () => {
    setEdits(new Map());
    toast.show({ variant: 'success', description: t.state.saved });
  });

  const rows: Row[] =
    plants.data?.map((plant) => {
      const today = todayIn(plant.timezoneCode);
      const policy = currentPolicy(policies.data?.items ?? [], plant.plantId, today);
      return {
        plant,
        today,
        saved: toWorkingDays(policy?.valueNumeric),
        isDefault: policy === undefined,
        since: policy?.effectiveFrom ?? null,
      };
    }) ?? [];

  const valueOf = (row: Row): WeeklyWorkingDays => edits.get(row.plant.plantId) ?? row.saved;
  /*
   * 고친 값이 지금 저장된 값과 다를 때만 「바뀜」이다 — 여러 공장 저장이 중간에 멈추면 앞 공장은 저장돼
   * 다시 받은 값과 같아지므로 바뀐 줄에서 빠진다.
   */
  const isChanged = (row: Row): boolean => {
    const edit = edits.get(row.plant.plantId);
    return edit !== undefined && edit !== row.saved;
  };
  const isDirty = rows.some(isChanged);

  const choose = (row: Row, days: WeeklyWorkingDays): void => {
    save.reset();
    setEdits((prev) => {
      const next = new Map(prev);
      if (days === row.saved) next.delete(row.plant.plantId);
      else next.set(row.plant.plantId, days);
      return next;
    });
  };

  const revert = (): void => {
    save.reset();
    setEdits(new Map());
  };

  /* 충돌(409) 뒤 — 고친 값을 버리고 남이 저장한 값을 다시 받는다. */
  const reload = (): void => {
    revert();
    void policies.refetch();
  };

  const exampleDate = nextMonday(rows[0]?.today ?? todayIn(undefined));

  const columns: Column<Row>[] = [
    {
      key: 'plant',
      header: t.columns.plant,
      render: (row) => {
        const dirty = isChanged(row);
        return (
          <span
            className={dirty ? 'plant-working-days-plant is-changed' : 'plant-working-days-plant'}
          >
            <strong>{row.plant.plantName}</strong>
            {row.isDefault && !dirty && (
              <Chip size="sm" status="idle">
                {t.tags.default}
              </Chip>
            )}
            {dirty && (
              <Chip size="sm" status="warning">
                {t.tags.changed}
              </Chip>
            )}
          </span>
        );
      },
    },
    {
      key: 'days',
      header: t.columns.days,
      render: (row) => (
        <RadioGroup
          name={`working-days-${String(row.plant.plantId)}`}
          orientation="horizontal"
          value={String(valueOf(row))}
          onChange={(value) => choose(row, value === '6' ? 6 : 5)}
          aria-label={t.groupLabel(row.plant.plantName)}
        >
          <Radio value="5">{t.options.five}</Radio>
          <Radio value="6">{t.options.six}</Radio>
        </RadioGroup>
      ),
    },
    {
      key: 'off',
      header: t.columns.off,
      render: (row) =>
        offDays(valueOf(row))
          .map((day) => t.weekdays[day])
          .join(', '),
    },
    {
      key: 'example',
      header: t.columns.example(monthDay(exampleDate), weekdayOf(exampleDate)),
      render: (row) => {
        const { date, skipped } = previousWorkingDay(exampleDate, valueOf(row));
        return t.values.example(
          monthDay(date),
          weekdayOf(date),
          [...skipped].reverse().map(weekdayOf).join(', '),
        );
      },
    },
    {
      key: 'lastChanged',
      header: t.columns.lastChanged,
      render: (row) =>
        row.since === null ? t.values.none : t.values.lastChanged(monthDay(row.since)),
    },
  ];

  const loadError = (error: unknown, onRetry: () => void) => (
    <LoadErrorAlert error={error} onRetry={onRetry} />
  );

  const body = () => {
    if (plants.isError) return loadError(plants.error, () => void plants.refetch());
    if (policies.isError) return loadError(policies.error, () => void policies.refetch());
    if (plants.isPending || policies.isPending) return <Skeleton variant="rect" height="12rem" />;
    if (rows.length === 0) return <EmptyState size="sm" title={t.state.noPlants} />;

    return (
      <>
        {save.error?.kind === 'conflict' ? (
          <div className="banner-slot">
            <AlertBanner
              variant="error"
              action={
                <Button variant="outlined" size="sm" onClick={reload}>
                  {t.actions.reload}
                </Button>
              }
            >
              {t.state.conflict}
            </AlertBanner>
          </div>
        ) : (
          <SaveErrorBanner error={save.error} />
        )}
        <Table
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.plant.plantId)}
          className="plant-working-days-table"
          aria-label={t.tableLabel}
        />
        <div className="form-actions">
          <Button variant="outlined" disabled={!isDirty || save.isSaving} onClick={revert}>
            {t.actions.revert}
          </Button>
          <Button
            disabled={!isDirty || save.isSaving}
            loading={save.isSaving}
            onClick={() =>
              save.write(
                rows.filter(isChanged).map((row) => ({
                  plantId: row.plant.plantId,
                  days: valueOf(row),
                  today: row.today,
                })),
              )
            }
          >
            {t.actions.save}
          </Button>
        </div>
      </>
    );
  };

  return (
    <>
      <LeaveGuard when={isDirty} discardTitle={t.discard.title} discardBody={t.discard.body} />
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <div className="banner-slot">
        <AlertBanner variant="info">{t.intro}</AlertBanner>
      </div>
      <section className="pane plant-working-days-pane" aria-label={t.tableLabel}>
        {body()}
      </section>
    </>
  );
};
