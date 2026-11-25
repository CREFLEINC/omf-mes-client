import {
  AlertBanner,
  Button,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  Skeleton,
  Switch,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { useClientPage } from '../../patterns/client-page';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { hasChangedFilters } from '../../patterns/filter-more';
import { InfoTip } from '../../patterns/info-tip';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { SaveErrorBanner } from '../../patterns/master';
import { PageNav } from '../../patterns/page-nav';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { DiscardDialog, LeaveGuard } from '../routing/leave-guard';
import {
  addRecipients,
  hasInactiveRecipient,
  isApproverEvent,
  lacksRecipients,
  noPhoneCount,
  removeRecipient,
  sameDraft,
  toDraft,
  toReplaceBody,
} from './draft';
import {
  alarmRecipientKeys,
  useDepartments,
  useEvents,
  useReplaceSetting,
  useSettingDetail,
  useSettingSummary,
} from './queries';
import { RecipientPicker } from './recipient-picker';
import { SelectField } from './select-field';
import type { NotificationEvent, SettingDraft, SettingSummaryItem } from './types';

const t = messages.alarmRecipientSettings;
const leave = messages.common.unsavedLeave;
const w = t.workspace;
const ZALO_CONNECTION_PATH = '/notification/zalo-connection';

/** 아직 한 번도 저장하지 않은 행의 요약 — 서버의 미설정 기본값과 같다(끔·끔·0). */
const EMPTY_SUMMARY = { enabled: false, zaloEnabled: false, recipientCount: 0, noPhoneCount: 0 };

const eventLabel = (event: NotificationEvent | undefined, code: string): string =>
  event === undefined || event.eventName.trim() === '' ? code : event.eventName;

const onOffChip = (on: boolean) => (
  <Chip size="sm" status={on ? 'success' : 'idle'}>
    {on ? t.values.on : t.values.off}
  </Chip>
);

const parseId = (value: string | null): number | null =>
  value !== null && /^[1-9][0-9]*$/.test(value) ? Number(value) : null;

/** 이동할 자리 — 저장하지 않은 변경이 있으면 확인 뒤에 간다. */
interface Move {
  department: string;
  event: string | null;
}

/**
 * W-CO-11 알림 수신자 설정 — 부서 × 이벤트(001 재설계, 결정 #19).
 *
 * 부서와 이벤트는 URL(`?department=&event=`)이 든다. 알림센터가 정본이고 Zalo 는 부가 전달이다.
 */
export const AlarmRecipientSettingsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const zaloNoteId = useId();
  const enabledId = useId();
  const zaloId = useId();
  const { session } = useSession();
  /* W-CO-12 권한이 있을 때만 연결 설정으로 가는 길을 단다 — 사이드바와 같은 판정이다. */
  const canOpenConnection = toWebAccess(session?.permissions).allows(ZALO_CONNECTION_PATH);

  const departments = useDepartments();
  const events = useEvents();
  const departmentId = parseId(searchParams.get('department'));
  const eventParam = searchParams.get('event');
  /* 고른 이벤트를 다시 눌러 푼 상태는 빈 `event` 로 둔다 — 그때는 첫 이벤트로 되돌리지 않는다. */
  const isEventCleared = eventParam === '';
  const selectedCode = isEventCleared
    ? null
    : events.data?.some((event) => event.eventCode === eventParam) === true
      ? eventParam
      : (events.data?.[0]?.eventCode ?? null);
  const selectedEvent = events.data?.find((event) => event.eventCode === selectedCode);
  const approver = isApproverEvent(selectedEvent);

  const summary = useSettingSummary(departmentId);
  const detail = useSettingDetail(departmentId, departmentId === null ? null : selectedCode);

  const [draft, setDraft] = useState<SettingDraft | null>(null);
  const [baseline, setBaseline] = useState<SettingDraft | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<Move | null>(null);

  /*
   * 처음 들어오면 로그인한 계정의 부서를 미리 골라 둔다(사용자 지시 2026-11-24). 한 번만 한다 — [초기화]로
   * 비운 뒤에는 다시 채우지 않는다. 계정에 부서가 없거나 목록에 없으면 종전처럼 비워 둔다.
   */
  const accountDepartmentId = session?.departmentId;
  /* 처음 값 — 목록에 있는 계정 부서, 없으면 고르지 않은 상태. [초기화]는 여기로 돌아간다. */
  const defaultDepartmentId =
    accountDepartmentId !== undefined &&
    departments.data?.items.some((item) => item.departmentId === accountDepartmentId) === true
      ? accountDepartmentId
      : null;
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || departments.data === undefined) return;
    autoPicked.current = true;
    if (departmentId !== null || accountDepartmentId === undefined) return;
    if (!departments.data.items.some((item) => item.departmentId === accountDepartmentId)) return;
    setSearchParams({ department: String(accountDepartmentId) }, { replace: true });
  }, [accountDepartmentId, departmentId, departments.data, setSearchParams]);

  /* 부서를 고른 뒤 이벤트가 URL 에 없으면 첫 이벤트를 적어 둔다 — 새로고침해도 같은 행이 열린다. */
  useEffect(() => {
    if (departmentId === null || selectedCode === null || eventParam === selectedCode) return;
    setSearchParams({ department: String(departmentId), event: selectedCode }, { replace: true });
  }, [departmentId, eventParam, selectedCode, setSearchParams]);

  const seed = (next: SettingDraft): void => {
    setDraft(next);
    setBaseline(next);
    setInlineError(null);
  };

  useEffect(() => {
    if (detail.data === undefined) return;
    seed(toDraft(detail.data));
  }, [detail.data]);

  const replace = useReplaceSetting(departmentId, selectedCode, (saved) => {
    queryClient.setQueryData(alarmRecipientKeys.detail(departmentId, selectedCode), saved);
    seed(toDraft(saved));
    toast.show({ variant: 'success', description: t.state.saved });
  });

  const isDirty = draft !== null && baseline !== null && !sameDraft(draft, baseline);

  const go = (move: Move): void => {
    setInlineError(null);
    replace.reset();
    /* 고르기를 풀면 고치던 내용은 버린다 — 남겨 두면 다음 이벤트를 누를 때 버릴지 또 묻는다. */
    if (move.event === '') setDraft(baseline);
    /* 고른 부서가 없는 자리(계정 부서가 없을 때의 처음 값) — 처음 주소로(#358). */
    if (move.department === '') setSearchParams({});
    else
      setSearchParams(
        move.event === null ? { department: move.department } : { ...move, event: move.event },
      );
  };

  const requestMove = (move: Move): void => {
    if (isDirty) setPendingMove(move);
    else go(move);
  };

  const change = (next: SettingDraft): void => {
    setDraft(next);
    setInlineError(null);
    replace.reset();
  };

  const save = (): void => {
    if (draft === null) return;
    if (!approver && hasInactiveRecipient(draft)) {
      setInlineError(t.errors.inactiveRecipient);
      return;
    }
    replace.write(toReplaceBody(draft, approver));
  };

  const reload = (): void => {
    replace.reset();
    void detail.refetch().then((result) => {
      if (result.data !== undefined) seed(toDraft(result.data));
    });
  };

  const summaries = new Map(summary.data?.items.map((item) => [item.eventCode, item]));
  const summaryOf = (eventCode: string): Omit<SettingSummaryItem, 'eventCode'> =>
    summaries.get(eventCode) ?? EMPTY_SUMMARY;

  const eventColumns: Column<NotificationEvent>[] = [
    {
      key: 'event',
      /* 이름 열도 다른 열처럼 가운데 · 보통 굵기(검사 조회·판정 목록과 같다 · app.css `.notify-list-centered`). */
      header: t.columns.event,
      render: (event) => (
        /* 링크·단추처럼 보이지 않는다 — 줄 아무 곳이나 눌러 고른다. 고른 줄은 기존 강조(인계작업 알림 설정과 같다). */
        <button
          type="button"
          className="users-roles-row-pick handover-type-button"
          aria-current={event.eventCode === selectedCode ? 'true' : undefined}
          onClick={() => {
            if (departmentId === null) return;
            requestMove({
              department: String(departmentId),
              event: event.eventCode === selectedCode ? '' : event.eventCode,
            });
          }}
        >
          {eventLabel(event, event.eventCode)}
        </button>
      ),
    },
    {
      key: 'enabled',
      header: t.columns.enabled,
      render: (event) => onOffChip(summaryOf(event.eventCode).enabled),
    },
    {
      key: 'zalo',
      header: t.columns.zalo,
      render: (event) => onOffChip(summaryOf(event.eventCode).zaloEnabled),
    },
    {
      key: 'recipients',
      header: t.columns.recipients,
      render: (event) => {
        if (isApproverEvent(event)) return t.values.approver;
        const item = summaryOf(event.eventCode);
        return (
          <span className="handover-recipient-count">
            {t.values.recipientCount(item.recipientCount)}
            {item.noPhoneCount > 0 && (
              <Chip size="sm" status="warning">{`⚠${String(item.noPhoneCount)}`}</Chip>
            )}
          </span>
        );
      },
    },
  ];

  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다(단말 관리와 같다 · #358). */
  const orderedColumns = useColumnOrder(
    'omf-mes:alarm-recipient-settings:columns:order',
    eventColumns,
  );
  const resizable = useColumnWidths('omf-mes:alarm-recipient-settings:columns', orderedColumns);
  const fit = useFitColumns(resizable.columns);
  /* 이벤트는 한 번에 다 받는 작은 목록이라 화면 안에서 쪽을 나눈다. */
  const eventPage = useClientPage(departmentId === null ? [] : (events.data ?? []));

  const departmentOptions =
    departments.data?.items.map((item) => ({
      value: String(item.departmentId),
      label: `${item.departmentCode} · ${item.departmentName}`,
    })) ?? [];

  const loadError = (error: unknown, onRetry: () => void) => (
    <LoadErrorAlert error={error} onRetry={onRetry} />
  );

  /* 연결이 없어도 Switch 는 켤 수 있다 — 지금은 Zalo 가 나가지 않는다는 사실만 밝힌다. */
  const zaloNotActive = summary.data !== undefined && summary.data.zaloStatus !== 'ACTIVE';

  const settingBody = () => {
    if (detail.isError) return loadError(detail.error, () => void detail.refetch());
    if (detail.isPending || draft === null) return <Skeleton variant="rect" height="14rem" />;

    const missingPhones = noPhoneCount(draft);

    return (
      <>
        {replace.error?.kind === 'conflict' ? (
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
          <SaveErrorBanner error={replace.error} />
        )}
        {inlineError !== null && (
          <div className="banner-slot">
            <AlertBanner variant="error">{inlineError}</AlertBanner>
          </div>
        )}

        {/* 발송 설정(알림 사용 · Zalo 발송) → 연결 상태(미연결 칩) → 연결 설정(테두리 단추). 스위치는 줄 오른쪽 끝에 맞춘다. */}
        <div className="alarm-switches notify-switches">
          <div className="notify-switch-row">
            <label className="notify-switch-label" htmlFor={enabledId}>
              {t.fields.enabled}
            </label>
            <Switch
              id={enabledId}
              checked={draft.enabled}
              onChange={(event) => change({ ...draft, enabled: event.target.checked })}
            />
          </div>
          <div className="notify-switch-row">
            <span className="notify-switch-label">
              <label htmlFor={zaloId}>{t.fields.zalo}</label>
              {/* 요금 · 일일 한도는 ⓘ 로(스위치 아래 문장은 걷었다). */}
              <InfoTip text={t.state.zaloQuota} />
              {zaloNotActive && (
                <Chip size="sm" status="warning">
                  {t.values.notConnected}
                </Chip>
              )}
            </span>
            <Switch
              id={zaloId}
              checked={draft.zaloEnabled}
              disabled={!draft.enabled}
              aria-describedby={draft.enabled ? undefined : zaloNoteId}
              onChange={(event) => change({ ...draft, zaloEnabled: event.target.checked })}
            />
          </div>
          {/* 잠긴 사유는 잠겼을 때만 Switch 아래에 둔다. */}
          {!draft.enabled && (
            <span id={zaloNoteId} className="field-note">
              {t.state.zaloNeedsEnabled}
            </span>
          )}
          {/* Zalo 미연결 — 왼쪽 안내 라벨(정보 표식 + 파란 바탕 한 줄) · 오른쪽 끝 [Zalo 연결 설정](좁으면 다음 줄로). */}
          {zaloNotActive && (
            <div className="notify-zalo-connect">
              {/* 단추는 안내 라벨 안 오른쪽 끝(사용자 지시 2026-11-25). */}
              <div className="iqc-inspection-action-note" data-tone="info">
                <Icon name="info" size={16} aria-hidden />
                <span className="notify-zalo-connect-text">{t.state.zaloNotActive}</span>
                {canOpenConnection && (
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => void navigate(ZALO_CONNECTION_PATH)}
                  >
                    {t.actions.openConnection}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {approver ? (
          <p className="alarm-approver-notice">{t.state.approverNotice}</p>
        ) : (
          <div className="alarm-recipients">
            <div className="alarm-recipients-heading">
              <h3>{t.fields.recipients(draft.recipients.length)}</h3>
              <Button variant="outlined" size="sm" onClick={() => setPickerOpen(true)}>
                {`+ ${t.actions.add}`}
              </Button>
            </div>
            {draft.recipients.length === 0 ? (
              /* 수신자 0명 — 문구 하나를 라벨로(사용자 지시 2026-11-25). 알림이 켜져 있으면 노란(경고), 아니면 파란 라벨. */
              <p
                className="iqc-inspection-action-note alarm-no-recipients"
                data-tone={lacksRecipients(draft, approver) ? 'warning' : 'info'}
              >
                <Icon
                  name={lacksRecipients(draft, approver) ? 'warning' : 'info'}
                  size={16}
                  aria-hidden
                />
                {t.state.noRecipients}
              </p>
            ) : (
              <ul className="alarm-recipient-list" aria-label={t.columns.recipients}>
                {draft.recipients.map((recipient) => (
                  <li key={recipient.appUserId}>
                    <span>
                      {`${recipient.userName} (${recipient.departmentName ?? t.values.noDepartment})`}
                    </span>
                    {!recipient.hasPhone && (
                      <Chip size="sm" status="warning">{`📵 ${t.values.noPhone}`}</Chip>
                    )}
                    {!recipient.active && (
                      <Chip size="sm" status="error">
                        {t.values.inactive}
                      </Chip>
                    )}
                    <IconButton
                      icon="delete"
                      size="sm"
                      aria-label={`${recipient.userName} ${t.actions.remove}`}
                      onClick={() => change(removeRecipient(draft, recipient.appUserId))}
                    />
                  </li>
                ))}
              </ul>
            )}
            {missingPhones > 0 && (
              <AlertBanner variant="info">{t.state.noPhoneNotice(missingPhones)}</AlertBanner>
            )}
          </div>
        )}

        <div className="form-actions">
          <Button
            variant="outlined"
            disabled={!isDirty}
            onClick={() => {
              if (baseline !== null) change(baseline);
            }}
          >
            {t.actions.revert}
          </Button>
          <Button disabled={!isDirty || replace.isSaving} loading={replace.isSaving} onClick={save}>
            {t.actions.save}
          </Button>
        </div>

        <RecipientPicker
          open={pickerOpen}
          existingIds={new Set(draft.recipients.map((recipient) => recipient.appUserId))}
          onClose={() => setPickerOpen(false)}
          onAdd={(picked) => {
            change(addRecipients(draft, picked));
            setPickerOpen(false);
          }}
        />
      </>
    );
  };

  const eventList = () => {
    if (departmentId === null) return <EmptyState size="sm" title={t.state.selectDepartment} />;
    if (events.isError || summary.isError) {
      return loadError(events.error ?? summary.error, () => {
        void events.refetch();
        void summary.refetch();
      });
    }
    if (events.isPending || summary.isPending) return <Skeleton variant="rect" height="12rem" />;

    return (
      <>
        {/* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 이벤트 단추로 넘긴다(단말 관리와 같다). */}
        <div
          ref={fit.ref}
          className="inspection-queue-table notify-list-table notify-list-centered"
          style={resizable.style}
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest('button, a, input, select, textarea') !== null) return;
            target.closest('tbody tr')?.querySelector<HTMLButtonElement>('td button')?.click();
          }}
        >
          <Table
            columns={fit.columns}
            rows={eventPage.rows}
            getRowId={(event) => event.eventCode}
            density="compact"
            aria-label={t.panes.events}
            empty={<EmptyState size="sm" title={t.state.noEvents} />}
          />
        </div>
        <PageNav {...eventPage.nav} buttonSize="md" />
      </>
    );
  };

  const settingPane = () => {
    if (departmentId === null || selectedCode === null) {
      return (
        <EmptyState
          size="sm"
          className="users-roles-pick-empty"
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="notifications" size={20} />
            </span>
          }
          title={departmentId === null || isEventCleared ? w.selectEventTitle : t.state.noEvents}
          description={w.selectEvent}
        />
      );
    }

    return (
      <>
        <div className="notify-detail-head">
          <h2 className="pane-title">{t.panes.setting(eventLabel(selectedEvent, selectedCode))}</h2>
          {/* 고친 값이 저장값과 다르면 알린다 — 목록의 ON/OFF · 명 수는 저장값이다. */}
          {isDirty && (
            <Chip size="sm" status="warning">
              {t.state.unsaved}
            </Chip>
          )}
        </div>
        {settingBody()}
      </>
    );
  };

  /* 위 조회 상자 — 부서 선택 · [조회] · [초기화] 한 줄(다른 화면과 같은 자리 · 사용자 지시 2026-11-25). */
  const listSearch = (
    <div className="filter-bar notify-list-search">
      {departments.isError ? (
        loadError(departments.error, () => void departments.refetch())
      ) : departments.data !== undefined && departments.data.items.length === 0 ? (
        <EmptyState size="sm" title={t.state.noDepartments} />
      ) : (
        <SelectField
          required
          label={t.fields.department}
          options={departmentOptions}
          value={departmentId === null ? '' : String(departmentId)}
          placeholder={t.fields.departmentPlaceholder}
          disabled={departments.isPending}
          note={departments.data?.truncated === true ? t.state.departmentsTruncated : undefined}
          onChange={(value) => {
            if (value === String(departmentId)) return;
            requestMove({ department: value, event: selectedCode });
          }}
        />
      )}
      {/* 부서는 고르는 즉시 적용한다. [조회]는 그 부서의 목록을 다시 부르고, [초기화]는 처음 부서(계정 부서)로 —
          고른 부서가 처음 값과 다를 때만 보인다(다른 화면의 hasChangedFilters 규칙 · #358). */}
      <div className="filter-actions field-cell-unlabeled">
        <Button
          onClick={() => {
            void departments.refetch();
            if (departmentId === null) return;
            void events.refetch();
            void summary.refetch();
          }}
        >
          {w.apply}
        </Button>
        {departments.data !== undefined &&
          hasChangedFilters({ department: defaultDepartmentId }, { department: departmentId }) && (
            <Button
              variant="outlined"
              onClick={() => {
                requestMove({
                  department: defaultDepartmentId === null ? '' : String(defaultDepartmentId),
                  event: null,
                });
              }}
            >
              {w.clear}
            </Button>
          )}
      </div>
    </div>
  );

  return (
    <>
      {/* 머리글(경로 · 화면 이름)은 두지 않는다 — 사이드바가 위치를 말한다(단말 관리와 같은 틀 · #358). */}
      <ListDetailWorkspace
        storageKey="omf-mes:alarm-recipient-settings"
        filter={{ label: messages.common.paneList.filter, content: listSearch }}
        list={{
          label: w.list,
          title: w.list,
          count: departmentId === null ? undefined : events.data?.length,
          content: eventList(),
        }}
        detail={{
          label:
            departmentId === null || selectedCode === null
              ? w.selectEventTitle
              : t.panes.setting(eventLabel(selectedEvent, selectedCode)),
          content: settingPane(),
        }}
      />

      {/* 저장하지 않은 변경을 두고 다른 화면으로(사이드바 · 뒤로가기) 갈 때 묻는다(#358). */}
      <LeaveGuard
        when={isDirty}
        discardTitle={leave.title}
        discardBody={leave.body}
        stayLabel={leave.keep}
        leaveLabel={leave.confirm}
        showCloseButton={false}
        size="sm"
      />

      {/* 화면 안 이동(다른 이벤트 · 부서 등)의 확인도 다른 화면으로 갈 때와 같은 창 · 문구(#358). */}
      {pendingMove !== null && (
        <DiscardDialog
          title={leave.title}
          body={leave.body}
          stayLabel={leave.keep}
          leaveLabel={leave.confirm}
          showCloseButton={false}
          size="sm"
          onStay={() => setPendingMove(null)}
          onLeave={() => {
            go(pendingMove);
            setPendingMove(null);
          }}
        />
      )}
    </>
  );
};
