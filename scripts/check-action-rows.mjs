/**
 * The phone's action rows are never stacked, measured in a browser.
 *
 * **What it holds.** At 390 wide: on Today, a senior carer's two actions sit
 * side by side on one line, sharing the width, neither on a row of its own.
 * In the care note composer, the four suggested openers for Medication are
 * a rail: it scrolls sideways, and the third opener is
 * partly on the screen and partly past its edge, rather than absent or whole.
 *
 * **Nothing in the test suite can check it**: it is layout, and jsdom has none.
 * `action-row.test.tsx` holds which shape a count gets; this measures it.
 *
 * **What it cannot see**: any other count or label length than these two
 * rows, and whether a chip cut at the edge reads as more to come. Those are a
 * screenshot's question.
 *
 * **It is not in `npm run verify`**: it needs the dev server on localhost:3000
 * and Chrome. Run it with `npm run check:action-rows` after a change to an
 * action row, the gutter or the phone's type scale.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3000'
const PORT = Number(process.env.DEVTOOLS_PORT ?? 9335)
const WIDTH = 390
const HEIGHT = 844
/* 20:20 BST on 16/09/2026: a senior carer has late things, so Today has two actions (CLAUDE.md §8). */
const AT = '2026-09-16T19:20:00Z'

const browser = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    `--remote-debugging-port=${String(PORT)}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'digi-care-cw-action-rows-'))}`,
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

function fail(step, said) {
  console.error(`✖ action rows — ${step}\n  ${said}\n`)
  console.error(
    '  An action row is never stacked (ActionRow, docs/MOBILE_APP_SHELL.md §1).\n' +
      '  One or two share the width; three or more are a rail that scrolls sideways\n' +
      '  and is cut at the screen edge, so the next action shows there is more.\n',
  )
  browser.kill()
  process.exit(1)
}

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))

/** Waits for something to answer, rather than sleeping and hoping. */
async function reachable(url, what) {
  for (let tries = 0; tries < 60; tries += 1) {
    try {
      await fetch(url)
      return
    } catch {
      await sleep(250)
    }
  }
  fail(`waiting for ${what}`, `${url} never answered.`)
}

await reachable(`${ORIGIN}/sign-in`, 'the dev server')
await reachable(`http://127.0.0.1:${String(PORT)}/json/version`, 'the browser')

const page = (
  await (await fetch(`http://127.0.0.1:${String(PORT)}/json/list`)).json()
).find((target) => target.type === 'page')
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

async function evaluate(expression) {
  const { result } = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  return result?.result?.value
}

async function waitFor(expression, step) {
  for (let tries = 0; tries < 80; tries += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(250)
  }
  fail(step, `nothing matched ${expression}`)
}

/** A real pointer press at the element's centre, which is what Radix listens for. */
async function press(expression, step) {
  await waitFor(expression, step)
  await evaluate(
    `(${expression}).scrollIntoView({ block: 'center', behavior: 'instant' })`,
  )
  await sleep(400)
  const at = await evaluate(
    `(() => { const r = (${expression}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`,
  )
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      x: at.x,
      y: at.y,
      button: 'left',
      clickCount: 1,
      pointerType: 'mouse',
    })
  await sleep(300)
}

