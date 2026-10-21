import {
  AlertBanner,
  Breadcrumb,
  Button,
  Chip,
  PageHeader,
  Skeleton,
  TextField,
  type ChipStatus,
} from '@crefle/web-ui';
import type { ZaloConnectionStatus } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { useConnection, useEventNames, useReplaceConnection, zaloConnectionKeys } from './queries';
import { paramsOf } from './template-params';
import type { ConnectionFormValues } from './types';
import { sameValues, toFormValues, toReplaceBody, validateConnection } from './validation';

const t = messages.zaloConnection;

const STATUS_CHIP: Record<ZaloConnectionStatus, ChipStatus> = {
  ACTIVE: 'success',
  NOT_CONFIGURED: 'idle',
  REAUTH_REQUIRED: 'error',
};

const when = (value: string | null): string =>
  value === null ? t.values.none : (formatPlantDateTime(value) ?? value);

type SecretField = 'secretKey' | 'refreshToken';

/**
 * W-CO-12 알림 연결 설정 — Zalo 연결 정보와 이벤트별 템플릿 ID(001 신설, 결정 #20).
 * 비밀값은 다시 보이지 않는다. [바꾸기]로 새 값을 넣을 때만 보낸다.
 */
export const ZaloConnectionScreen = () => {
  const queryClient = useQueryClient();
  const connection = useConnection();
  const events = useEventNames();
  const [values, setValues] = useState<ConnectionFormValues | null>(null);
  const [baseline, setBaseline] = useState<ConnectionFormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);

  const seed = (next: ConnectionFormValues): void => {
    setValues(next);
    setBaseline(next);
    setErrors({});
  };

  useEffect(() => {
    if (connection.data !== undefined) seed(toFormValues(connection.data));
  }, [connection.data]);

  const replace = useReplaceConnection((saved) => {
    /*
     * ⭐ 조회 캐시도 저장 응답으로 바꾼다 — 상태 Chip·「등록됨」은 캐시를 읽으므로, 폼만 다시 채우면
     * 첫 조회(미설정)가 새로 고칠 때까지 남는다(G2 실측).
     */
    queryClient.setQueryData(zaloConnectionKeys.connection, saved);
    seed(toFormValues(saved));
    setFlash(t.state.saved);
  });

  const change = (patch: Partial<ConnectionFormValues>): void => {
    setValues((current) => (current === null ? current : { ...current, ...patch }));
    setErrors({});
    setFlash(null);
    replace.reset();
  };

  const eventOrder = connection.data?.templates.map((item) => item.eventCode) ?? [];
  const eventName = (code: string): string => {
    const name = events.data?.find((event) => event.eventCode === code)?.eventName ?? '';
    return name.trim() === '' ? code : name;
  };

  const save = (): void => {
    if (values === null) return;
    const found = validateConnection(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    replace.write(toReplaceBody(values, eventOrder));
  };

  const reload = (): void => {
    replace.reset();
    void connection.refetch().then((result) => {
      if (result.data !== undefined) seed(toFormValues(result.data));
    });
  };

  const copy = async (code: string): Promise<void> => {
    /* 보안 연결이 아니면 클립보드가 없다 — 파라미터는 화면에 보이므로 조용히 둔다. */
    try {
      await navigator.clipboard.writeText(paramsOf(code));
      setFlash(t.state.copied);
    } catch {
      setFlash(null);
    }
  };

  const fieldError = (key: string): string | undefined => errors[key] ?? replace.fieldErrors[key];

  const secretRow = (field: SecretField, label: string, isSet: boolean): ReactNode => {
    const value = values?.[field] ?? null;
    if (value === null) {
      return (
        <div className="field-cell">
          <span className="field-label">{label}</span>
          <div className="zalo-secret">
            <span>{isSet ? t.values.registered : t.values.notRegistered}</span>
            <Button
              variant="outlined"
              size="sm"
              aria-label={`${label} ${t.actions.change}`}
              onClick={() => change({ [field]: '' })}
            >
              {t.actions.change}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="zalo-secret">
        <TextField
          label={label}
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={(event) => change({ [field]: event.target.value })}
          error={fieldError(field)}
        />
        <Button variant="text" size="sm" onClick={() => change({ [field]: null })}>
          {t.actions.cancelChange}
        </Button>
      </div>
    );
  };

  const body = (): ReactNode => {
    if (connection.isError) {
      return (
        <AlertBanner
          variant="error"
          title={messages.httpError.loadTitle}
          action={
            <Button variant="outlined" size="sm" onClick={() => void connection.refetch()}>
              {messages.common.retry}
            </Button>
          }
        >
          {messages.httpError.description}
        </AlertBanner>
      );
    }
    if (connection.isPending || values === null) return <Skeleton variant="rect" height="20rem" />;

    const data = connection.data;
    const isDirty = baseline !== null && !sameValues(values, baseline);

    return (
      <>
        <section className="pane zalo-pane" aria-labelledby="zalo-status-title">
          <h2 id="zalo-status-title" className="pane-title">
            {t.panes.status}
          </h2>
          <div className="zalo-status">
            <Chip status={STATUS_CHIP[data.status]}>{t.status[data.status]}</Chip>
            <span>{`${t.fields.expiresAt} ${when(data.accessTokenExpiresAt)}`}</span>
            <span>{`${t.fields.refreshedAt} ${when(data.lastRefreshedAt)}`}</span>
          </div>
          {data.status === 'REAUTH_REQUIRED' && (
            <AlertBanner variant="error">{t.state.reauth}</AlertBanner>
          )}
          {data.lastErrorCode !== null && (
            <AlertBanner variant="warning">
              {t.state.lastError(data.lastErrorCode, data.lastErrorMessage ?? '')}
            </AlertBanner>
          )}
          {!data.deliveryEnabled && (
            <AlertBanner variant="info">{t.state.deliveryDisabled}</AlertBanner>
          )}
        </section>

        <section className="pane zalo-pane" aria-labelledby="zalo-connection-title">
          <h2 id="zalo-connection-title" className="pane-title">
            {t.panes.connection}
          </h2>
          {replace.error?.kind === 'conflict' ? (
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
          ) : (
            <SaveErrorBanner error={replace.error} />
          )}
          {flash !== null && <AlertBanner variant="success">{flash}</AlertBanner>}

          <div className="form-grid zalo-form">
            <TextField
              label={t.fields.appId}
              inputMode="numeric"
              value={values.appId}
              onChange={(event) => change({ appId: event.target.value })}
              error={fieldError('appId')}
            />
            {secretRow('secretKey', t.fields.secretKey, data.secretKeySet)}
            {secretRow('refreshToken', t.fields.refreshToken, data.refreshTokenSet)}
            <TextField
              label={`${t.fields.paramMaxLength} (${t.values.charUnit})`}
              inputMode="numeric"
              value={values.paramMaxLength}
              onChange={(event) => change({ paramMaxLength: event.target.value })}
              error={fieldError('paramMaxLength')}
            />
          </div>

          <h3 className="zalo-subtitle">{t.panes.templates}</h3>
          <ul className="zalo-templates">
            {eventOrder.map((code) => (
              <li key={code}>
                <span className="zalo-template-name">{eventName(code)}</span>
                <TextField
                  aria-label={t.fields.templateId(eventName(code))}
                  value={values.templates[code] ?? ''}
                  onChange={(event) =>
                    change({ templates: { ...values.templates, [code]: event.target.value } })
                  }
                  error={fieldError(`templates.${code}`)}
                />
                <span className="field-note">{`${t.fields.params}: ${paramsOf(code)}`}</span>
                <Button
                  variant="text"
                  size="sm"
                  aria-label={t.actions.copyFor(eventName(code))}
                  onClick={() => void copy(code)}
                >
                  {t.actions.copy}
                </Button>
              </li>
            ))}
          </ul>

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
            <Button
              disabled={!isDirty || replace.isSaving}
              loading={replace.isSaving}
              onClick={save}
            >
              {t.actions.save}
            </Button>
          </div>
        </section>
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.subtitle}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <div className="zalo-layout">{body()}</div>
    </>
  );
};
