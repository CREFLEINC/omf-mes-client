import { messages } from '@omf-mes/i18n';

import type { DisposalCodeKey, SelectOption, WarehouseEntry } from './types';

/**
 * 값 목록이 확정되지 않은 코드를 **한 파일에 격리한다.**
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 착수 이슈가 미결로 남긴 것을 화면이
 * 그럴듯한 예시로 메우면, 사용자는 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다 —
 * **재고를 차감하는** 되돌릴 수 없는 쓰기로 이어지는 화면에서 그 어긋남은 막다른 길이 된다.
 * 계약의 `@example`도 심지 않는다. 그것은 예시이지 확정이 아니며, 계약 자신이
 * 「enum으로 못박으면 값이 정해질 때 계약이 깨진다」는 취지를 적었다.
 *
 * **착수 이슈는 둘(폐기 계정 · 승인 유형·상태)을 적었으나 이 화면에 걸리는 자리는 더 많다**
 * (계획 결정 8 · §5.4-9). 이 화면이 다루는 것은 그중 **여섯 + 창고 유형**이다.
 *
 * | 자리 | 키 | 비면 무엇이 막히나 |
 * | --- | --- | --- |
 * | 폐기 정보 — 출고 유형 · **이력 조건 — 출고 유형** | `issueType` | **폐기 요청 등록 전체** |
 * | 폐기 정보 — 원천 문서 유형 | `sourceDocumentType` | 같은 위 |
 * | 폐기 정보 — 폐기 사유 · **이력 조건 — 폐기 사유** | `reason` | 같은 위 |
 * | 대상 조회 조건 — 입고 유형 | `receiptType` | 아무것도 막히지 않는다 |
 * | 대상 조회 조건 — 입고 상태 | `status` | 아무것도 막히지 않는다 |
 * | **이력 조건 — 출고 상태** | `issueStatus` | 아무것도 막히지 않는다 |
 * | 창고 선택칸을 좁히는 축 | `DEFECT_WAREHOUSE_TYPE_CODES` | 창고가 좁혀지지 않는다 |
 * | **폐기 요청 정보 — 폐기 거래처** | `DISPOSAL_PARTNER_ROLE_CODE` | **거래처를 고를 수 없다**(자체 폐기로는 올릴 수 있다) — ✅ 2026-08-16 채워짐 |
 *
 * **표에서 두 줄이 사라졌다**(변경 통지 #124·#128). 「폐기 계정」은 회계 소관이라 MES가 다루지
 * 않기로 확정됐고, 「도착지 유형」은 짝인 도착지 식별자를 공급할 자리가 함께 사라졌다 —
 * 값 목록을 기다리는 것이 아니라 **자리 자체가 없다.**
 *
 * **한 줄은 채워졌다**(2026-08-16 업무 확정 — 폐기 거래처 역할 코드). 그 줄을 지우지도, **답을
 * 바꾸지도 않는다** — 이 표가 답하는 물음은 「비면 무엇이 막히나」이지 「지금 막고 있나」가
 * 아니다. 채워졌다는 사실은 **표식(✅)으로만** 붙인다. 그래야 누군가 다시 비웠을 때 무엇이
 * 잠기는지가 표에 그대로 남아 있다. 나머지는 그대로 비어 있다.
 *
 * **출고 유형·폐기 사유는 두 자리가 한 키를 함께 쓴다.** 폐기 정보 폼이 고를 값과 이력 조건이
 * 거를 값이 **같은 공통코드**라, 갈라 두면 값이 확정될 때 채울 자리가 둘이 되고 한쪽만 채워지는
 * 순간 「고를 수는 있는데 그것으로 거를 수는 없는」 화면이 된다. 반대로 **출고 상태는 입고
 * 상태와 갈라 둔다** — 서로 다른 공통코드라 한 키로 묶으면 한쪽 확정이 다른 쪽 선택칸까지 연다.
 *
 * **승인 완료를 뜻하는 상태 코드 집합**은 `approval-progress.ts`가 갖는다 — 승인 축 판정이
 * 그 파일 한 곳에 모여 있어야 「채우면 무엇이 살아나는가」를 한 자리에서 읽는다.
 *
 * **결과의 무게**: 필수 셋이 비어 있는 동안 이 화면으로는 **폐기 요청을 등록할 수 없다.**
 * 대상 조회·줄 선택·수량 입력·처리 이력·결재 진행·기타출고 처리는 그동안에도 쓰인다.
 * 값이 확정되면 **이 파일의 배열만 채우면** 등록이 저절로 살아난다.
 *
 * 추적: 공통코드 값 목록 미확정 — 설계 저장소 이슈로 관리한다(비공개 저장소는 번호로만 참조).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.disposalIssue;

/**
 * 이 화면이 자리표시로 다루는 선택지 코드 여섯.
 *
 * **폼의 셋을 여기서 다시 적지 않는다**(`types.ts`가 정본이다) — 두 곳에 적으면 한쪽에만
 * 키가 늘어 「폼에는 있는데 값 목록에는 없는」 코드가 생기고, 그때 필수 판정이 그 칸을 세지 않는다.
 */
