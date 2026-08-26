import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

type WorkOrderRelease = components['schemas']['WorkOrderRelease'];

const t = messages.workOrderRelease.input;

export interface WorkOrderReleaseDraft {
  lotSizeText: string;
  handoverNote: string;
}

export interface WorkOrderReleasePreview {
  slotCount: number;
  isSingleSlotWarning: boolean;
}

export interface WorkOrderReleaseDraftEvaluation {
  body: WorkOrderRelease | null;
  lotSizeError: string | null;
  preview: WorkOrderReleasePreview | null;
}

export const EMPTY_WORK_ORDER_RELEASE_DRAFT: WorkOrderReleaseDraft = {
  lotSizeText: '',
  handoverNote: '',
};

interface DecimalParts {
  coefficient: bigint;
  scale: number;
}

const decimalPartsOf = (value: number): DecimalParts | null => {
  const matched = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(value.toString());
  if (matched === null || matched[1] === undefined) return null;

  const fraction = matched[2] ?? '';
  const exponent = Number(matched[3] ?? '0');
  return {
    coefficient: BigInt(`${matched[1]}${fraction}`),
    scale: fraction.length - exponent,
  };
};

const slotCountOf = (orderQty: number, lotSize: number): number | null => {
  const order = decimalPartsOf(orderQty);
  const size = decimalPartsOf(lotSize);
  if (order === null || size === null || size.coefficient === 0n) return null;

  // JSON 숫자가 나타내는 10진 값을 정수 비율로 바꿔 올림한다. 부동소수점 나눗셈은
  // 0.07 / 0.01을 7.000000000000001로 만들고, 전역 EPS 보정은 실제 나머지까지 지운다.
  const scaleDifference = size.scale - order.scale;
  const numerator =
    scaleDifference >= 0 ? order.coefficient * 10n ** BigInt(scaleDifference) : order.coefficient;
  const denominator =
    scaleDifference >= 0 ? size.coefficient : size.coefficient * 10n ** BigInt(-scaleDifference);
  const slotCount = (numerator + denominator - 1n) / denominator;

  return slotCount > 0n && slotCount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(slotCount) : null;
};

export const evaluateWorkOrderReleaseDraft = (
  draft: WorkOrderReleaseDraft,
  orderQty: number | null,
): WorkOrderReleaseDraftEvaluation => {
  if (orderQty === null || !Number.isFinite(orderQty) || orderQty <= 0) {
    return { body: null, lotSizeError: null, preview: null };
  }

  const lotSizeText = draft.lotSizeText.trim();
  if (lotSizeText === '') {
    return { body: null, lotSizeError: t.errors.lotSizeRequired, preview: null };
  }

  const lotSize = Number(lotSizeText);
  if (!Number.isFinite(lotSize)) {
    return { body: null, lotSizeError: t.errors.lotSizeNotNumber, preview: null };
  }
  if (lotSize <= 0) {
    return { body: null, lotSizeError: t.errors.lotSizeNotPositive, preview: null };
  }

  const slotCount = slotCountOf(orderQty, lotSize);
  if (slotCount === null) {
    return { body: null, lotSizeError: t.errors.slotCountUnsafe, preview: null };
  }

  const handoverNote = draft.handoverNote.trim();
  return {
    body: {
      lotSize,
      ...(handoverNote === '' ? {} : { handoverNote }),
    },
    lotSizeError: null,
    preview: { slotCount, isSingleSlotWarning: lotSize >= orderQty },
  };
};
