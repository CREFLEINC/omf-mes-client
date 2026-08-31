import { messages } from '@omf-mes/i18n';

/**
 * 이 화면이 다루는 코드 값.
 *
 * ⭐ **상태 네 값은 서버가 파생한다** — 게시 여부와 오늘 날짜로 정해지는 값이고 저장 컬럼이
 * 아니다. ⛔ 그래서 **상태를 직접 쓰는 액션을 만들지 않는다.** 「내려버리기」도 상태를 바꾸는
 * 것이 아니라 종료일을 당기는 것이다.
 *
 * ⚠ **범위 다섯 중 둘만 1차에서 유효하다.** 나머지 셋은 계약이 값 목록에는 두었지만 서버가
 * 거부한다 — 감추지 않고 **고를 수 없게 하고 사유를 적는다.** 감추면 「왜 없는가」를 물을
 * 자리가 사라지고, 나중에 열릴 때 무엇이 열렸는지도 알 수 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.notice;

export const STATUS_CODES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'CLOSED'] as const;

export type StatusCode = (typeof STATUS_CODES)[number];

const isStatusCode = (value: string): value is StatusCode =>
  (STATUS_CODES as readonly string[]).includes(value);

/** 모르는 코드는 그대로 보인다 — 지어낸 이름으로 덮지 않는다. */
export const statusLabel = (code: string): string => (isStatusCode(code) ? t.status[code] : code);

export const SCOPE_CODES = [
  'COMPANY',
  'WORK_ORDER',
  'BUSINESS_UNIT',
  'EQUIPMENT_GROUP',
  'WORK_SHIFT',
] as const;

export type ScopeCode = (typeof SCOPE_CODES)[number];

const isScopeCode = (value: string): value is ScopeCode =>
  (SCOPE_CODES as readonly string[]).includes(value);

export const scopeLabel = (code: string): string => (isScopeCode(code) ? t.scope[code] : code);

/** ⚠ 1차에 실제로 쓸 수 있는 범위. 나머지는 서버가 400 으로 거부한다. */
export const SUPPORTED_SCOPES: readonly ScopeCode[] = ['COMPANY', 'WORK_ORDER'];

export const isSupportedScope = (code: string): boolean =>
  (SUPPORTED_SCOPES as readonly string[]).includes(code);

/** 이 범위가 작업지시를 함께 요구하는가. 짝이 어긋나면 서버가 거부한다. */
export const needsWorkOrder = (code: string): boolean => code === 'WORK_ORDER';

/**
 * 이 공지를 아직 고칠 수 있는가.
 *
 * ⛔⛔ **게시하면 본문이 잠긴다.** 고치면 이미 확인한 사람이 다른 것을 본 것이 되고, 확인
 * 이력이 무엇에 대한 확인인지 알 수 없어진다 — 서버도 409 로 막는다. 화면이 먼저 잠근다.
 */
export const isEditable = (statusCode: string): boolean => statusCode === 'DRAFT';

/** 게시할 수 있는가 — 아직 게시하지 않은 것만. */
export const isPublishable = (statusCode: string): boolean => statusCode === 'DRAFT';

/** 내릴 수 있는가 — 이미 끝난 것을 다시 내리지 않는다. */
export const isClosable = (statusCode: string): boolean =>
  statusCode === 'SCHEDULED' || statusCode === 'PUBLISHED';
