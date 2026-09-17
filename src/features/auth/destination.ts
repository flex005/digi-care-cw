/**
 * Where signing in lands: the page somebody was on their way to, or the start.
 *
 * `RequireSignIn` sends a signed-out reader to `/sign-in?from=<where they were
 * going>`. Phase 1 carried the parameter and nothing read it, so a link to a
 * resident's record opened the start page after signing in: the reader had to
 * find the person again, and the link they followed did not do what it said.
 *
 * **Read once, where the address still carries it**, by the sign-in screen as it
 * mounts, and held on the pending sign-in from there. The steps after it (the
 * code, the choice of home) are reached by navigation that drops the query,
 * which is how `?timeout=` was lost in Phase 1.
 *
 * **Only a page inside this product.** Anything that is not a path on this
 * origin, or is a sign-in step itself, lands on the start: an address that sent
 * somebody elsewhere after they signed in would be a redirect anybody could
 * write.
 */
const NOT_A_DESTINATION = [
  '/sign-in',
  '/signed-out',
  '/sign-out',
  '/forgot-password',
  '/invitation',
]

export function destinationFrom(search: string): string {
  const from = new URLSearchParams(search).get('from')
  if (from === null || !from.startsWith('/') || from.startsWith('//')) return '/'
  const path = from.split(/[?#]/)[0] ?? ''
  if (NOT_A_DESTINATION.some((step) => path === step || path.startsWith(`${step}/`)))
    return '/'
  return from
}
