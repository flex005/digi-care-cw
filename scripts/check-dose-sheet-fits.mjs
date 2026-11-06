/**
 * The phone's dose sheet still leaves room for a dose at seven allergies, with
 * the keyboard up.
 *
 * **What it holds.** At 390 × 508 (a 390-wide phone with the keyboard taking
 * the bottom of the screen) and seven allergies: every allergy name and the
 * line saying nothing checks them are inside the screen, and the first dose,
 * both its answer buttons together, can be scrolled into the sheet's body. The
 * head above the doses is pinned and cannot scroll, so whatever it holds is
 * taken from the doses: with one row per allergy it held all but 8px of them
 * (PROGRESS.md, 06/11/2026).
 *
 * **Nothing in the test suite can check it.** It is a measurement, and jsdom
 * has no layout. `src/features/phone/dose-sheet-seven-allergies.test.tsx` holds
 * what the head and body contain, with seven allergies built in the loader;
 * this measures how much room that leaves, in a browser.
 *
 * **How the seven are built, and what that cannot catch.** No fixture has seven
 * allergies and the fixtures are not changed for a check, and a page in a
 * browser cannot have its loader replaced. So the sheet is opened over Vera
 * Lonsdale, who has two, and the rendered allergies are given the same seven
 * the suite's test uses: the names written into the pinned block, and the
 * reaction badges in the body copied to seven. The layout is the real CSS. **It
 * cannot see the head cutting the list short** — a "+3 more" would be rewritten
 * to seven names here — which is the suite's test's half.
 *
 * **It is not in `npm run verify`**, because it needs the dev server on
 * localhost:3000 and Chrome. Run it with `npm run check:sheet-fits` before a
 * change to the sheet's head, the subject header or the phone's type scale.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3000'
const PORT = Number(process.env.DEVTOOLS_PORT ?? 9334)
const WIDTH = 390
const HEIGHT = 508
/* 20:20 BST on 16/09/2026, inside Lonsdale's 20:00 windows (CLAUDE.md §8). */
const AT = '2026-09-16T19:20:00Z'
const PERSON = 'res-lonsdale'
const SEVEN = [
  ['Penicillin', 'Rash · moderate'],
  ['Latex', 'Hives · mild'],
  ['Codeine', 'Vomiting · moderate'],
  ['Aspirin', 'Wheeze · severe'],
  ['Ibuprofen', 'Swollen lips · severe'],
  ['Peanut', 'Throat closing · anaphylaxis'],
  ['Trimethoprim', 'Itching · mild'],
]
const NOTHING_CHECKS = 'Nothing here checks these drugs against'

const browser = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    `--remote-debugging-port=${String(PORT)}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'digi-care-cw-sheet-fits-'))}`,
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

