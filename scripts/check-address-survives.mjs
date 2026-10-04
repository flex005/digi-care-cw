/**
 * Both query parameters still reach the product after signing in.
 *
 * **This protects a fix that nothing else can see.** `?at=` and `?terms=` are
 * read once at module load, and signing in rewrites the address — a reviewer
 * who opens `/incidents?at=20:20&terms=subject:service_user` is sent to
 * `/sign-in?from=%2Fincidents`, and anything read after that finds nothing.
 * `src/lib/first-address.ts` captures the address on the first browser load so
 * both parameters derive from one reading, and its correctness depends on that
 * module being evaluated before the rewrite.
 *
 * **Nothing in the test suite can check it.** Both suites call
 * `vi.resetModules()`, write the address and import in the same breath, so the
 * address is always right at the moment of the read. That is exactly how
 * `?terms=` shipped not working at all, with thirteen green tests over it
 * (CLAUDE.md §8). The only check that can fail for the real reason is one that
 * drives the product the way a reader does.
 *
 * **It is not in `npm run verify`**, because it needs a dev server and a
 * browser. Run it with `npm run check:address` before a phase that touches the
 * shell, the fixtures' imports, or either parameter.
 *
 * Every step is named, and a failure says which step and what it expected,
 * rather than a timeout on a selector — a crawl that reports "no element found"
 * sends the next person looking at the wrong thing.
 *
 * **What it cannot catch, stated rather than implied.** Making the clock read
 * `location.search` for itself again still passes, because `clock.ts` is pulled
 * in by the fixtures and those are loaded on the first render whichever way a
 * reader comes in. The clock half of this check fires if the parameter stops
 * being read at all, or if the sign-in screen stops needing the fixtures — the
 * second being exactly the incidental arrangement `first-address.ts` exists to
 * stop depending on. The vocabulary half has no such accident behind it and
 * fails the moment its module reads the address for itself.
 */
import { spawn } from 'node:child_process'

const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3000'
const DEVTOOLS = process.env.DEVTOOLS ?? 'http://127.0.0.1:9222'

/**
 * A pinned instant and a vocabulary this build does not use by default.
 *
 * **`20:20` was the first choice and it made the clock half of this check
 * vacuous.** With no `?at=` the record is drawn twenty minutes into the nearest
 * round, and the rounds are 08:00, 14:00, 18:00 and 20:00 — so between 20:20
 * and the next morning the fallback produces exactly 20:20, and the assertion
 * was true whether or not the parameter had been read. Found by mutation: the
 * clock was made to ignore `?at=` outright and this still passed. §8's shape of
 * an assertion that could not have disagreed with the code.
 *
 * `09:37` is not a round plus twenty minutes and so cannot be reached by the
 * fallback, and the line is asked for the words that only a readable request
 * produces as well as for the digits.
 */
const AT = '09:37'
const SAYS_REQUESTED = 'the time you asked for'
const TERMS = 'subject:service_user'
/**
 * One converted sentence, under each vocabulary.
 *
 * **A whole sentence rather than a word, and one sentence rather than the
 * page.** "No `resident` anywhere on screen" cannot be asserted while the
 * migration is part done — the rail still says Residents, and will until its
 * phase lands — so an absence check over the page would fail for a reason that
 * is not this check's subject. A sentence that a converted call site renders
 * can be asserted in both directions: the chosen word is there and this build's
 * own word is not, on that sentence.
 */
const SAYS_CHOSEN = 'A service user — choose the person below.'
const SAYS_DEFAULT = 'A resident — choose the person below.'

function fail(step, said) {
  console.error(`✖ address survives — ${step}\n  ${said}\n`)
  console.error(
    '  Both parameters are read once, on the first browser load, through\n' +
      '  src/lib/first-address.ts. A module that reads location.search itself, or\n' +
      '  one that is first imported after signing in has rewritten the address,\n' +
      '  will read nothing and draw nothing — silently, and with a green suite.\n',
  )
  process.exit(1)
}

const browser = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    `--remote-debugging-port=${new URL(DEVTOOLS).port}`,
    '--user-data-dir=/tmp/digi-care-cw-address-check',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

/** Waits for something to answer, rather than sleeping and hoping. */
async function reachable(url, what) {
  for (let tries = 0; tries < 60; tries += 1) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((ok) => setTimeout(ok, 250))
    }
  }
  browser.kill()
  fail(`waiting for ${what}`, `${url} never answered.`)
}

await reachable(`${ORIGIN}/incidents`, 'the dev server')
await reachable(`${DEVTOOLS}/json/version`, 'the browser')

const page = (await (await fetch(`${DEVTOOLS}/json/list`)).json()).find(
  (target) => target.type === 'page',
)
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((ok) => (socket.onopen = ok))

let id = 0
const waiting = new Map()
socket.onmessage = (event) => {
  const message = JSON.parse(event.data)
  const waiter = waiting.get(message.id)
  if (waiter === undefined) return
  waiting.delete(message.id)
  waiter(message)
}
const send = (method, params = {}) =>
  new Promise((ok) => {
    const n = (id += 1)
    waiting.set(n, ok)
    socket.send(JSON.stringify({ id: n, method, params }))
  })

const settle = (ms) => new Promise((ok) => setTimeout(ok, ms))

async function evaluate(expression) {
  const { result } = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  return result?.result?.value
}

async function clickText(text) {
  const found = await evaluate(`(() => {
    const want = ${JSON.stringify(text)}.toLowerCase()
    const where = document.querySelector('[role="dialog"]') ?? document
    const el = [...where.querySelectorAll('button, a, label')].find((node) =>
      (node.textContent || '').trim().toLowerCase().startsWith(want))
    if (!el) return false
    el.scrollIntoView({ block: 'center' })
    el.click()
    return true
  })()`)
  await settle(500)
  return found
}

