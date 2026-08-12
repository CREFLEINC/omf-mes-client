import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { codeNote, codePlaceholder } from './code-options';
import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';
import type { RouteFormMode } from './route-validation';
import { SelectField } from './select-field';
import type { RouteFormValues, RouteView, SelectOption } from './types';

const t = messages.approvalRoute;

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

export interface RouteFormPaneProps {
  mode: RouteFormMode;
  /**
   * 서버가 준 결재선. **등록에는 없다** — 아직 만들어지지 않은 자원이라 사용 여부도 단계 수도
   * 진행 중 건수도 존재하지 않는다. 없는 값을 0으로 채워 보이면 사용자가 그것을 자료로 읽는다.
   */
  route: RouteView | null;
  values: RouteFormValues;
  onChange: (patch: Partial<RouteFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  /**
   * 승인 유형 선택지. **화면이 넘긴다** — 자리표시 상수를 부품이 직접 읽으면
   * 「값이 확정되면 배열만 채운다」는 전환을 바깥에서 잴 수 없다.
   */
  approvalTypeOptions: SelectOption[];
  businessUnitOptions: SelectOption[];
  /** 사업부 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  businessUnitNote?: string;
  /** 활성 중복을 판정하지 못했다는 안내. **막지 않는다** — 서버가 다시 검사한다. */
  duplicateUnknownNote: string | null;
  /** 활성 중복으로 막혔을 때 기존 결재선으로 옮겨 가는 길. 막히지 않았으면 `null`. */
  onOpenExisting: (() => void) | null;
  /** `null`이면 저장할 수 있다. 값이 있으면 그것이 비활성 사유다(배치 규범 4). */
  saveDisabledReason: string | null;
  /** 「다시 사용」의 비활성 사유. 사용 중인 결재선에는 그 버튼 자체가 서지 않는다. */
  activateDisabledReason: string | null;
  isDirty: boolean;
  /**
   * 어느 쓰기든 나가는 중인가. **네 쓰기가 한 벌의 잠금 토큰을 나눠 쓰므로 함께 잠긴다** —
   * 동시에 나가면 뒤엣것이 반드시 409다.
   */
  isLocked: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
}

/**
 * 고른 결재선의 내용과 **등록·수정 폼**.
 *
 * ## 이 폼이 소유하지 않는 것
 *
 * - **승인 유형(수정)** — 계약의 수정 본문에 그 키가 아예 없다. 「바꾸면 다른 결재선이다」가
 *   계약의 말이며, 읽기 표시로 두고 그 사실을 문구로 밝힌다.
 * - **사용 여부** — 전용 액션(`:deactivate`·`:activate`)으로만 바뀐다. 입력칸을 두면
 *   저장 본문에 실릴 여지가 생긴다.
 * - **결재 단계** — 등록 본문에 단계를 실을 수 없고 치환은 번호를 요구한다. 등록 중에는
 *   붙일 대상 자체가 없어 단계 구획이 서지 않는다.
 *
 * ## 비움 경고를 창이 아니라 폼 안에 둔다 (계획 §13-4)
 *
 * 이 저장은 **전체 교체**라 비운 칸이 「그대로 둔다」가 아니라 「비운다」로 나간다. 그 사실은
 * 그 칸 바로 옆에서 읽히는 것이 정확하고, 결재선 수정은 다시 저장하면 되돌릴 수 있다 —
 * 창은 **되돌리는 데 다른 사람의 업무가 걸리는 조작**(끄기·켜기)에만 둔다.
 *
 * ## 진행 중 건수를 상시 자리에 둔다
 *
 * 사용 중지 확인 창에만 두면 결재선을 *고치는* 사람은 자기가 무엇에 영향을 주지 *않는지*를
 * 끝내 모른다 — 진행 중인 요청은 지금의 결재선으로 끝난다. 건수는 결재선 응답이 직접 실어
 * 오는 파생값이라 화면이 세지 않는다.
 *
 * **「이 결재선이 지금 상신에 쓰입니다」라고 말하지 않는다.** 같은 유형·사업부로 사용 중인
 * 결재선이 둘 이상일 수 있고 고르는 규칙은 서버가 갖는다 — 화면은 자기가 아는 사실만 말한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RouteFormPane = ({
  mode,
  route,
  values,
  onChange,
  fieldErrors,
  banner,
  approvalTypeOptions,
  businessUnitOptions,
  businessUnitNote,
  duplicateUnknownNote,
  onOpenExisting,
  saveDisabledReason,
  activateDisabledReason,
  isDirty,
  isLocked,
  onSave,
  onCancel,
  onDeactivate,
  onActivate,
}: RouteFormPaneProps) => {
  const minValueId = useId();
  const maxValueId = useId();

  const isCreate = mode === 'create';
  const saveLabel = isCreate ? t.actions.submitCreate : messages.common.save;

  /**
   * 「선택 없음」이 곧 **전 사업부 공통**이다 — 특별한 값이 아니라 값이 없는 것이다.
   * 빈 선택지를 두지 않으면 한 번 고른 뒤에 다시 비울 방법이 칸 안에 없어진다.
   */
  const businessUnitChoices: SelectOption[] = [
    { value: '', label: t.values.allBusinessUnits },
    ...businessUnitOptions,
  ];