export type DisposalIssueCodeKey = DisposalCodeKey | 'receiptType' | 'status' | 'issueStatus';

/**
 * 계약이 **등록 필수**로 요구하는 셋.
 *
 * `sourceDocumentType`이 여기 있는 것이 눈에 걸릴 수 있다 — 원천이 입고 전표임을 가리키는
 * **구조 값**이라 사용자가 고를 성질이 아니다. 그런데도 자리표시로 두는 이유는, 그 값이
 * 무엇이어야 하는지도 아직 확정되지 않았기 때문이다.
 *
 * `reason`은 계약 스키마에서 nullable이지만 설명이 「반품·기타 출고에서는 필수」라
 * **설명을 따른다**(계획 §5.4-17).
 *
 * **다섯에서 셋으로 줄었다**(#124·#128). 줄었어도 **등록은 그대로 잠겨 있다** — 남은 셋의
 * 값 목록이 여전히 비어 있기 때문이다. 자리를 지우는 일이 사용자에게 무엇을 열어 주는 일이
 * 되어서는 안 되고, `code-options.test.ts`가 그 사실을 감지기로 고정한다.
 */
export const REQUIRED_CODE_KEYS: readonly DisposalCodeKey[] = [
  'issueType',
  'sourceDocumentType',
  'reason',
];

/** 코드마다의 값 목록. **비어 있는 것이 지금의 사실이다.** */
export type CodeValueLists = Record<DisposalIssueCodeKey, readonly string[]>;

/** 코드마다의 선택지. */
export type CodeOptionSets = Record<DisposalIssueCodeKey, SelectOption[]>;

/**
 * 값 목록 — **여섯 다 비어 있다.**
 *
 * 자리표시 값을 하나 넣어 두지 않는다. 넣으면 사용자가 그것을 고를 수 있고, 고르면
 * 서버가 모르는 코드가 되돌릴 수 없는 전표에 실린다. 조회 조건 쪽에 넣으면 결과가 늘
 * 비어 보인다.
 */
export const PLACEHOLDER_DISPOSAL_ISSUE_CODES: CodeValueLists = {
  issueType: [],
  sourceDocumentType: [],
  reason: [],
  receiptType: [],
  status: [],
  issueStatus: [],
};

/**
 * 「불량창고」를 가리는 창고 유형 코드.
 *
 * **화면이 불량창고를 판정할 수 없다**(계획 결정 2 · §5.4-5). 폐기 대상은 불량 판정을 받아
 * 들어온 자재이고 그것이 놓이는 창고가 있으나, 창고 유형의 값 목록이 확정되지 않아
 * 「이 창고가 그 창고인가」를 화면이 물을 수 없다. 그래서 지금은 **사용자가 창고를 고른다.**
 *
 * 이 배열이 채워지면 창고 선택칸이 그 유형만 보이고, 좁히지 못한다는 안내가 사라진다.
 */
export const DEFECT_WAREHOUSE_TYPE_CODES: readonly string[] = [];