await send('Page.enable')
await send('Runtime.enable')

/**
 * Two ways in, because only one of them loses the parameters.
 *
 * **Opening a product URL does not exercise the defect.** The route mounts the
 * shell for a moment before the redirect, so a module reading
 * `location.search` for itself still finds the parameters there and the check
 * passes with the bug in place — which is what the first version of this file
 * did, and the mutation caught it rather than the other way round. Entering on
 * the sign-in screen is the path that breaks: nothing of the product mounts,
 * so anything reached through the shell loads after the address has been
 * rewritten and reads nothing.
 *
 * Both are real — a reviewer pastes either — so both are driven, and the
 * failure names which way in it was.
 */
async function signInAndCheck(entry, how) {
  await send('Page.navigate', { url: entry })
  await settle(1300)
  if (!/sign-in/.test(await evaluate('location.pathname')))
    fail(
      `${how}: expected to be asked to sign in`,
      `landed on ${String(await evaluate('location.pathname'))} — the flow this checks no longer happens, so the check is testing nothing.`,
    )

  if (!(await clickText('Tolu Akinyemi')))
    fail(`${how}: signing in`, 'no demonstration person to sign in as on /sign-in.')
  if (!(await clickText('Log in'))) fail(`${how}: signing in`, 'no "Log in" control.')
  await settle(900)
  if ((await evaluate('location.pathname')) === '/sign-in/code') {
    await evaluate(
      `(() => { const i = document.querySelector('input'); if (i) i.focus() })()`,
    )
    await send('Input.insertText', { text: '482915' })
    await settle(300)
    if (!(await clickText('Verify')))
      fail(`${how}: signing in`, 'no "Verify" control on the code step.')
    await settle(1200)
  }
  if ((await evaluate('location.pathname')) === '/sign-in/home') {
    if (!(await clickText('Rosewood Court')))
      fail(`${how}: signing in`, 'no home to choose on the site selector.')
    await settle(900)
    // Choosing a home and confirming it are two acts for somebody at two homes.
    if ((await evaluate('location.pathname')) === '/sign-in/home') {
      await clickText('Continue')
      await settle(1200)
    }
  }
  if (/sign-in/.test(await evaluate('location.pathname')))
    fail(
      `${how}: signing in`,
      `still on ${String(await evaluate('location.pathname'))}.`,
    )

  /* The rewrite is the whole reason this check exists. */
  if ((await evaluate('location.search')).includes('terms='))
    fail(
      `${how}: signed in, and the address still carries the parameters`,
      'the rewrite this check exists for no longer happens, so a module reading location.search would pass by accident. Re-read src/lib/first-address.ts before deleting this check.',
    )

  await evaluate(
    `[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/incidents')?.click()`,
  )
  await settle(1100)
  if ((await evaluate('location.pathname')) !== '/incidents')
    fail(
      `${how}: reaching the incidents screen`,
      `landed on ${String(await evaluate('location.pathname'))}.`,
    )

  const line = await evaluate(
    `(() => { const p = document.querySelector('p[data-moved-clock]'); return p ? p.innerText.replace(/\\s+/g, ' ') : null })()`,
  )
  if (line === null || !line.includes(AT) || !line.includes(SAYS_REQUESTED))
    fail(
      `${how}: signed in, and the instant asked for did not survive`,
      `the shell line reads ${JSON.stringify(line)}; it should carry ${AT} and say "${SAYS_REQUESTED}". ?at= was read after the address was rewritten, or was not read at all.`,
    )

  /* The report form, which is where this module's converted sentences are. */
  if (!(await clickText('Report an incident')))
    fail(
      `${how}: opening the report form`,
      'no "Report an incident" control on the incidents screen.',
    )
  await settle(900)
  const form = await evaluate(
    `(() => { const d = document.querySelector('[role="dialog"]'); return d ? d.innerText.replace(/\\s+/g, ' ') : null })()`,
  )
  if (form === null) fail(`${how}: opening the report form`, 'the dialog did not open.')

  if (!form.includes(SAYS_CHOSEN))
    fail(
      `${how}: signed in, and the vocabulary asked for did not survive`,
      `the report form does not say ${JSON.stringify(SAYS_CHOSEN)}. ?terms= was read after the address was rewritten, so the override did nothing.`,
    )
  if (form.includes(SAYS_DEFAULT))
    fail(
      `${how}: signed in, and a converted sentence still says this build’s own word`,
      `the report form says ${JSON.stringify(SAYS_DEFAULT)} under a vocabulary that does not use that word, so the call site is not asking the vocabulary.`,
    )
}

const WAYS_IN = [
  [`${ORIGIN}/incidents?at=${AT}&terms=${TERMS}`, 'opened a product URL'],
  [`${ORIGIN}/sign-in?at=${AT}&terms=${TERMS}`, 'opened the sign-in screen'],
]

for (const [entry, how] of WAYS_IN) await signInAndCheck(entry, how)

console.log(
  `✓ address survives — ${String(WAYS_IN.length)} ways in (${WAYS_IN.map((w) => w[1]).join('; ')}), ` +
    `each signed in through the demonstration list, each finding the pinned instant in ` +
    `the shell line and ${JSON.stringify(SAYS_CHOSEN)} on the report form with this ` +
    `build's own wording gone from it. Only the second way in loses the parameters ` +
    `without src/lib/first-address.ts; the first mounts the shell before the redirect ` +
    `and would pass with the defect in place. It says nothing about any other screen, ` +
    `and nothing about whether the words read well.`,
)

socket.close()
browser.kill()
process.exit(0)
