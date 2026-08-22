import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { CalendarFormDialog } from './calendar-form-dialog';
import { CalendarListPane } from './calendar-list-pane';
import { CALENDAR_FORM_FIELDS, validateCalendar } from './calendar-validation';
import { defaultCalendarFilters } from './filters';
import { ApplicationFormDialog } from './application-form-dialog';
import { ApplicationPane } from './application-pane';
import {
  TARGET_TYPES,
  unassignedPlantCount,
  type WorkCalendarApplication,
} from './application-targets';
import { BulkFormDialog } from './bulk-form-dialog';
import { expandDates } from './bulk-days';
import { validateBulkRange } from './bulk-validation';
import { DayFormDialog } from './day-form-dialog';
import { DAY_FORM_FIELDS, validateDay } from './day-validation';
import { byDate, type WorkCalendarDay } from './day-status';
import { LoadErrorBanner } from './load-error-banner';
import { MonthGridPane } from './month-grid-pane';
import { monthRange, type YearMonth } from './month-grid';
import { applicationNote, deactivateAvailability } from './retire-actions';
import { RetireConfirmDialog } from './retire-confirm-dialog';
import {
  dayFormValuesFrom,
  emptyFormValues,
  formValuesFrom,
  toCalendarCreate,
  toCalendarUpdate,
  toDayUpdate,
} from './mappers';
import {
  applicationKeys,
  calendarDayKeys,
  calendarDetailPath,
  calendarKeys,
  isTruncated,
  useCalendarApplications,
  useCalendarDays,
  useCalendarDetail,
  useCalendarList,
  useEquipmentGroupTargets,
  usePlantApplications,
  usePlantTargets,
} from './queries';
import type {
  BulkFormValues,
  CalendarFilters,
  CalendarFormValues,
  DayFormValues,
  WorkCalendar,
} from './types';

const t = messages.workCalendar;

const NO_ITEMS: never[] = [];

type WorkCalendarDayUpdateResult = components['schemas']['WorkCalendarDayUpdateResult'];

/**
 * 창이 무엇을 다루는지. 닫혀 있으면 `null`.
 *
 * ⭐ **「수정인데 대상이 없다」를 타입으로 없앤다** — 한 모양으로 두면 그 있을 수 없는 상태를
 * 부르는 자리마다 닿지 않는 기본값으로 막게 되고, 그 값은 틀려도 아무도 모른다.
 */
type DialogState = { mode: 'create' } | { mode: 'edit'; workCalendarId: number };

/**
 * 일자 덮어쓰기.
 *
 * ⭐ **「이 날 적용」·「요일 일괄」·「기간 일괄」이 모두 이 경로를 쓴다**(계약). 규칙이 아니라
 * **날짜 목록**을 보내므로, 부르는 쪽이 바뀔 날을 미리 알고 확인까지 받은 뒤 부를 수 있다.
 *
 * ⛔ **낙관적 잠금이 없다** — 계약이 `If-Match` 를 요구하지 않는다. 보낸 날짜만 덮어쓰고
 * 보내지 않은 날은 그대로 두므로, 두 사람이 다른 날을 고치면 서로를 밀어내지 않는다.
 *
 * ⛔ **멱등 키 수명은 기본값(`per-attempt`)이 맞다.** 이 쓰기는 **덮어쓰기**라 같은 값을 두 번
 * 보내도 결과가 같다 — 차감·전이처럼 「두 번 실행되면 안 되는」 쓰기가 아니다.
 */