/**
 * 폐기 거래처 선택지를 좁히는 **역할 코드 — 명칭·의미는 업무가 확정했다**(2026-08-16 사용자 결정).
 *
 * 거래처는 값 목록을 기다리는 **공통코드가 아니라 조회로 오는 마스터**라 위 여섯과 한 통에
 * 담지 않는다. 담으면 「코드 값이 확정되면 열린다」는 규칙이 조회에도 걸린 것처럼 읽히고,
 * 필수 코드 판정이 거래처까지 세게 된다. 그래서 여기 있는 것은 목록이 아니라
 * **목록을 좁히는 조건 한 줄**이다.
 *
 * ⚠ **영문 표기는 잠정이다.** 뜻(「폐기 처리를 담당하는 업체」)은 업무가 못 박았으나 계약(서버
 * 명세)이 아직 역할 코드 enum을 편입하지 않았다 — 그래서 이 글자는 **계약이 확정할 때까지
 * 잠정**이다. 확정되면 **제품 코드는 이 한 줄만** 바뀌고, 짝이 되는 기대값 줄은
 * `code-options.test.ts`가 가리킨다 — 그 시험이 이 글자를 **리터럴로 고정**해 다른 철자가
 * 오면 울기 때문이다. 아래 사본까지 세면 **상수 두 줄 + 기대값 두 줄**이 고칠 자리 전부다.
 *
 * **같은 글자의 짝이 하나 더 있다** — `screens/common-code/partner-role-vocab.ts`의
 * `PARTNER_ROLE_CODES.disposal`(역할을 **편집하는** 쪽의 어휘 표). 화면 슬라이스는 서로
 * import하지 않으므로 두 사본이 각자 산다. **한쪽만 고치면 아무 시험도 울지 않는다** — 이쪽을
 * 고칠 때는 저 경로를 함께 연다. (감출 수 없는 한계라 감추지 않고 적는다.)
 *
 * **이 한 줄이 선택지 조회를 여는 열쇠다**(`lookups.ts`의 `useDisposalPartnerOptions`).
 * 비면 조회 자체를 내보내지 않는다 — 빈 값으로 부르면 **좁히지 않은 거래처 전부**가 폐기 거래처
 * 선택지로 서고, 사용자는 폐기와 무관한 상대를 되돌릴 수 없는 전표에 실을 수 있다. 그 방어는
 * 채워진 뒤에도 **그대로 둔다**(`isDisposalPartnerRolePending`).
 *
 * ⭐ **거래처를 고르지 않고도 화면은 선다**(#128 §3) — 자체 폐기를 체크하면 거래처 없이 요청한다.
 *
 * ⛔ **`: string`을 떼지 않는다.** 떼면 타입이 `'DISPOSAL'` 리터럴로 좁혀지고, 화면 시험이
 * 이 상수를 갈아 끼우는 접근자 목(`screen.test.tsx`의 `get …(): string`)이 타입에서 어긋난다 —
 * 「값이 왔을 때 화면이 달라지는가」를 재는 구조가 통째로 무너진다. 군더더기로 보이는 명시
 * 타입이지만 시험이 그것에 기대고 있다.
 */
export const DISPOSAL_PARTNER_ROLE_CODE: string = 'DISPOSAL';

const toOptions = (values: readonly string[]): SelectOption[] =>
  values.map((code) => ({ value: code, label: code }));

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
 * 아직 없는데 화면이 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toCodeOptionSets = (values: CodeValueLists): CodeOptionSets => ({
  issueType: toOptions(values.issueType),
  sourceDocumentType: toOptions(values.sourceDocumentType),
  reason: toOptions(values.reason),
  receiptType: toOptions(values.receiptType),
  status: toOptions(values.status),
  issueStatus: toOptions(values.issueStatus),
});

/**
 * 필수 코드 중 **고를 값 자체가 없는** 것이 있는가.
 *
 * 참이면 사용자가 아무리 애써도 요청을 만들 수 없다 — 그 사정은 「값을 아직 안 골랐다」와
 * 다르므로 사유 문구도 갈라야 한다. 「고르세요」라고 말하는데 고를 것이 없으면 사용자는
 * 자기가 무엇을 놓쳤는지 찾다가 화면을 고장으로 읽는다.
 *
 * **조회 조건의 코드 셋은 판정에 들지 않는다** — 비어 있어도 아무것도 막지 않는다.
 *
 * 이 값을 읽어 「승인 요청」을 잠그는 자리는 `validation.ts`다. 판정을 여기 두는 이유는
 * 값이 확정될 때 **고칠 자리가 이 파일 하나**여야 하기 때문이다.
 */
export const isRequiredCodeListPending = (sets: CodeOptionSets): boolean =>
  REQUIRED_CODE_KEYS.some((key) => sets[key].length === 0);

/** 선택지가 왜 비어 있는지 밝히는 안내. **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
export const codeNote = (options: readonly SelectOption[]): string | undefined =>
  options.length === 0 ? messages.pendingCode.note : undefined;

/** 선택칸 트리거에 보이는 자리표시 문구. */
export const codePlaceholder = (): string => messages.pendingCode.placeholder;

/**
 * 창고를 유형으로 좁힐 수 있는가. **거짓이 되는 순간 화면의 안내가 사라진다.**
 *
 * 상수를 함수 안에서 직접 읽지 않고 **인자로 받는다.** 그래야 「값이 채워졌을 때 무엇이
 * 달라지는가」를 감지기가 실제로 잴 수 있다 — 안에서 읽으면 그 전환을 시험할 길이 없어
 * 자리표시가 죽은 가지가 된다.
 */
export const isDefectWarehouseTypePending = (typeCodes: readonly string[]): boolean =>
  typeCodes.length === 0;

