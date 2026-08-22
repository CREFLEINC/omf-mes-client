import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { CalendarFormDialog } from './calendar-form-dialog';
import { CalendarListPane } from './calendar-list-pane';
import { CALENDAR_FORM_FIELDS, validateCalendar } from './calendar-validation';
import { defaultCalendarFilters } from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { applicationNote, deactivateAvailability } from './retire-actions';
import { RetireConfirmDialog } from './retire-confirm-dialog';
import { emptyFormValues, formValuesFrom, toCalendarCreate, toCalendarUpdate } from './mappers';
import {
  calendarDetailPath,
  calendarKeys,
  isTruncated,
  useCalendarDetail,
  useCalendarList,
} from './queries';
import type { CalendarFilters, CalendarFormValues, WorkCalendar } from './types';

const t = messages.workCalendar;

const NO_ITEMS: never[] = [];

/**
 * 창이 무엇을 다루는지. 닫혀 있으면 `null`.
 *
 * ⭐ **「수정인데 대상이 없다」를 타입으로 없앤다** — 한 모양으로 두면 그 있을 수 없는 상태를
 * 부르는 자리마다 닿지 않는 기본값으로 막게 되고, 그 값은 틀려도 아무도 모른다.
 */
type DialogState = { mode: 'create' } | { mode: 'edit'; workCalendarId: number };

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
export const WorkCalendarScreen = () => {
  const { client } = useApiClient();
  const toast = useToast();
  const [filters, setFilters] = useState<CalendarFilters>(defaultCalendarFilters);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [values, setValues] = useState<CalendarFormValues>(() => emptyFormValues());
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  /** 확인 창이 떠 있는가 */
  const [retiring, setRetiring] = useState(false);

  const calendars = useCalendarList(filters);

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

      <CalendarListPane
        items={items}
        isLoading={calendars.isLoading}
        appliedFilters={filters}
        onApplyFilters={setFilters}
        onAdd={openCreate}
        onEdit={openEdit}
        loadError={
          calendars.isError ? (
            <LoadErrorBanner
              error={toApiError(calendars.error)}
              onRetry={() => void calendars.refetch()}
            />
          ) : null
        }
      />

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