const withText = (selector, text) =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => el.textContent.includes(${JSON.stringify(text)}) && !el.disabled)`

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 2,
  mobile: true,
})
await send('Page.navigate', { url: `${ORIGIN}/m?at=${AT}` })

/* Signing in as a senior carer, through the demonstration list. */
await press(
  withText('button[data-sign-in-as]', 'Tolu Akinyemi'),
  'choosing Tolu Akinyemi to sign in',
)
await press(`document.querySelector('[data-sign-in-submit]')`, 'signing in')
await press(`document.querySelector('[data-code-step] input')`, 'the code step')
await send('Input.insertText', { text: '123456' })
await sleep(200)
await press(
  `[...document.querySelectorAll('[data-code-step] button')].find((b) => !b.disabled && /continue|verify|sign in/i.test(b.textContent))`,
  'sending the code',
)
await waitFor(
  `location.pathname.includes('/sign-in/home') || !location.pathname.startsWith('/sign-in')`,
  'leaving the code step',
)
if (await evaluate(`location.pathname.includes('/sign-in/home')`)) {
  await press(
    `[...document.querySelectorAll('[role=radio], label, button')].find((el) => el.textContent.includes('Rosewood Court') && !el.textContent.includes('Ashgrove'))`,
    'choosing Rosewood Court',
  )
  await press(withText('button', 'Continue'), 'confirming the home')
}

/* Two actions on Today: side by side, sharing the width. */
await waitFor(
  `document.querySelector('[data-tab="today"] [data-action-row]')`,
  'Today’s action row',
)
await sleep(600)
const pairShape = await evaluate(
  `document.querySelector('[data-tab="today"] [data-action-row]').dataset.actionRow`,
)
const pair = await evaluate(`(() => {
  const row = document.querySelector('[data-tab="today"] [data-action-row]')
  return [...row.children].map((el) => { const r = el.getBoundingClientRect(); return { label: el.textContent.trim(), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), width: Math.round(r.width) } })
})()`)
if (pair.length !== 2)
  fail(
    'Today’s two actions',
    `the row holds ${String(pair.length)} action(s); a senior carer at this instant has late things, so it should hold two.`,
  )
if (pairShape !== 'pair')
  fail('Today’s two actions', `the row is a ${String(pairShape)}, not a pair.`)
const [first, second] = pair
if (first.top !== second.top)
  fail(
    'Today’s two actions, side by side',
    `"${first.label}" starts at ${String(first.top)}px and "${second.label}" at ${String(second.top)}px: one is on a row of its own.`,
  )
if (second.left <= first.right - 1 || second.right > WIDTH || first.left < 0)
  fail(
    'Today’s two actions, on the screen',
    `they sit at ${String(first.left)}–${String(first.right)} and ${String(second.left)}–${String(second.right)} on a ${String(WIDTH)}px screen.`,
  )
if (Math.abs(first.width - second.width) > 1)
  fail(
    'Today’s two actions, sharing the width',
    `${String(first.width)}px and ${String(second.width)}px.`,
  )

/* Four openers in the composer: a rail, the third cut by the screen edge. */
await press(
  `document.querySelector('nav button[aria-label="Write a care note"]')`,
  'the centre action',
)
await press(
  `document.querySelector('[role=dialog] [data-picker] button')`,
  'the first person on the list',
)
await press(
  `document.querySelector('[role=dialog] [data-category] button')`,
  'the category',
)
await press(withText('[role=dialog] button', 'Medication'), 'Medication')
await waitFor(
  `document.querySelector('[role=dialog] [data-phrases] button')`,
  'the openers',
)
await sleep(500)
const rail = await evaluate(`(() => {
  const row = document.querySelector('[role=dialog] [data-phrases]')
  row.scrollIntoView({ block: 'center', behavior: 'instant' })
  const chips = [...row.querySelectorAll('button')].map((el) => { const r = el.getBoundingClientRect(); return { label: el.textContent.trim(), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) } })
  const edge = row.getBoundingClientRect()
  return { left: Math.round(edge.left), right: Math.round(edge.right), shape: row.dataset.actionRow, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth, overflowX: getComputedStyle(row).overflowX, overflowY: getComputedStyle(row).overflowY, chips }
})()`)
if (rail.shape !== 'rail')
  fail('the openers as a rail', `the row is a ${String(rail.shape)}.`)
if (new Set(rail.chips.map((c) => c.top)).size !== 1)
  fail(
    'the openers on one line',
    `they start at ${rail.chips.map((c) => String(c.top)).join(', ')}px: the rail has wrapped.`,
  )
if (rail.overflowY !== 'hidden' || rail.scrollWidth <= rail.clientWidth)
  fail(
    'the openers scroll sideways',
    `scrollWidth ${String(rail.scrollWidth)} against clientWidth ${String(rail.clientWidth)}, overflow ${rail.overflowX} ${rail.overflowY}.`,
  )
if (rail.left !== 0 || rail.right !== WIDTH)
  fail(
    'the openers bleed to the screen edge',
    `the rail runs from ${String(rail.left)} to ${String(rail.right)}px; it should run past the gutter, 0 to ${String(WIDTH)}.`,
  )
const third = rail.chips[2]
if (third === undefined || !(third.left < WIDTH && third.right > WIDTH))
  fail(
    'the third opener, cut at the edge',
    third === undefined
      ? 'there is no third opener.'
      : `"${third.label}" runs from ${String(third.left)} to ${String(third.right)}px on a ${String(WIDTH)}px screen: it should start on the screen and end past it.`,
  )

console.log(
  `✓ action rows — at ${String(WIDTH)} wide, Today's two actions sit side by side at ${String(first.width)}px each; ` +
    `the composer's four openers are a rail ${String(rail.scrollWidth)}px wide in ${String(rail.clientWidth)}px, ` +
    `the third ("${third.label}") cut at the screen edge from ${String(third.left)} to ${String(third.right)}px. ` +
    `It measures these two rows, at one width; whether the cut reads as more is a screenshot's question.`,
)

socket.close()
browser.kill()
process.exit(0)
