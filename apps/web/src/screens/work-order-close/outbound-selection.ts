import type { WorkOrderCloseOutboundItemSetting } from './queries';

export type WorkOrderCloseOutboundItemCode = WorkOrderCloseOutboundItemSetting['outboundItemCode'];

export type WorkOrderCloseOutboundSelection = Readonly<
  Partial<Record<WorkOrderCloseOutboundItemCode, boolean>>
>;

export const workOrderCloseOutboundSelectionFrom = (
  settings: readonly WorkOrderCloseOutboundItemSetting[],
): WorkOrderCloseOutboundSelection =>
  Object.fromEntries(settings.map((setting) => [setting.outboundItemCode, setting.enabled]));

export const isWorkOrderCloseOutboundItemSelected = (
  selection: WorkOrderCloseOutboundSelection,
  code: WorkOrderCloseOutboundItemCode,
): boolean => selection[code] ?? false;

export const toggleWorkOrderCloseOutboundItem = (
  selection: WorkOrderCloseOutboundSelection,
  setting: WorkOrderCloseOutboundItemSetting,
): WorkOrderCloseOutboundSelection =>
  setting.locked
    ? selection
    : {
        ...selection,
        [setting.outboundItemCode]: !isWorkOrderCloseOutboundItemSelected(
          selection,
          setting.outboundItemCode,
        ),
      };

export const selectedWorkOrderCloseOutboundItemCodes = (
  settings: readonly WorkOrderCloseOutboundItemSetting[],
  selection: WorkOrderCloseOutboundSelection,
): WorkOrderCloseOutboundItemCode[] =>
  settings
    .filter((setting) => isWorkOrderCloseOutboundItemSelected(selection, setting.outboundItemCode))
    .map((setting) => setting.outboundItemCode);
