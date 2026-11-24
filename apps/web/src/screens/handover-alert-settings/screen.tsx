import {
  AlertBanner,
  Button,
  Chip,
  Dialog,
  EmptyState,
  Icon,
  SearchInput,
  Skeleton,
  Switch,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import {
  handoverTypeName,
  useHandoverAlertTypes,
  type HandoverAlertCode,
} from '../../patterns/handover-alert-types';
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
import { RecipientPicker } from '../alarm-recipient-settings/recipient-picker';
import { SelectField } from '../alarm-recipient-settings/select-field';
import {
  addRecipients,
  inactiveCount,
  lacksRecipients,
  noPhoneCount,
  removeRecipient,
  sameDraft,
  setEnabled,
  toDraft,
  toReplaceBody,
} from './draft';
import {
  handoverSettingKeys,
  usePlants,
  useReplaceSetting,
  useSettingDetail,
  useSettingSummary,
  type DataScope,
} from './queries';
import {
  MAX_RECIPIENTS,
  type HandoverAlertType,
  type SettingDraft,
  type SettingSummaryItem,
} from './types';

const t = messages.handoverAlertSettings;
const w = t.workspace;
const ZALO_CONNECTION_PATH = '/notification/zalo-connection';
const NO_SCOPES: readonly DataScope[] = [];

/** 행이 없는 종류의 요약 — 서버의 미설정 기본값과 같다(끔·끔·0, US2-1). */
const EMPTY_SUMMARY = {
  enabled: false,
  zaloEnabled: false,
  recipientCount: 0,
  noPhoneCount: 0,
  inactiveCount: 0,
};

const onOffChip = (on: boolean) => (
  <Chip size="sm" status={on ? 'success' : 'idle'}>
    {on ? t.values.on : t.values.off}
  </Chip>
);

const parseId = (value: string | null): number | null =>
  value !== null && /^[1-9][0-9]*$/.test(value) ? Number(value) : null;

const guideOf = (code: string): { when: string; where: string } | undefined =>
  code in t.types ? t.types[code as HandoverAlertCode] : undefined;

/** 이동할 자리 — 저장하지 않은 변경이 있으면 확인 뒤에 간다. */
interface Move {
  plant: string;
  type: string;
}

/**
 * W-CO-14 인계작업 알림 설정 — 공장 × 인계 작업 종류(피처 002, omf-all-around#190).
 *
 * W-CO-11 과 같은 2단(목록 + 상세)·저장 규칙이다. 공장과 종류는 URL(`?plant=&type=`)이 든다.
 * 처음에는 10종 모두 꺼져 있고(행 없음), 담당자는 최대 5명이다.
 */
export const HandoverAlertSettingsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const zaloNoteId = useId();
  const { session } = useSession();
  const canOpenConnection = toWebAccess(session?.permissions).allows(ZALO_CONNECTION_PATH);

  const plants = usePlants(session?.scopes ?? NO_SCOPES);
  const types = useHandoverAlertTypes();

  /* US2-6 — 고를 공장이 하나뿐이면 칸을 두지 않고 그 공장을 연다. 여럿이면 첫 공장부터. */
  const plantParam = parseId(searchParams.get('plant'));
  const plantId =
    plants.data?.some((plant) => plant.plantId === plantParam) === true
      ? plantParam
      : (plants.data?.[0]?.plantId ?? null);
  const typeParam = searchParams.get('type');
  const selectedCode =
    types.data?.some((type) => type.alertTypeCode === typeParam) === true
      ? typeParam
      : (types.data?.[0]?.alertTypeCode ?? null);
  const selectedType = types.data?.find((type) => type.alertTypeCode === selectedCode);

  const summary = useSettingSummary(plantId);
  const detail = useSettingDetail(plantId, selectedCode);

  const [draft, setDraft] = useState<SettingDraft | null>(null);
  const [baseline, setBaseline] = useState<SettingDraft | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<Move | null>(null);
  /* 작업 이름 검색 — 화면 안에서만 거른다(서버 요청은 그대로 · #358). 입력 중인 글과 [조회]로 건 글을 따로 든다. */
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');

  /* 고른 자리를 URL 에 적어 둔다 — 새로고침해도 같은 행이 열린다. */
  useEffect(() => {
    if (plantId === null || selectedCode === null) return;
    if (plantParam === plantId && typeParam === selectedCode) return;
    setSearchParams({ plant: String(plantId), type: selectedCode }, { replace: true });
  }, [plantId, plantParam, selectedCode, typeParam, setSearchParams]);

  const seed = (next: SettingDraft): void => {
    setDraft(next);
    setBaseline(next);
    setInlineError(null);
  };

  useEffect(() => {
    if (detail.data === undefined) return;
    seed(toDraft(detail.data));
  }, [detail.data]);

  const replace = useReplaceSetting(plantId, selectedCode, (saved) => {
    queryClient.setQueryData(handoverSettingKeys.detail(plantId, selectedCode), saved);
    seed(toDraft(saved));
    toast.show({ variant: 'success', description: t.state.saved });
  });

  const isDirty = draft !== null && baseline !== null && !sameDraft(draft, baseline);

  const go = (move: Move): void => {
    setInlineError(null);
    replace.reset();
    setSearchParams({ plant: move.plant, type: move.type });
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
    const inactive = inactiveCount(draft);
    if (inactive > 0) {
      setInlineError(t.errors.inactiveRecipients(inactive));
      return;
    }
    replace.write(toReplaceBody(draft));
  };

  const reload = (): void => {
    replace.reset();
    void detail.refetch().then((result) => {
      if (result.data !== undefined) seed(toDraft(result.data));
    });
  };

  const summaries = new Map(summary.data?.items.map((item) => [item.alertTypeCode, item]));
  const summaryOf = (code: string): Omit<SettingSummaryItem, 'alertTypeCode'> =>
    summaries.get(code) ?? EMPTY_SUMMARY;
  const typeName = (type: HandoverAlertType | undefined): string =>
    handoverTypeName(type, type?.alertTypeCode ?? selectedCode ?? '');

  const typeColumns: Column<HandoverAlertType>[] = [
    {
      key: 'type',
      header: t.columns.type,
      render: (type) => (
        <Button
          variant={type.alertTypeCode === selectedCode ? 'filled' : 'text'}
          size="sm"
          className="handover-type-button"
          aria-current={type.alertTypeCode === selectedCode ? 'true' : undefined}
          onClick={() => {
            if (plantId === null || type.alertTypeCode === selectedCode) return;
            requestMove({ plant: String(plantId), type: type.alertTypeCode });
          }}
        >
          {typeName(type)}
        </Button>
      ),
    },
    {
      key: 'enabled',
      header: t.columns.enabled,
      render: (type) => onOffChip(summaryOf(type.alertTypeCode).enabled),
    },
    {
      key: 'zalo',
      header: t.columns.zalo,
      render: (type) => onOffChip(summaryOf(type.alertTypeCode).zaloEnabled),
    },
    {
      key: 'recipients',
      header: t.columns.recipients,
      render: (type) => {
        const item = summaryOf(type.alertTypeCode);
        return (
          <span className="handover-recipient-count">
            {String(item.recipientCount)}
            {item.noPhoneCount > 0 && (
              <Chip
                size="sm"
                status="warning"
                aria-label={t.values.noPhoneCount(item.noPhoneCount)}
              >
                {`⚠${String(item.noPhoneCount)}`}
              </Chip>
            )}
            {item.inactiveCount > 0 && (
              <Chip size="sm" status="error">
                {`${t.values.inactive} ${String(item.inactiveCount)}`}
              </Chip>
            )}
          </span>
        );
      },
    },
  ];

  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다(단말 관리와 같다 · #358). */
  const orderedColumns = useColumnOrder(
    'omf-mes:handover-alert-settings:columns:order',
    typeColumns,
  );
  const resizable = useColumnWidths('omf-mes:handover-alert-settings:columns', orderedColumns);
  const fit = useFitColumns(resizable.columns);
  const needle = keyword.trim().toLowerCase();
  const shownTypes =
    plantId === null
      ? []
      : (types.data ?? []).filter(
          (type) => needle === '' || typeName(type).toLowerCase().includes(needle),
        );
  /* 인계 작업은 한 번에 다 받는 작은 목록이라 화면 안에서 쪽을 나눈다. */
  const typePage = useClientPage(shownTypes);

  const plantOptions =
    plants.data?.map((plant) => ({
      value: String(plant.plantId),
      label: `${plant.plantCode} ${plant.plantName}`,
    })) ?? [];

  const loadError = (error: unknown, onRetry: () => void) => (
    <LoadErrorAlert error={error} onRetry={onRetry} />
  );

  const settingBody = () => {
    if (detail.isError) return loadError(detail.error, () => void detail.refetch());
    if (detail.isPending || draft === null) return <Skeleton variant="rect" height="14rem" />;

    const missingPhones = noPhoneCount(draft);
    const full = draft.recipients.length >= MAX_RECIPIENTS;
    const guide = selectedCode === null ? undefined : guideOf(selectedCode);

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

        {guide !== undefined && (
          <dl className="handover-guide">
            <dt>{t.fields.when}</dt>
            <dd>{guide.when}</dd>
            <dt>{t.fields.where}</dt>
            <dd>{guide.where}</dd>
          </dl>
        )}

        <div className="alarm-switches">
          <Switch
            label={t.fields.enabled}
            checked={draft.enabled}
            onChange={(event) => change(setEnabled(draft, event.target.checked))}
          />
          <div>
            {/* 무엇이 가는지 · 실패해도 알림센터는 받는다는 규칙은 Switch 옆 ⓘ 로(관리웹 정리 시안 A). */}
            <span className="info-label">
              <Switch
                label={t.fields.zalo}
                checked={draft.zaloEnabled}
                disabled={!draft.enabled}
                aria-describedby={draft.enabled ? undefined : zaloNoteId}
                onChange={(event) => change({ ...draft, zaloEnabled: event.target.checked })}
              />
              <InfoTip text={t.state.zaloHelp} />
            </span>
            {/* 잠긴 사유는 잠겼을 때만 Switch 아래에 둔다. */}
            {!draft.enabled && (
              <span id={zaloNoteId} className="field-note">
                {t.state.zaloNeedsEnabled}
              </span>
            )}
          </div>
        </div>

        <div className="alarm-recipients">
          <div className="alarm-recipients-heading">
            <h3>{t.fields.recipients(draft.recipients.length, MAX_RECIPIENTS)}</h3>
            <Button
              variant="outlined"
              size="sm"
              disabled={full}
              onClick={() => setPickerOpen(true)}
            >
              {`+ ${t.actions.add}`}
            </Button>
          </div>
          {full && (
            <AlertBanner variant="warning">{t.state.limitReached(MAX_RECIPIENTS)}</AlertBanner>
          )}
          {draft.recipients.length === 0 ? (
            <p className="field-note">{t.state.noRecipients}</p>
          ) : (
            <ul className="alarm-recipient-list" aria-label={t.columns.recipients}>
              {draft.recipients.map((recipient) => (
                <li key={recipient.userId}>
                  <span>
                    {recipient.departmentName === null
                      ? recipient.name
                      : `${recipient.name} (${recipient.departmentName})`}
                  </span>
                  {!recipient.hasPhone && (
                    <Chip size="sm" status="warning">{`📵 ${t.values.noPhone}`}</Chip>
                  )}
                  {!recipient.active && (
                    <Chip size="sm" status="error">
                      {t.values.inactive}
                    </Chip>
                  )}
                  <Button
                    variant="text"
                    size="sm"
                    aria-label={`${recipient.name} ${t.actions.remove}`}
                    onClick={() => change(removeRecipient(draft, recipient.userId))}
                  >
                    {t.actions.remove}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {lacksRecipients(draft) && (
            <AlertBanner variant="warning">{t.state.noRecipientsWarning}</AlertBanner>
          )}
          {missingPhones > 0 && (
            <AlertBanner variant="info">{t.state.noPhoneNotice(missingPhones)}</AlertBanner>
          )}
        </div>

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
          max={MAX_RECIPIENTS}
          existingIds={new Set(draft.recipients.map((recipient) => recipient.userId))}
          onClose={() => setPickerOpen(false)}
          onAdd={(picked) => {
            change(addRecipients(draft, picked));
            setPickerOpen(false);
          }}
        />
      </>
    );
  };

  const typeList = () => {
    if (plants.isError) return loadError(plants.error, () => void plants.refetch());
    if (plants.isPending) return <Skeleton variant="rect" height="12rem" />;
    if (plantId === null) return <EmptyState size="sm" title={t.state.noPlants} />;
    if (types.isError || summary.isError) {
      return loadError(types.error ?? summary.error, () => {
        void types.refetch();
        void summary.refetch();
      });
    }
    if (types.isPending || summary.isPending) return <Skeleton variant="rect" height="12rem" />;

    return (
      <>
        {/* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 작업 단추로 넘긴다(단말 관리와 같다). */}
        <div
          ref={fit.ref}
          className="inspection-queue-table notify-list-table"
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
            rows={typePage.rows}
            getRowId={(type) => type.alertTypeCode}
            density="compact"
            className="handover-type-table"
            aria-label={t.panes.types}
            empty={<EmptyState size="sm" title={t.state.noTypes} />}
          />
        </div>
        <PageNav {...typePage.nav} buttonSize="md" />
      </>
    );
  };

  const settingPane = () => {
    if (plantId === null || selectedCode === null) {
      return (
        <EmptyState
          size="sm"
          className="users-roles-pick-empty"
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="notifications" size={20} />
            </span>
          }
          title={w.selectTypeTitle}
          description={w.selectType}
        />
      );
    }

    return (
      <>
        <h2 className="pane-title notify-detail-title">
          {t.panes.setting(typeName(selectedType))}
        </h2>
        {settingBody()}
      </>
    );
  };

  const filter = (
    <>
      <div className="filter-bar notify-filter-row">
        {/* US2-6 — 고를 공장이 하나뿐이면 칸을 두지 않는다. 공장은 고르는 즉시 적용한다. */}
        {(plants.data?.length ?? 0) > 1 && (
          <SelectField
            label={t.fields.plant}
            options={plantOptions}
            value={plantId === null ? '' : String(plantId)}
            placeholder={t.fields.plant}
            onChange={(value) => {
              if (value === String(plantId) || selectedCode === null) return;
              requestMove({ plant: value, type: selectedCode });
            }}
          />
        )}
        <SearchInput
          containerClassName="notify-search-input"
          label={w.search}
          value={search}
          placeholder={w.searchPlaceholder}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={(value) => setKeyword(value)}
          clearLabel={messages.common.clear}
        />
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => setKeyword(search)}>{w.apply}</Button>
          {/* 초기화는 검색어가 처음 값(빈칸)과 다를 때만 보인다. */}
          {hasChangedFilters({ q: '' }, { q: search }, { q: keyword }) && (
            <Button
              variant="outlined"
              onClick={() => {
                setSearch('');
                setKeyword('');
              }}
            >
              {w.clear}
            </Button>
          )}
        </div>
      </div>

      {/* 처음엔 모두 꺼져 있고 Zalo 를 켜면 발송량이 는다는 안내(관리웹 정리 시안 A의 ⓘ) — 파란 안내 한 줄(#358). */}
      <p className="iqc-inspection-action-note notify-filter-note" data-tone="info" role="note">
        <Icon name="info" size={16} aria-hidden />
        {t.intro}
      </p>

      {/* 연결이 없다는 진짜 경고라 노란색 그대로 둔다(#358). */}
      {summary.data?.zaloStatus !== undefined && summary.data.zaloStatus !== 'ACTIVE' && (
        <div className="banner-slot">
          <AlertBanner
            variant="warning"
            action={
              canOpenConnection ? (
                <Link to={ZALO_CONNECTION_PATH}>{t.actions.openConnection}</Link>
              ) : undefined
            }
          >
            {t.state.zaloNotActive}
          </AlertBanner>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* 머리글(경로 · 화면 이름)은 두지 않는다 — 사이드바가 위치를 말한다(단말 관리와 같은 틀 · #358). */}
      <ListDetailWorkspace
        storageKey="omf-mes:handover-alert-settings"
        filter={{ label: w.filter, content: filter }}
        list={{
          label: w.list,
          title: w.list,
          count: plantId === null || types.data === undefined ? undefined : shownTypes.length,
          content: typeList(),
        }}
        detail={{
          label:
            plantId === null || selectedCode === null
              ? w.selectTypeTitle
              : t.panes.setting(typeName(selectedType)),
          content: settingPane(),
        }}
      />

      <Dialog
        open={pendingMove !== null}
        onClose={() => setPendingMove(null)}
        title={t.state.unsavedTitle}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={() => setPendingMove(null)}>
              {t.actions.cancel}
            </Button>
            <Button
              onClick={() => {
                if (pendingMove !== null) go(pendingMove);
                setPendingMove(null);
              }}
            >
              {t.actions.discard}
            </Button>
          </>
        }
      >
        {t.state.unsavedBody}
      </Dialog>
    </>
  );
};
