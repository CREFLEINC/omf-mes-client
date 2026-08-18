import { Switch } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { SelectField } from './select-field';
import type { AdjustHeaderDraft, SelectOption } from './types';

const t = messages.stockAdjust;

export interface HeaderFormProps {
  values: AdjustHeaderDraft;
  /** 헤더 사유 선택지. **고객의 공통코드 마스터에서 온다**(#36 회신 · `reason-options.ts`) */
  reasonOptions: SelectOption[];
  /**
   * 선택지의 **한계**를 밝히는 보조 문구 — 불러오지 못했거나 앞쪽 일부만 받았을 때다.
   *
   * ⛔ **「목록 준비 중」을 여기 넣지 않는다**(#36 회신 ④). 선택지가 0건인 것은 고객의
   * 마스터가 아직 그렇다는 사실이고, 화면이 그것을 미완성으로 말할 근거가 없다.
   */
  reasonNote?: string;
  /** 서버가 준 필드 오류. 화면이 잡은 필수 미선택은 조작 자리의 잠금 사유가 말한다 */
  fieldErrors: Record<string, string>;
  /**
   * 두 칸이 함께 잠겼는가(C26).
   *
   * **사유는 이 폼이 내지 않는다** — 나가는 중과 이미 등록한 뒤가 같은 잠금을 쓰고, 그 사정은
   * 조작 자리(등록 버튼 옆)에 한 번 선다. 칸마다 되풀이하면 같은 사실이 두 번 읽힌다.
   */
  isLocked?: boolean;
  onChange: (patch: Partial<AdjustHeaderDraft>) => void;
}

/**
 * 조정 머리 입력 — **계약이 등록에서 받는 두 값뿐이다**(`reasonCode`·`sendToErp`).
 *
 * **헤더 사유와 상신 사유는 다른 것이다**(D-8 · 조심 ⑥). 여기 있는 것은 **코드**이고, 결재함
 * 목록에서 요약을 겸하는 자유 텍스트 사유는 상신이 붙는 회차의 것이다 — 한 폼에 두면 사용자가
 * 둘을 같은 값으로 읽고, 코드 칸에 문장을 넣으려 든다.
 *
 * **사유 선택지는 고객의 공통코드 마스터에서 온다**(#36 회신 · 공유계약 `G-31`). 화면은
 * 받은 값을 그대로 내밀 뿐 **어느 값인지 보지 않는다** — 값에 갈래를 걸면 고객이 값을 바꾸는
 * 날 화면이 조용히 다르게 돈다. 0건이면 고를 것이 없을 뿐이고, ⛔ 그 상태를 「준비 중」으로
 * 말하거나 칸을 잠그지 않는다.
 *
 * **ERP 송신 토글의 상태가 곧 계약 필드다**(D-11 · 미결 #66). 자리표시 상수를 두지 않는다 —
 * 계약이 `sendToErp`를 실제로 받고 설명이 「화면의 송신 토글이 이 값이다」로 못 박았다.
 * 연계 **방식**은 서버가 정하는 것이라 화면에 표현할 자리가 없고, 그 사실만 한 줄로 적는다.
 *
 * **전표번호·상태 칸이 없다** — 서버가 정한다(계약 스키마 설명). 칸을 두면 보낼 수 없는 값을
 * 화면이 들고 있게 된다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const HeaderForm = ({
  values,
  reasonOptions,
  reasonNote,
  fieldErrors,
  isLocked = false,
  onChange,
}: HeaderFormProps) => (
  <div className="form-grid">
    <SelectField
      label={t.fields.reasonCode}
      required
      options={reasonOptions}
      value={values.reasonCode}
      placeholder={t.fields.reasonCodePlaceholder}
      note={reasonNote}
      error={fieldErrors.reasonCode}
      disabled={isLocked}
      onChange={(value) => {
        onChange({ reasonCode: value });
      }}
    />

    <div className="field-cell">
      <Switch
        label={t.fields.sendToErp}
        checked={values.sendToErp}
        disabled={isLocked}
        onChange={(event) => {
          onChange({ sendToErp: event.target.checked });
        }}
      />
      {/* 화면이 정하는 것은 보낼지 여부 하나라는 사실 — 방식은 서버 소관이다. */}
      <span className="field-note">{t.notes.sendToErpNote}</span>
    </div>
  </div>
);
