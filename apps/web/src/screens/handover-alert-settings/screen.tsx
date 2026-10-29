import {
  AlertBanner,
  Breadcrumb,
  Button,
  Chip,
  Dialog,
  EmptyState,
  PageHeader,
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
import { SaveErrorBanner } from '../../patterns/master';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
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

  const plantOptions =
    plants.data?.map((plant) => ({
      value: String(plant.plantId),
      label: `${plant.plantCode} ${plant.plantName}`,
    })) ?? [];

  const loadError = (onRetry: () => void) => (
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {messages.httpError.description}
    </AlertBanner>
  );

  const settingBody = () => {
    if (detail.isError) return loadError(() => void detail.refetch());
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
            <Switch
              label={t.fields.zalo}
              checked={draft.zaloEnabled}
              disabled={!draft.enabled}
              aria-describedby={zaloNoteId}
              onChange={(event) => change({ ...draft, zaloEnabled: event.target.checked })}
            />
            <span id={zaloNoteId} className="field-note">
              {draft.enabled ? t.state.zaloHelp : t.state.zaloNeedsEnabled}
            </span>
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

  const workspace = () => {
    if (plants.isError) return loadError(() => void plants.refetch());
    if (plants.isPending) return <Skeleton variant="rect" height="12rem" />;
    if (plantId === null) return <EmptyState size="sm" title={t.state.noPlants} />;

    return (
      <div className="two-pane alarm-recipient-layout">
        <section className="pane alarm-recipient-pane" aria-labelledby="handover-types-title">
          <h2 id="handover-types-title" className="pane-title">
            {t.panes.types}
          </h2>
          {types.isError || summary.isError ? (
            loadError(() => {
              void types.refetch();
              void summary.refetch();
            })
          ) : types.isPending || summary.isPending ? (
            <Skeleton variant="rect" height="12rem" />
          ) : (
            <Table
              columns={typeColumns}
              rows={types.data}
              getRowId={(type) => type.alertTypeCode}
              density="compact"
              className="handover-type-table"
              aria-labelledby="handover-types-title"
              empty={<EmptyState size="sm" title={t.state.noTypes} />}
            />
          )}
        </section>

        <section className="pane alarm-recipient-pane" aria-labelledby="handover-setting-title">
          <h2 id="handover-setting-title" className="pane-title">
            {t.panes.setting(typeName(selectedType))}
          </h2>
          {selectedCode === null ? <EmptyState size="sm" title={t.state.noTypes} /> : settingBody()}
        </section>
      </div>
    );
  };

  return (
    <>
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

      <div className="handover-top">
        {(plants.data?.length ?? 0) > 1 && (
          <div className="alarm-department-bar">
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
          </div>
        )}
        <div className="banner-slot">
          <AlertBanner variant="info">{t.intro}</AlertBanner>
        </div>
      </div>

      {workspace()}

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