function fail(step, said) {
  console.error(`✖ dose sheet fits — ${step}\n  ${said}\n`)
  console.error(
    '  The sheet pins its head, and a pinned head takes its height from the doses.\n' +
      '  It holds the subject, the allergy names (all of them) and the line saying\n' +
      '  nothing checks them; reactions and severity belong to the scrolling body.\n',
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
await send('Page.navigate', { url: `${ORIGIN}/m/round?at=${AT}` })

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

/* Into Lonsdale's chart the way a reader goes, because a reload signs out. */
await press(
  `[...document.querySelectorAll('nav a')].find((a) => a.textContent.includes('Medication'))`,
  'the Medication tab',
)
await press(
  `document.querySelector('[data-tab="round"] a[href="/m/people/${PERSON}"]')`,
  'Lonsdale on the round',
)
await press(
  `document.querySelector('a[href="/m/people/${PERSON}/chart"]')`,
  'Lonsdale’s chart',
)
await press(
  `document.querySelector('[data-record-round]')`,
  'the record act on the chart',
)
await waitFor(
  `document.querySelector('[role=dialog] [data-dose-sheet]')`,
  'the dose sheet',
)
await sleep(600)

/* The seven allergies, written into the rendered sheet (see the docblock). */
const built = await evaluate(`(() => {
  const seven = ${JSON.stringify(SEVEN)}
  const names = document.querySelector('[role=dialog] [data-sheet-allergies] [data-tone="critical"]')
  const detail = document.querySelector('[role=dialog] [data-sheet-allergy-detail]')
  if (!names || !detail) return 'no names block in the head, or no detail in the body'
  const words = [...names.querySelectorAll('span')].find((el) => el.textContent.startsWith('Allergies: '))
  if (!words) return 'the names block does not read "Allergies: …"'
  words.textContent = 'Allergies: ' + seven.map(([name]) => name).join(', ')
  const pills = [...detail.querySelectorAll('[data-tone="critical"]')]
  for (const pill of pills.slice(1)) pill.remove()
  const first = pills[0]
  for (const [index, [name, reaction]] of seven.entries()) {
    const pill = index === 0 ? first : first.cloneNode(true)
    const leaves = [...pill.querySelectorAll('span')].filter((el) => el.children.length === 0 && el.textContent.trim())
    leaves[0].textContent = 'Allergy: ' + name
    leaves[1].textContent = reaction
    if (index > 0) detail.appendChild(pill)
  }
  return 'built'
})()`)
if (built !== 'built') fail('building seven allergies', built)
await sleep(400)

const measured = await evaluate(`(() => {
  const dialog = document.querySelector('[role=dialog]')
  const head = dialog.querySelector('[data-sheet-allergies]')
  const names = head.querySelector('[data-tone="critical"]')
  const line = [...head.querySelectorAll('p')].find((p) => p.textContent.includes(${JSON.stringify(NOTHING_CHECKS)}))
  let pane = dialog.querySelector('[data-dose-sheet]')
  while (pane && !['auto', 'scroll'].includes(getComputedStyle(pane).overflowY)) pane = pane.parentElement
  const group = dialog.querySelector('[data-sheet-dose] [role=radiogroup]')
  if (!line || !pane || !group) return { missing: [!line && 'the nothing-checks line', !pane && 'a scrolling body', !group && 'an answerable dose'].filter(Boolean) }
  group.scrollIntoView({ block: 'end', behavior: 'instant' })
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) } }
  return {
    viewport: innerHeight,
    namesText: names.textContent,
    names: box(names),
    line: box(line),
    pane: box(pane),
    buttons: [...group.querySelectorAll('[role=radio]')].map((b) => ({ label: b.textContent, ...box(b) })),
  }
})()`)
if (measured.missing)
  fail('finding what to measure', `no ${measured.missing.join(', ')} on the sheet.`)

const { viewport, names, line, pane, buttons } = measured
for (const [name] of SEVEN)
  if (!measured.namesText.includes(name))
    fail(
      'every allergy named',
      `${name} is not in the pinned names: ${JSON.stringify(measured.namesText)}.`,
    )
if (names.top < 0 || names.bottom > viewport)
  fail(
    'every allergy named, on the screen',
    `the names run from ${String(names.top)} to ${String(names.bottom)}px on a ${String(viewport)}px screen.`,
  )
if (line.bottom > viewport || line.bottom > pane.top)
  fail(
    'the nothing-checks line on the screen',
    `it ends at ${String(line.bottom)}px; the screen ends at ${String(viewport)} and the doses begin at ${String(pane.top)}.`,
  )
const labels = buttons.map((b) => b.label).join(' and ')
if (labels !== 'Given and Not given')
  fail('the first dose’s answers', `the first dose offers ${JSON.stringify(labels)}.`)
for (const button of buttons)
  if (button.top < pane.top || button.bottom > pane.bottom)
    fail(
      'the first dose’s answers, scrolled into the body',
      `${button.label} sits from ${String(button.top)} to ${String(button.bottom)}px; the body shows ${String(pane.top)} to ${String(pane.bottom)}px (${String(pane.bottom - pane.top)}px for doses).`,
    )

console.log(
  `✓ dose sheet fits — at ${String(WIDTH)} × ${String(HEIGHT)} with seven allergies, the names end at ` +
    `${String(names.bottom)}px and the nothing-checks line at ${String(line.bottom)}px, leaving ` +
    `${String(pane.bottom - pane.top)}px of doses, and the first dose's Given and Not given scroll into it together. ` +
    `The seven are written into the rendered sheet, so this cannot see the head cutting the list ` +
    `short; dose-sheet-seven-allergies.test.tsx holds that. It measures one person's sheet at one size.`,
)

socket.close()
browser.kill()
process.exit(0)
