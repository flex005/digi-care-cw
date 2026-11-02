/**
 * Every address under `/m` resolves to this, and it draws nothing.
 *
 * **The app lives in the layout, not the page**, so moving between places never
 * replaces the document: the stack, every screen on it and their scroll survive.
 * This page exists so a link to `/m/people/<id>` is an address the server
 * answers; `PhoneApp` reads it once, on arrival, and turns it into a stack.
 */
export function PhoneAddress() {
  return null
}
