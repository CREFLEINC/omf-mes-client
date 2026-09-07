/**
 * 명령줄로 라벨 찍기 — **셸을 띄우지 않고 한 장을 보낸다**(#831).
 *
 * ⭐ **왜 필요한가.** 현장 단말은 키오스크라 메뉴도 개발자도구도 없고, 서버가 명령형을 내려
 *   주기 전까지 화면을 눌러서는 이 경로에 닿지 않는다. 실기에서 좌표·글자 크기·농도를 맞추려면
 *   값을 바꿔 가며 여러 장을 뽑아 봐야 하는데, 그 반복을 명령 한 줄로 돌린다. 사양서도
 *   「최종 좌표와 폰트 크기는 실물 출력 검증 후 보정한다」고 그 절차를 전제한다.
 *
 * ```
 * "OMF-MES POP.exe" --print-sample lot
 * "OMF-MES POP.exe" --print-label C:\label.json
 * ```
 *
 * ⛔ **값이 빠진 라벨을 찍지 않는다.** 라벨은 나오는 순간 자재에 붙고, 빈 칸이 있는 라벨은
 *    그 자재의 이력을 끊는다 — 무엇이 없는지 말하고 아무것도 찍지 않는 편이 낫다.
 */

import {
  type LotLabelFields,
  SAMPLE_LOT,
  SAMPLE_SHIPPING,
  type ShippingLabelFields,
  buildLotLabel,
  buildShippingLabel,
} from './tspl-label';

/** 어떤 라벨인가. 사양서가 정의한 두 가지다. */
export type LabelKind = 'lot' | 'shipping';

export type LabelCommand =
  /** 사양서 예시 그대로의 견본. 실기에서 규격·판독을 볼 때 쓴다. */
  | { kind: 'sample'; label: LabelKind }
  /** 값을 담은 파일. 좌표·크기를 맞추며 여러 장을 뽑을 때 쓴다. */
  | { kind: 'file'; path: string };

export class LabelCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LabelCommandError';
  }
}

const KINDS: readonly LabelKind[] = ['lot', 'shipping'];

const isKind = (value: string | undefined): value is LabelKind =>
  KINDS.includes(value as LabelKind);

/**
 * 명령줄에서 라벨 명령을 읽는다. **없으면 아무것도 돌려주지 않는다** — 평소 기동을 막지 않는다.
 *
 * ⚠ Electron 은 자기 인자를 함께 싣는다(`--inspect` 등). 우리 깃발만 골라 본다.
 */
export function parseLabelCommand(argv: readonly string[]): LabelCommand | undefined {
  const at = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);

    return index === -1 ? undefined : argv[index + 1];
  };

  if (argv.includes('--print-sample')) {
    const label = at('--print-sample');

    if (!isKind(label)) {
      throw new LabelCommandError(`--print-sample 은 ${KINDS.join(' 또는 ')} 다: ${String(label)}`);
    }

    return { kind: 'sample', label };
  }

  if (argv.includes('--print-label')) {
    const path = at('--print-label');

    if (path === undefined || path.startsWith('--')) {
      throw new LabelCommandError('--print-label 에 값 파일 경로가 없다');
    }

    return { kind: 'file', path };
  }

  return undefined;
}

/**
 * 사람이 손으로 적은 JSON 을 읽는다.
 *
 * ⚠ **맨 앞의 BOM 을 걷어낸다.** 메모장은 UTF-8 로 저장할 때 보이지 않는 표식을 앞에 붙이고,
 *   그대로 넘기면 `JSON.parse` 가 첫 글자에서 던진다 — 파일은 멀쩡해 보이는데 앱만 「형식이
 *   틀렸다」고 해서 사람이 원인을 찾을 수 없다.
 * ⚠ 무엇이 틀렸는지 말한다. 「Unexpected token」만 나오면 어느 파일인지도 알 수 없다.
 */
export function parseHandWrittenJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\ufeff/, ''));
  } catch {
    throw new LabelCommandError('JSON 형식이 아니다 — 쉼표·따옴표를 확인해라');
  }
}

/**
 * 값 파일을 라벨로 바꾼다.
 *
 * 파일은 `{ "label": "lot" | "shipping", ... }` 꼴이고 나머지 칸은 사양서 §5.2·§6.2 의
 * 필수 항목이다. **하나라도 비면 던진다.**
 */
export function buildLabelFromFields(source: unknown): string {
  if (typeof source !== 'object' || source === null) {
    throw new LabelCommandError('값 파일이 객체가 아니다');
  }

  const value = source as Record<string, unknown>;
  const label = value.label;

  if (!isKind(typeof label === 'string' ? label : undefined)) {
    throw new LabelCommandError(`label 은 ${KINDS.join(' 또는 ')} 다: ${String(label)}`);
  }

  const missing: string[] = [];
  const need = (name: string): string => {
    const raw = value[name];
    const text = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';

    if (text === '') missing.push(name);

    return text;
  };

  const optional = (name: string): string | undefined => {
    const raw = value[name];

    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;
  };

  const built = label === 'lot' ? lotFrom(need, optional('extra')) : shippingFrom(need);

  /* ⛔ 무엇이 없는지 **한 번에** 말한다. 하나씩 알려 주면 그만큼 종이가 나간다. */
  if (missing.length > 0) {
    throw new LabelCommandError(`값이 빠졌다: ${missing.join(', ')}`);
  }

  return built;
}

function lotFrom(need: (name: string) => string, extra: string | undefined): string {
  const fields: LotLabelFields = {
    type: need('type'),
    status: need('status'),
    partNo: need('partNo'),
    partName: need('partName'),
    lotNo: need('lotNo'),
    qty: need('qty'),
    uom: need('uom'),
    dateCaption: need('dateCaption'),
    dateTime: need('dateTime'),
    extra,
  };

  return buildLotLabel(fields);
}

function shippingFrom(need: (name: string) => string): string {
  const fields: ShippingLabelFields = {
    type: need('type'),
    status: need('status'),
    shipTo: need('shipTo'),
    customerPartNo: need('customerPartNo'),
    partNo: need('partNo'),
    partName: need('partName'),
    lotNo: need('lotNo'),
    qty: need('qty'),
    uom: need('uom'),
    boxNo: need('boxNo'),
    shipmentNo: need('shipmentNo'),
    shipDateTime: need('shipDateTime'),
  };

  return buildShippingLabel(fields);
}

/** 견본 한 장. 사양서 예시 그대로다 — 업무 자료가 아니다. */
export const sampleLabel = (label: LabelKind): string =>
  label === 'lot' ? buildLotLabel(SAMPLE_LOT) : buildShippingLabel(SAMPLE_SHIPPING);