  /** **비웠을 때만 낸다.** 늘 세워 두면 안내가 배경이 되어 정작 비운 순간에 읽히지 않는다. */
  const isBusinessUnitEmpty = values.businessUnitId === '';
  const isValueRangeEmpty = values.minValue.trim() === '' && values.maxValue.trim() === '';

  /** 읽기 표기 — **서버가 준 사실만**이다. 등록에는 아직 어느 것도 없다. */
  const summary: SummaryItem[] =
    route === null
      ? []
      : [
          {
            key: 'approvalTypeCode',
            label: t.fields.approvalTypeCode,
            value: route.approvalTypeCode,
          },
          {
            key: 'status',
            label: t.fields.status,
            value: route.isActive ? t.values.active : t.values.inactive,
          },
          {
            key: 'stepCount',
            label: t.fields.stepCount,
            value: route.stepCount === 0 ? t.values.noSteps : String(route.stepCount),
          },
        ];

  return (
    <section className="pane" aria-label={isCreate ? t.panes.create : t.panes.detail}>
      {banner}

      {summary.length > 0 && (
        /* 입력칸이 없는 값이라 폼이 아니라 **값 표기**로 낸다(배치 규범 3). */
        <dl className="filter-bar">
          {summary.map((item) => (
            <div className="field-cell" key={item.key}>
              <dt className="field-label">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="form-grid">
        {isCreate && (
          /*
           * **등록에서만 입력칸이다.** 값 목록이 확정되지 않아 선택지가 비어 있고
           * (`omf-mes#64`), 왜 비었는지는 안내가 말한다 — 값을 지어내지 않는다.
           */
          <SelectField
            required
            label={t.fields.approvalTypeCode}
            options={approvalTypeOptions}
            value={values.approvalTypeCode}
            note={codeNote(approvalTypeOptions)}
            error={fieldErrors.approvalTypeCode}
            placeholder={approvalTypeOptions.length === 0 ? codePlaceholder() : undefined}
            disabled={isLocked}
            onChange={(value) => {
              onChange({ approvalTypeCode: value });
            }}
          />
        )}

        {/*
         * 규범 3-2 — 선택칸이 「코드 · 이름」을 고른다. 최소 폭을 주지 않으면 선택지 목록이
         * 트리거 폭에 갇혀 잘리고, 무엇을 고르는지 읽을 수 없다.
         */}
        <SelectField
          wide
          label={t.fields.businessUnit}
          options={businessUnitChoices}
          value={values.businessUnitId}
          note={businessUnitNote}
          error={fieldErrors.businessUnitId}
          disabled={isLocked}
          onChange={(value) => {
            onChange({ businessUnitId: value });
          }}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={minValueId} label={t.fields.minValue} />
          <TextField
            id={minValueId}
            value={values.minValue}
            /* 숫자 자판을 띄우되 형식 판정은 화면이 한다 — 브라우저마다 허용 글자가 다르다. */
            inputMode="decimal"
            error={fieldErrors.minValue}
            disabled={isLocked}
            onChange={(event) => {
              onChange({ minValue: event.target.value });
            }}
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={maxValueId} label={t.fields.maxValue} />
          <TextField
            id={maxValueId}
            value={values.maxValue}
            inputMode="decimal"
            error={fieldErrors.maxValue}
            disabled={isLocked}
            onChange={(event) => {
              onChange({ maxValue: event.target.value });
            }}
          />
        </div>
      </div>

      {!isCreate && <p className="field-note">{t.notes.approvalTypeFixed}</p>}
      {isBusinessUnitEmpty && <p className="field-note">{t.notes.businessUnitEmpty}</p>}
      {isValueRangeEmpty && <p className="field-note">{t.notes.valueRangeEmpty}</p>}
      <p className="field-note">{t.notes.valueRangeUnused}</p>

      {route !== null && (
        <p className="field-note">
          {route.inProgressCount === 0
            ? t.notes.inProgressNone
            : t.notes.inProgressSome(route.inProgressCount)}
        </p>
      )}

      {duplicateUnknownNote !== null && <p className="field-note">{duplicateUnknownNote}</p>}

      <div className="form-actions">
        {/*
         * 사용 전환은 **폼 저장과 다른 오퍼레이션**이라 액션이 따로 선다. 지금 상태에서 할 수
         * 있는 쪽 하나만 낸다 — 둘을 함께 두면 지금 켜져 있는지 꺼져 있는지가 흐려진다.
         */}
        {route !== null &&
          (route.isActive ? (
            <div className="field-cell form-actions-secondary">
              <Button variant="outlined" disabled={isLocked} onClick={onDeactivate}>
                {messages.common.deactivate}
              </Button>
            </div>
          ) : activateDisabledReason === null ? (
            <div className="field-cell form-actions-secondary">
              <Button variant="outlined" disabled={isLocked} onClick={onActivate}>
                {t.actions.activate}
              </Button>
            </div>
          ) : (
            <DisabledAction
              label={t.actions.activate}
              reason={activateDisabledReason}
              className="form-actions-secondary"
            />
          ))}

        {/*
         * 활성 중복으로 막혔을 때 **기존 결재선으로 옮겨 가는 길**을 함께 낸다.
         * 막기만 하면 사용자는 「그 기존 결재선이 어느 것인지」를 목록에서 다시 찾아야 하는데,
         * 그 행은 조준 조회가 이미 실어 왔다 — **추가 조회 없이** 그 번호로 옮긴다.
         */}
        {onOpenExisting !== null && (
          <div className="field-cell">
            <Button variant="outlined" disabled={isLocked} onClick={onOpenExisting}>
              {t.actions.openExisting}
            </Button>
          </div>
        )}

        {/*
         * 등록에서 「취소」는 **폼을 닫는 것**이라 고친 것이 없어도 눌러야 한다.
         * 수정에서는 **기준값으로 되돌리는 것**이라 고친 것이 있을 때만 의미가 있다.
         */}
        <Button
          variant="outlined"
          disabled={isLocked || (!isCreate && !isDirty)}
          onClick={onCancel}
        >
          {messages.common.cancel}
        </Button>

        {/*
         * 막혔으면 **비활성 + 사유**로 둔다(배치 규범 4) — 사유가 없으면 사용자는 버튼이 왜
         * 안 눌리는지 알 방법이 없다. 전송 중에는 진행 표시가 그 자리를 대신한다.
         */}
        {saveDisabledReason === null ? (
          <Button variant="filled" loading={isLocked} disabled={isLocked} onClick={onSave}>
            {saveLabel}
          </Button>
        ) : (
          <DisabledAction variant="filled" label={saveLabel} reason={saveDisabledReason} />
        )}
      </div>
    </section>
  );
};
