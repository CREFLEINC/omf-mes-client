export const lineLocationDefaults = (
  line:
    { defaultWipLocationId?: number | null } | undefined,
) => ({
  defaultWipLocationId: line?.defaultWipLocationId == null ? '' : String(line.defaultWipLocationId),
});
