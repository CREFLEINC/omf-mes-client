import { AlertBanner, Button, Dialog, SkeletonText, Switch } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { BomComponentFormValues } from './bom-component-mappers';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.itemExtendedAttrs.component;

export interface BomComponentFormDialogProps {
  /** 어느 줄을 고치는지. 표에서 창으로 넘어와도 대상이 흐려지지 않게 제목에 담는다 */
  rowName: string;
  loadError: ReactNode;
  /**
   * 상세가 도착하기 전에는 `null`이다 — 빈 폼을 보이면 사용자가 그것을 자료로 읽는다.
   *
   * **「받는 중인가」를 따로 받지 않는다.** 값이 없는 동안이 곧 받는 중이고,
   * 늘 같은 결론을 내는 prop을 두면 읽는 사람이 없는 갈래를 찾게 된다.
   */
  values: BomComponentFormValues | null;
  onChange: (patch: Partial<BomComponentFormValues>) => void;
  routingOperationOptions: (selected: string) => SelectOption[];
  /** 이 품목에 공정 흐름이 하나도 없어 고를 수 없을 때의 사유 */
  routingOperationDisabledReason?: string;
  processOptions: (selected: string) => SelectOption[];
  /** 서버가 준 필드 오류. 화면이 만드는 로컬 검증은 없다 */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다 */
  banner: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
}

/**
 * 구성품 확장 열 편집 창. **이 화면에서 유일하게 구성품을 바꾸는 자리다.**
 *
 * **원본 열이 이 창에 없다**(C14). 계약의 `BomComponentUpdate`가 확장 넷만 받는데
 * 서버가 그 경계를 막지 않으므로(실측 P), 화면이 형태로 지킨다 — 창에 입력칸을 두지 않으면
 * 실수로도 실을 수 없다. 그 사실을 창 머리 안내가 함께 밝힌다.
 *
 * **저장은 상세 조회가 끝난 뒤에만 열린다.** 잠금 토큰이 행 상세에만 오므로(§5.3 6행),
 * 목록만 받은 상태에서 저장을 누를 수 있게 두면 요청이 조용히 멈춘다.
 *
 * **확정 상태를 선제 판정하지 않는다**(결정 10). `Bom.statusCode`의 값 목록이 확정되지 않아
 * 화면이 「작성중」을 판정할 문자열을 갖고 있지 않다 — 서버가 400 `STATE_LOCKED`로 막고
 * 그 결과는 공통 배너가 「다시 불러와도 풀리지 않는 상태」로 낸다.
 *
 * **로컬 검증이 없다.** 계약이 이 네 열에 옮길 제약을 두지 않았다 —
 * 없는 제약을 흉내 내면 서버가 허용하는 값을 화면이 막는다(결정 7).
 */
export const BomComponentFormDialog = ({
  rowName,
  loadError,
  values,
  onChange,
  routingOperationOptions,
  routingOperationDisabledReason,
  processOptions,
  fieldErrors,
  banner,
  isDirty,
  isSaving,
  onSave,
  onClose,
}: BomComponentFormDialogProps) => {
  /** 값이 도착하기 전에는 저장할 것이 없다 — 토큰도 아직 없다. */
  const canSave = values !== null && isDirty && !isSaving;

  const body = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (values === null) {
      return (
        <div role="status" aria-label={t.loading.detail}>
          <SkeletonText lines={4} />
        </div>
      );
    }

    return (
      <div className="form-grid">
        {/* 비우는 것이 정상 값이다 — 계약이 널을 허용한다. */}
        <SelectField
          label={t.fields.routingOperation}
          options={[
            { value: '', label: t.values.unassigned },
            ...routingOperationOptions(values.routingOperationId),
          ]}
          value={values.routingOperationId}
          onChange={(value) => onChange({ routingOperationId: value })}
          disabled={routingOperationDisabledReason !== undefined}
          disabledReason={routingOperationDisabledReason}
          error={fieldErrors.routingOperationId}
          /* 라벨이 「Rev 3 · 2. 조립」 형태로 길다 — 트리거 폭에 갇혀 잘리는 자리다. */
          wide
        />

        <SelectField
          label={t.fields.actualUseProcess}
          options={[
            { value: '', label: t.values.unassigned },
            ...processOptions(values.actualUseProcessId),
          ]}
          value={values.actualUseProcessId}
          onChange={(value) => onChange({ actualUseProcessId: value })}
          error={fieldErrors.actualUseProcess}
        />

        <div className="field-cell">
          <Switch
            label={t.fields.lotTraceRequired}
            checked={values.lotTraceRequired}
            onChange={(event) => onChange({ lotTraceRequired: event.target.checked })}
          />
        </div>

        <div className="field-cell">
          <Switch
            label={t.fields.backflushAllowed}
            checked={values.backflushAllowed}
            onChange={(event) => onChange({ backflushAllowed: event.target.checked })}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={t.dialog.title(rowName)}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          {/* 상세가 오기 전에는 저장이 닫혀 있다 — 토큰 없이 누르면 요청이 조용히 멈춘다. */}
          <Button loading={isSaving} disabled={!canSave} onClick={onSave}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      {banner}

      {/* 없는 것을 찾다가 「화면이 빠뜨렸다」로 읽지 않게 한다. */}
      <div className="banner-slot">
        <AlertBanner variant="info">{t.dialog.originNotice}</AlertBanner>
      </div>

      {body()}
    </Dialog>
  );
};