/**
 * 폐기 거래처 선택칸이 지금 **어떤 사정인가** — 여섯 갈래(리뷰 Major B1).
 *
 * ⛔ **목록 길이로 사유를 짓지 않기 위한 타입이다.** 「비어 있다」는 사실 하나에 서로 다른
 * 사정 넷이 겹쳐 있다(역할 코드 미확정 · 오는 중 · 못 불러옴 · 0건). 길이로 판정하면 그 넷이
 * 한 낱말로 뭉개져, **못 불러온 칸이 「선택지 준비 중」이라 말하는** 형태가 된다 — 얼굴은
 * 「기다리면 열린다」인데 설명은 「다시 해야 한다」인 컨트롤이다.
 *
 * 이 한 값에서 **안내 · 자리표시 · 잠금 · 버튼 사유**가 모두 나온다. 원천이 하나면 넷이 갈릴 수
 * 없다 — 갈릴 수 있는 자리를 없애는 것이 이 타입의 목적이다.
 */
export type DisposalPartnerCondition =
  'rolePending' | 'failed' | 'loading' | 'empty' | 'truncated' | 'ready';

/**
 * 조회 상태와 역할 코드 판정을 **한 사정으로** 읽는다.
 *
 * **차례가 뜻을 정한다.** ① 부르지도 않았다(역할 코드 미확정) ② 못 받았다 ③ 오는 중이다
 * ④ 받았는데 없다 ⑤ 받았는데 잘렸다 ⑥ 받았다. **실패가 미도착보다 앞서고 미도착이 「없다」보다
 * 앞선다** — 못 받은 목록·아직 안 온 목록으로 「없다」를 판정하면 화면이 확인하지 않은 것을
 * 말하게 된다(참조 표기가 `omf-mes#47`에서 세운 차례와 같다).
 *
 * 조회 결과를 **인자로 받는다** — 훅을 여기서 부르면 이 판정을 값으로 잴 수 없고, 자리표시
 * 전환과 같은 이유로 죽은 가지가 된다.
 */
export const readDisposalPartnerCondition = (
  lookup: {
    entries: readonly SelectOption[];
    isError: boolean;
    isLoading: boolean;
    truncated: boolean;
  },
  isRolePending: boolean,
): DisposalPartnerCondition => {
  if (isRolePending) return 'rolePending';
  if (lookup.isError) return 'failed';
  if (lookup.isLoading) return 'loading';
  if (lookup.entries.length === 0) return 'empty';

  /*
   * **0건이 잘림보다 앞이다**(리뷰 Nit R-N3 — 사유와 함께 그대로 둔다). 「앞쪽 일부만 왔다」고
   * 말하면서 **고를 것을 하나도 주지 못하는** 칸이 「없다」고 말하는 칸보다 나쁘다. 두 사실이
   * 겹치는 응답(0건인데 전체 건수가 더 큼)은 이 훅이 쪽 인자를 싣지 않아 계약상 오기 어렵다.
   */
  return lookup.truncated ? 'truncated' : 'ready';
};

/**
 * 사정마다의 **표기와 잠금 — 한 표에 모은다.**
 *
 * ⛔ **`Record`가 갈래 빠짐을 타입으로 잡는다**(리뷰 Minor R-M2 · 실측으로 택일). 앞 판은 표기
 * 둘이 각자 `switch`였고 반환 타입이 `string | undefined`라, **유니온에 갈래가 늘어도 아무도
 * 울지 않고** 그 갈래는 조용히 「안내도 자리표시도 없는 잠긴 칸」이 됐다(리뷰가 일곱째 갈래를
 * 심어 실증). 같은 슬라이스의 두 전례를 실제로 재 보고 이 형태를 골랐다:
 *
 * | 형태 | 일곱째 갈래를 심으면 | 비고 |
 * | --- | :-: | --- |
 * | `switch`의 `default`에 `satisfies never` | **TS1360으로 잡는다** | 소비처마다 한 줄씩 필요하고, `canChooseDisposalPartner` 같은 **식**은 스위치로 다시 써야 잡힌다 |
 * | **`Record<K, …>` 한 표**(채택) | **TS2741로 잡는다** | 한 자리에서 셋을 함께 잡는다. 게다가 **한 사정의 세 표기가 한 줄에** 모여 서로 어긋날 수 없다 |
 *
 * 뒤엣것이 이 회차의 명제(「원천이 하나면 갈릴 수 없다」)를 **갈래가 늘어도** 지킨다 —
 * 새 갈래를 더하면 그 줄의 안내·자리표시·잠금을 **함께** 정하지 않고는 빌드가 되지 않는다.
 *
 * **안내는 「오는 중」에 두지 않는다** — 트리거 글자가 이미 그 사실을 말하고 있고, 잠깐 섰다
 * 사라지는 문장은 읽히기 전에 없어진다.
 */
