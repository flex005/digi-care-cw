/**
 * A quantity with the unit it is counted in: "2.5ml", "1 tablet", "5 patches".
 * Ported from the Admin build's `units.ts`, one definition because "1 tablets"
 * turned up twice there when it was written at the call site.
 *
 * Millilitres close up against the figure; things that are counted take a
 * space and lose their plural at one.
 */
export function quantityWithUnit(quantity: number, unit: string): string {
  if (unit === 'ml') return `${quantity}ml`
  return `${quantity} ${unitFor(quantity, unit)}`
}

/** The unit word alone, agreeing with the figure it sits beside. */
export function unitFor(quantity: number, unit: string): string {
  if (unit === 'ml') return 'ml'
  return quantity === 1 ? singular(unit) : unit
}

function singular(unit: string): string {
  if (unit.endsWith('es')) return unit.slice(0, -2)
  if (unit.endsWith('s')) return unit.slice(0, -1)
  return unit
}
