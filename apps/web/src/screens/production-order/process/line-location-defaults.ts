export const lineLocationDefaults = (
  line:
    { defaultWipLocationId?: number | null; defaultScrapLocationId?: number | null } | undefined,
) => ({
  defaultWipLocationId: line?.defaultWipLocationId == null ? '' : String(line.defaultWipLocationId),
  defaultScrapLocationId:
    line?.defaultScrapLocationId == null ? '' : String(line.defaultScrapLocationId),
});