const useDayWrite = (workCalendarId: number | null, onDone: (appliedCount: number) => void) => {
  const { client } = useApiClient();

  return useMasterWrite<WorkCalendarDay[], WorkCalendarDayUpdateResult>({
    request: (days, headers) =>
      client.PUT('/mdm/work-calendars/{workCalendarId}/days', {
        params: {
          path: { workCalendarId: workCalendarId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: { days },
      }),
    etagPath: null,
    invalidateKeys: [calendarDayKeys.all],
    knownFields: DAY_FORM_FIELDS,
    onSuccess: (result) => onDone(result.appliedCount),
  });
};

/**
 * 적용 지정·해제.
 *
 * ⭐ **공장 기본을 바꾸는 것도 한 번의 부름이다** — 옛 지정 해제와 새 지정을 서버가 한
 * 트랜잭션으로 처리한다(계약). 화면이 두 번 부르지 않는다.
 *
 * ⭐ **해제는 `workCalendarId` 를 비워 보내는 것**이다. 지우는 것이 아니라 그 대상이
 * 상위 층을 따르게 되는 것이라, 계약도 같은 경로에 두었다.
 *
 * ⛔ **멱등 키 수명은 기본값(`per-attempt`)이 맞다** — 이 쓰기는 「이 대상은 이 캘린더를
 * 따른다」를 **정하는** 것이라 두 번 보내도 결과가 같다.
 */
const useApplicationWrite = (onDone: () => void) => {
  const { client } = useApiClient();

  return useMasterWrite<
    { targetTypeCode: string; targetId: number; workCalendarId?: number },
    unknown
  >({
    request: (variables, headers) =>
      client.PUT('/mdm/work-calendar-applications', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: {
          targetTypeCode: variables.targetTypeCode as 'PLANT' | 'EQUIPMENT_GROUP',
          targetId: variables.targetId,
          ...(variables.workCalendarId === undefined
            ? {}
            : { workCalendarId: variables.workCalendarId }),
        },
      }),
    etagPath: null,
    invalidateKeys: [applicationKeys.all],
    knownFields: ['targetId'],
    onSuccess: onDone,
  });
};

/**
 * 사용 중지 쓰기.
 *
 * ⛔ **멱등 키 수명은 기본값(`per-attempt`)이 맞다** — 되돌릴 수 없는 쓰기인데도 그렇다.
 * 부품이 「**본문이 빈 액션**에 `until-applied` 를 쓰지 말라」고 정했다: 보낼 값이 없으면
 * 「값이 바뀌면 새 키」가 성립하지 않아, 다른 화면에서 원인을 고치고 돌아와 다시 눌러도
 * 같은 키가 나가 **영영 성공할 수 없다.**
 */
const useDeactivateWrite = (workCalendarId: number | null, onDone: () => void) => {
  const { client } = useApiClient();

  return useMasterWrite<void, WorkCalendar>({
    request: (_variables, headers) =>
      client.POST('/mdm/work-calendars/{workCalendarId}:deactivate', {
        params: {
          path: { workCalendarId: workCalendarId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    /* 잠금 토큰은 상세 경로에 보관돼 있다 — 요청 경로(`...:deactivate`)로 꺼내면 늘 비어 있다. */
    etagPath: workCalendarId === null ? null : calendarDetailPath(workCalendarId),
    invalidateKeys: [calendarKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: onDone,
  });
};

/**
 * W-05-09 작업 캘린더 설정.
 *
 * ⭐ **캘린더 자체는 코드와 이름뿐이다** — 내용은 일자가 갖고, 누가 따르는지는 적용이 갖는다.
 * 이 슬라이스는 그 «껍데기»를 세운다.
 */
export interface WorkCalendarScreenProps {
  /**
   * 처음 보일 달. **인자로 받는다** — 화면이 시각을 직접 읽으면 시험이 날짜마다 다른 달을 열어
   * 답이 달라진다. 화면을 여는 자리에서는 기본값이 곧 이번 달이다.
   */
  initialMonth?: YearMonth;
}

/** 이번 달. ⛔ `toISOString()` 을 쓰지 않는다 — UTC 달력이라 한국 새해 아침에 지난해를 준다. */
const currentMonth = (): YearMonth => {
  const now = new Date();

  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

export const WorkCalendarScreen = ({
  initialMonth = currentMonth(),
}: WorkCalendarScreenProps = {}) => {
  const { client } = useApiClient();
  const toast = useToast();
  const [filters, setFilters] = useState<CalendarFilters>(defaultCalendarFilters);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [values, setValues] = useState<CalendarFormValues>(() => emptyFormValues());
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  /** 확인 창이 떠 있는가 */
  const [retiring, setRetiring] = useState(false);
  /** 지금 고른 캘린더. 일자 그리드가 이것을 그린다 */
  const [selected, setSelected] = useState<WorkCalendar | null>(null);
  const [yearMonth, setYearMonth] = useState<YearMonth>(initialMonth);
  /** 지금 고치는 날. 닫혀 있으면 `null` */
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [dayValues, setDayValues] = useState<DayFormValues>(() => dayFormValuesFrom(undefined));
  const [dayErrors, setDayErrors] = useState<Record<string, string>>({});
  /** 일괄 적용 창이 떠 있는가 */
  const [bulk, setBulk] = useState<BulkFormValues | null>(null);
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});
  /** 적용 대상 지정 창이 떠 있는가 */
  const [assigning, setAssigning] = useState(false);
  const [targetTypeCode, setTargetTypeCode] = useState<string>(TARGET_TYPES.plant);
  const [targetId, setTargetId] = useState('');

  const calendars = useCalendarList(filters);
  /* 계약이 기간을 반드시 요구한다 — 보이는 달의 처음과 끝을 그대로 싣는다. */
  const range = monthRange(yearMonth);
  const days = useCalendarDays(selected?.workCalendarId ?? null, range);
  const applications = useCalendarApplications(selected?.workCalendarId ?? null);
  /* ⭐ 「미지정 공장」은 이 캘린더가 아니라 **전체 공장 적용**으로 센다. */
  const plantApplications = usePlantApplications();
  const plantTargets = usePlantTargets();
  const equipmentGroupTargets = useEquipmentGroupTargets(
    assigning && targetTypeCode === TARGET_TYPES.equipmentGroup,
  );

  /* 창을 열 때만 상세를 조회한다 — 목록 응답에는 잠금 토큰도 코드 편집 가부도 없다. */
  const editingId = dialog?.mode === 'edit' ? dialog.workCalendarId : null;
  const detail = useCalendarDetail(editingId);

  const items = calendars.data?.items ?? NO_ITEMS;
  const listTruncated =
    calendars.data !== undefined && isTruncated(calendars.data.page, items.length);

  const isCreate = dialog?.mode === 'create';

  const write = useMasterWrite<CalendarFormValues, WorkCalendar>({
    request: (formValues, headers) =>
      isCreate
        ? // 등록에는 낙관적 잠금이 없다 — 계약이 If-Match를 요구하지 않는다.
          client.POST('/mdm/work-calendars', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toCalendarCreate(formValues),
          })
        : client.PUT('/mdm/work-calendars/{workCalendarId}', {
            params: {
              path: { workCalendarId: editingId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': headers['If-Match'] ?? '',
              },
            },
            body: toCalendarUpdate(formValues, detail.data?.editability.codeEditable ?? false),
          }),
    /* 잠금 토큰은 상세 경로에 보관돼 있다. 등록에는 낙관적 잠금이 없다. */
    etagPath: editingId === null ? null : calendarDetailPath(editingId),
    invalidateKeys: [calendarKeys.all],
    knownFields: CALENDAR_FORM_FIELDS,
    onSuccess: () => {
      setDialog(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const dayWrite = useDayWrite(selected?.workCalendarId ?? null, (appliedCount) => {
    setEditingDate(null);
    toast.show({ variant: 'success', description: t.dayForm.saved(appliedCount) });
  });

  /*
   * ⭐ **일괄도 같은 경로를 쓴다**(계약). 쓰기를 따로 두지 않고 같은 훅을 한 벌 더 만든다 —
   * 두 창이 서로의 오류·진행 상태를 물려받지 않게 하려는 것뿐이다.
   */
  const bulkWrite = useDayWrite(selected?.workCalendarId ?? null, (appliedCount) => {
    setBulk(null);
    toast.show({ variant: 'success', description: t.bulk.applied(appliedCount) });
  });

  const deactivateWrite = useDeactivateWrite(editingId, () => {
    /*
     * ⛔ **창도 함께 닫는다.** 중지된 캘린더는 목록에서 빠지므로(기본 조회가 유효한 것만
     * 내린다) 열린 폼을 남기면 사용자가 목록에 없는 것을 계속 고치게 된다.
     */
    setRetiring(false);
    setDialog(null);
    toast.show({ variant: 'success', description: messages.common.saved });
  });

  /**
   * **끝난 쓰기만 거둔다.** 나가는 중인 요청을 `reset()` 으로 끊으면 그 요청의 되먹임이
   * 통째로 사라져, 화면은 아무 일도 없었다고 믿고 서버는 이미 처리한 상태가 된다(client#96).
   *
   * ⚠ **jsdom 에서는 이 가드에 닿는 길이 없다** — 쓰기가 나가는 동안 「취소」가 잠기고 스크림은
   * 막혀 있다. **브라우저에서는 Escape 로 닿는다**: native `<dialog>` 의 `cancel` 은 잠글 수 없다.
   */
  const resetIfIdle = (target: { isSaving: boolean; reset: () => void }): void => {
    if (target.isSaving) return;

    target.reset();
  };

  /** 편집 중이던 것을 통째로 거둔다 — 인라인 오류와 저장 실패 배너 둘. */
  const resetEditing = (): void => {
    resetIfIdle(write);
    resetIfIdle(deactivateWrite);
  };

  const openCreate = (): void => {
    resetEditing();
    setLocalErrors({});
    setValues(emptyFormValues());
    setDialog({ mode: 'create' });
  };

  /**
   * 목록 행으로 폼을 채운다.
   *
   * ⭐ **고칠 값이 모두 화면에 보인다는 것이 이 선택의 근거다.** 목록은 캐시라 낡을 수 있고
   * 잠금 토큰은 상세에서 온 최신이라 충돌로 걸리지 않는데, 그래도 안전한 것은 사용자가 **본
   * 값을 저장**하기 때문이다 — 이 화면의 수정 본문은 전부 폼에 보이는 두 칸이다.
   */
  const openEdit = (calendar: WorkCalendar): void => {
    resetEditing();
    setLocalErrors({});
    setValues(formValuesFrom(calendar));
    setDialog({ mode: 'edit', workCalendarId: calendar.workCalendarId });
  };

  const closeDialog = (): void => {
    resetEditing();
    setRetiring(false);
    setDialog(null);
  };

  const changeValues = (patch: Partial<CalendarFormValues>): void => {
    setValues((current) => ({ ...current, ...patch }));

    /* 고치는 순간 그 칸의 오류는 낡은 말이 된다 — 서버가 준 것도 함께 거둔다. */
    for (const field of Object.keys(patch)) {
      setLocalErrors((current) => {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
      write.clearFieldError(field);
    }
  };

  const save = (): void => {
    const errors = validateCalendar(values);
    setLocalErrors(errors);

    if (Object.keys(errors).length > 0) return;

    write.write(values);
  };

  const calendar = detail.data?.workCalendar ?? null;
  const deactivate = deactivateAvailability(calendar);

  /** 그 날의 지금 설정. 없으면 「미설정」이라 빈 폼이 선다. */
  const openDay = (date: string): void => {
    resetIfIdle(dayWrite);
    setDayErrors({});
    setDayValues(dayFormValuesFrom(byDate(days.data?.items ?? NO_ITEMS).get(date)));
    setEditingDate(date);
  };

  const changeDayValues = (patch: Partial<DayFormValues>): void => {
    setDayValues((current) => ({ ...current, ...patch }));

    /* 고치는 순간 그 칸의 오류는 낡은 말이 된다 — 서버가 준 것도 함께 거둔다. */
    for (const field of Object.keys(patch)) {
      setDayErrors((current) => {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
      dayWrite.clearFieldError(field);
    }
  };

  const saveDay = (): void => {
    if (editingDate === null) return;

    const errors = validateDay(dayValues);
    setDayErrors(errors);

    if (Object.keys(errors).length > 0) return;

    /* ⭐ 「보낸 날짜만 덮어쓴다」 — 하루를 고칠 때는 그 하루만 담는다. */
    dayWrite.write([toDayUpdate(editingDate, dayValues)]);
  };

  /**
   * 지금 조건으로 바뀔 날짜. **여기서 센 목록을 그대로 보낸다** — 보인 수와 보내는 목록이
   * 갈리면 확인이 뜻을 잃는다.
   */
  const bulkDates = bulk === null ? [] : expandDates(bulk.from, bulk.to, bulk.weekdays);

  const openBulk = (): void => {
    resetIfIdle(bulkWrite);
    setBulkErrors({});
    /* 처음 값은 지금 보고 있는 달이다 — 달력에서 옮겨 온 맥락을 잃지 않는다. */
    setBulk({ ...range, weekdays: [], day: dayFormValuesFrom(undefined) });
  };

  const applyBulk = (): void => {
    if (bulk === null) return;

    const errors = { ...validateBulkRange(bulk), ...validateDay(bulk.day) };
    setBulkErrors(errors);

    if (Object.keys(errors).length > 0) return;
    if (bulkDates.length === 0) return;

    bulkWrite.write(bulkDates.map((date) => toDayUpdate(date, bulk.day)));
  };

  const applicationWrite = useApplicationWrite(() => {
    setAssigning(false);
    toast.show({ variant: 'success', description: t.applications.assigned });
  });

  const releaseWrite = useApplicationWrite(() => {
    toast.show({ variant: 'success', description: t.applications.released });
  });

  const targetOptions =
    targetTypeCode === TARGET_TYPES.plant ? plantTargets : equipmentGroupTargets;

  /* ⛔ 공장 목록을 아직 못 받았으면 0 이 아니라 「모른다」다 — 조용해지지 않는다(G-9). */
  const unassignedPlants = unassignedPlantCount(
    plantTargets.map((target) => target.value),
    plantApplications.data?.items ?? NO_ITEMS,
  );

  const codeLockReason =
    dialog?.mode === 'edit' && detail.data !== undefined
      ? codeLockMessage(detail.data.editability)
      : null;

  return (
    <div className="screen">
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {listTruncated && (
        <div className="banner-slot">
          <AlertBanner variant="warning">
            {t.listTruncated(items.length, calendars.data?.page.total ?? items.length)}
          </AlertBanner>
        </div>
      )}

      {/*
       * ⭐ **좌우가 아니라 위아래로 쌓는다.** 달력은 일곱 칸이 한 줄에 서야 하는데, 2단 배치의
       * 우 칸(약 670px)에서는 칸마다 91px밖에 못 가져 「부분 가동」 배지가 접힌다 —
       * 브라우저 실측으로 확인하고 바꾼 자리다. 목록은 고르는 자리라 폭이 남고, 달력은
       * 이 화면의 본론이라 폭이 필요하다.
       */}
      <div className="pane-stack">
        <CalendarListPane
          items={items}
          isLoading={calendars.isLoading}
          appliedFilters={filters}
          onApplyFilters={setFilters}
          onAdd={openCreate}
          onSelect={setSelected}
          selectedId={selected?.workCalendarId ?? null}
          loadError={
            calendars.isError ? (
              <LoadErrorBanner
                error={toApiError(calendars.error)}
                onRetry={() => void calendars.refetch()}
              />
            ) : null
          }
        />

        <MonthGridPane
          calendarName={selected === null ? null : selected.calendarName}
          onEditCalendar={() => {
            if (selected === null) return;

            openEdit(selected);
          }}
          yearMonth={yearMonth}
          onChangeMonth={setYearMonth}
          onPickDay={openDay}
          onBulkApply={openBulk}
          days={days.data?.items ?? NO_ITEMS}
          isLoading={days.isLoading}
          loadError={
            days.isError ? (
              <LoadErrorBanner error={toApiError(days.error)} onRetry={() => void days.refetch()} />
            ) : null
          }
        />

        <ApplicationPane
          calendarName={selected === null ? null : selected.calendarName}
          items={applications.data?.items ?? NO_ITEMS}
          isLoading={applications.isLoading}
          unassignedPlants={unassignedPlants}
          onAdd={() => {
            resetIfIdle(applicationWrite);
            setTargetTypeCode(TARGET_TYPES.plant);
            setTargetId('');
            setAssigning(true);
          }}
          onRelease={(application: WorkCalendarApplication) => {
            resetIfIdle(releaseWrite);
            /* ⭐ 해제는 `workCalendarId` 를 비워 보내는 것이다 — 같은 경로다. */
            releaseWrite.write({
              targetTypeCode: application.targetTypeCode,
              targetId: application.targetId,
            });
          }}
          loadError={
            applications.isError ? (
              <LoadErrorBanner
                error={toApiError(applications.error)}
                onRetry={() => void applications.refetch()}
              />
            ) : null
          }
        />
      </div>

      {dialog !== null && (
        <CalendarFormDialog
          mode={dialog.mode}
          values={values}
          onChange={changeValues}
          fieldErrors={{ ...write.fieldErrors, ...localErrors }}
          banner={
            /* ⭐ 「최신 불러오기」는 충돌에만 뜻이 있다 — 상세를 다시 읽어야 잠금 토큰이 새로 온다. */
            <SaveErrorBanner error={write.error} onReload={() => void detail.refetch()} />
          }
          codeLockReason={codeLockReason}
          applicationCount={detail.data?.applicationCount ?? null}
          isSaving={write.isSaving}
          deactivate={deactivate}
          onClose={closeDialog}
          onSave={save}
          onDeactivate={() => {
            resetIfIdle(deactivateWrite);
            setRetiring(true);
          }}
        />
      )}

      {editingDate !== null && (
        <DayFormDialog
          calendarDate={editingDate}
          values={dayValues}
          onChange={changeDayValues}
          fieldErrors={{ ...dayWrite.fieldErrors, ...dayErrors }}
          /* 「최신 불러오기」를 주지 않는다 — 이 쓰기에는 다시 읽어 풀릴 잠금 토큰이 없다(G-23). */
          banner={<SaveErrorBanner error={dayWrite.error} />}
          isSaving={dayWrite.isSaving}
          onClose={() => {
            resetIfIdle(dayWrite);
            setEditingDate(null);
          }}
          onSave={saveDay}
        />
      )}

      {assigning && selected !== null && (
        <ApplicationFormDialog
          targetTypeCode={targetTypeCode}
          targetId={targetId}
          onChangeType={(next) => {
            setTargetTypeCode(next);
            /* 유형이 바뀌면 앞서 고른 대상은 다른 표의 것이라 뜻을 잃는다 — 거둔다. */
            setTargetId('');
          }}
          onChangeTarget={setTargetId}
          options={targetOptions}
          fieldErrors={applicationWrite.fieldErrors}
          banner={<SaveErrorBanner error={applicationWrite.error} />}
          isSaving={applicationWrite.isSaving}
          onClose={() => {
            resetIfIdle(applicationWrite);
            setAssigning(false);
          }}
          onAssign={() => {
            if (targetId === '') return;

            applicationWrite.write({
              targetTypeCode,
              targetId: Number(targetId),
              workCalendarId: selected.workCalendarId,
            });
          }}
        />
      )}

      {bulk !== null && (
        <BulkFormDialog
          values={bulk}
          onChange={(patch) => {
            setBulk((current) => (current === null ? current : { ...current, ...patch }));

            for (const field of Object.keys(patch)) {
              setBulkErrors((current) => {
                if (!(field in current)) return current;
                const next = { ...current };
                delete next[field];
                return next;
              });
              bulkWrite.clearFieldError(field);
            }
          }}
          onChangeDay={(patch) => {
            setBulk((current) =>
              current === null ? current : { ...current, day: { ...current.day, ...patch } },
            );

            for (const field of Object.keys(patch)) {
              setBulkErrors((current) => {
                if (!(field in current)) return current;
                const next = { ...current };
                delete next[field];
                return next;
              });
              bulkWrite.clearFieldError(field);
            }
          }}
          fieldErrors={{ ...bulkWrite.fieldErrors, ...bulkErrors }}
          banner={<SaveErrorBanner error={bulkWrite.error} />}
          affectedCount={bulkDates.length}
          isSaving={bulkWrite.isSaving}
          onClose={() => {
            resetIfIdle(bulkWrite);
            setBulk(null);
          }}
          onApply={applyBulk}
        />
      )}

      {retiring && calendar !== null && (
        <RetireConfirmDialog
          targetNote={t.retire.target(`${calendar.calendarCode} · ${calendar.calendarName}`)}
          applicationNote={applicationNote(detail.data?.applicationCount ?? null)}
          isSaving={deactivateWrite.isSaving}
          banner={
            <SaveErrorBanner error={deactivateWrite.error} onReload={() => void detail.refetch()} />
          }
          onClose={() => setRetiring(false)}
          onConfirm={() => deactivateWrite.write(undefined)}
        />
      )}
    </div>
  );
};