const DISPOSAL_PARTNER_SURFACES: Record<
  DisposalPartnerCondition,
  { note?: string; placeholder?: string; canChoose: boolean }
> = {
  rolePending: {
    note: messages.pendingCode.note,
    placeholder: messages.pendingCode.placeholder,
    canChoose: false,
  },
  /* 조건 줄의 「이름 목록…다시 시도해 주세요」를 돌려쓰지 않는다 — 이 칸에는 다시 시도가 없다. */
  failed: {
    note: t.form.partnerFailedNote,
    placeholder: t.form.partnerFailedPlaceholder,
    canChoose: false,
  },
  loading: { placeholder: t.values.referenceLoading, canChoose: false },
  empty: {
    note: t.form.partnerEmptyNote,
    placeholder: t.form.partnerEmptyPlaceholder,
    canChoose: false,
  },
  /* 잘려도 **고를 수 있다** — 잠그면 보이는 선택지를 고를 수 없는 칸이 된다. */
  truncated: { note: t.form.partnerTruncatedNote, canChoose: true },
  ready: { canChoose: true },
};

/** 그 칸 아래에 서는 안내. **고를 수 있으면 없다** — 남으면 화면이 거짓말을 한다. */
export const disposalPartnerNote = (condition: DisposalPartnerCondition): string | undefined =>
  DISPOSAL_PARTNER_SURFACES[condition].note;

/**
 * 트리거에 서는 글자. **고를 것이 있으면 없다**(고른 값이나 기본 자리표시가 선다).
 *
 * 위 안내와 **같은 줄에서 나온다** — 이것이 B1이 겨눈 자리다. 트리거는 폭에 갇혀 잘리므로
 * 사정만 짧게 적고, 할 수 있는 조치는 안내가 말한다.
 */
export const disposalPartnerPlaceholder = (
  condition: DisposalPartnerCondition,
): string | undefined => DISPOSAL_PARTNER_SURFACES[condition].placeholder;

export const canChooseDisposalPartner = (condition: DisposalPartnerCondition): boolean =>
  DISPOSAL_PARTNER_SURFACES[condition].canChoose;

/**
 * 폐기 거래처 목록을 **좁힐 수 있는가.** 참이면 선택지 조회를 아예 내보내지 않는다.
 *
 * **공백만인 값은 채워진 것이 아니다.** 그대로 질의에 실으면 서버는 좁힐 근거가 없는 조건을
 * 받고, 화면은 좁혔다고 믿은 목록을 폐기 거래처 선택지로 세운다 — 좁힘이 실패한 것을
 * 성공으로 읽는 이 형태가 값 목록 자리표시에서 가장 조용한 결함이다.
 *
 * 위 두 판정과 같은 이유로 **코드를 인자로 받는다** — 함수 안에서 상수를 직접 읽으면
 * 「채워졌을 때 무엇이 달라지는가」를 감지기가 잴 수 없어 자리표시가 죽은 가지가 된다.
 */
export const isDisposalPartnerRolePending = (roleTypeCode: string): boolean =>
  roleTypeCode.trim() === '';

/**
 * 창고 선택지를 폐기 대상 창고 유형으로 좁힌다.
 *
 * **좁힐 수 없으면 전부 낸다.** 값 목록이 없다고 빈 목록을 내면 사용자가 아무 창고도 고를 수
 * 없어 화면이 통째로 막힌다 — 좁히지 못한다는 사실은 안내가 말하고, 고르는 것은 사용자가 한다.
 *
 * **좁힌 결과가 비는 것은 그대로 낸다.** 맞는 유형이 하나도 없으면 그것이 사실이며,
 * 전체로 되돌리면 좁혔다고 말하면서 좁히지 않은 목록을 보이는 셈이 된다.
 *
 * 유형 코드를 인자로 받는 이유는 **채워졌을 때 무엇이 달라지는지를 잴 수 있게** 하기 위해서다.
 * 상수를 함수 안에서 직접 읽으면 그 전환을 시험할 길이 없다.
 */
export const narrowToDefectWarehouses = (
  entries: readonly WarehouseEntry[],
  typeCodes: readonly string[],
): WarehouseEntry[] =>
  typeCodes.length === 0
    ? [...entries]
    : entries.filter((entry) => typeCodes.includes(entry.warehouseTypeCode));
