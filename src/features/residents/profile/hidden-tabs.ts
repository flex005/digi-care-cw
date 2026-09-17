/**
 * How many tabs sit wholly or partly outside the visible part of the strip, on
 * each side.
 *
 * **A tab half off the edge counts as hidden**: its name is cut, and a reader
 * who cannot read a tab's name has not been shown it.
 */
export function hiddenTabs(
  tabs: { left: number; right: number }[],
  view: { left: number; right: number },
): { before: number; after: number } {
  const slack = 1
  return {
    before: tabs.filter((tab) => tab.left < view.left - slack).length,
    after: tabs.filter((tab) => tab.right > view.right + slack).length,
  }
}
