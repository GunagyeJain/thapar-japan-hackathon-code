// The JL740 story v2 (docs/plan/v2.md), end to end: passport chat, Calendar Radar, Chaos Mode, crew copilot, the numbers.
// Clicks go through the real screens; each step's server side goes through /api/demo/step, so a slow click never
// breaks the run.
import { expect, test, type APIRequestContext } from "@playwright/test"

const FLIGHT = "JL740-20261025"
const PRIYA_SAYS = "pure veg, no onion-garlic, aur Purnima ka vrat rakhti hoon"

interface Promise {
  code: string
  kitchen_note: string | null
  checkpoints: Record<string, string>
}

async function step(request: APIRequestContext, n: number, auto = true) {
  const res = await request.post("/api/demo/step", { data: { n, auto } })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()) as { current: number; did: string[] }
}

async function promiseOf(request: APIRequestContext, seat: string): Promise<Promise | undefined> {
  const res = await request.get(`/api/flights/${FLIGHT}/passengers?with_promises=true`)
  const rows = (await res.json()) as { seat: string; promise?: Promise }[]
  return rows.find((p) => p.seat === seat)?.promise
}

async function lateChanges(request: APIRequestContext) {
  const res = await request.get(`/api/changes?flight_id=${FLIGHT}`)
  const body = (await res.json()) as { events: { channel: string; seat: string | null; decision: { rung: string; ok: boolean } }[] }
  return body.events.filter((e) => e.channel !== "radar")
}

test.describe.serial("JL740 story v2", () => {
  test.beforeAll(async ({ request }) => {
    const reset = await request.post("/api/demo/reset", { data: { keep_judges: false } })
    expect(reset.ok()).toBeTruthy()
    await step(request, 0)
  })

  test("Act 0 · /demo: the cutoff ladder and the judge QR", async ({ page }) => {
    await page.goto("/demo")
    await expect(page.getByRole("heading", { name: "Demo control" })).toBeVisible()
    await expect(page.getByText("Today, the airline stops listening here").first()).toBeVisible()
    await expect(page.getByRole("img", { name: /QR code for .*\/j$/ })).toBeVisible()
  })

  test("Act 1 · Priya says it her way on /chat → AVML + NO ONION NO GARLIC", async ({ page, request }) => {
    await step(request, 1, false)
    await page.goto("/chat?pnr=6XK2QP&surname=SHARMA")
    await expect(page).toHaveURL(/passenger=PX-0057/)
    await page.getByLabel("Type what you eat…").fill(PRIYA_SAYS)
    await page.getByRole("button", { name: "Send" }).click()
    await expect(page.getByText(/garlic/i).first()).toBeVisible()
    await page.getByRole("button", { name: "That's right" }).click()
    await expect.poll(async () => (await promiseOf(request, "23C"))?.kitchen_note ?? "").toContain("NO ONION NO GARLIC")
    expect((await promiseOf(request, "23C"))?.code).toBe("AVML")
  })

  test("Act 1 · the Radar asks about Sharad Purnima; Yes switches the meal before the cutoff", async ({ page, request }) => {
    await step(request, 2, false)
    await page.goto("/chat?passenger=PX-0057")
    await expect(page.getByText(/Sharad Purnima/).first()).toBeVisible()
    await page.getByRole("button", { name: /Yes/ }).first().click()
    await expect.poll(async () => (await promiseOf(request, "23C"))?.kitchen_note ?? "").toContain("NO GRAIN")
  })

  test("Act 2 · Chaos Mode: seven late changes, each on a rung that works", async ({ page, request }) => {
    await step(request, 3, false)
    await page.goto("/ops/changes")
    await page.getByRole("button", { name: "Run Chaos Mode" }).click()
    await expect.poll(async () => (await lateChanges(request)).length, { timeout: 20_000 }).toBe(7)
    const events = await lateChanges(request)
    expect(events.every((e) => e.decision.ok)).toBeTruthy()
    expect(events.map((e) => e.decision.rung)).toEqual([
      "caterer_add", "caterer_add", "standby_uplift", "onboard_spare", "noshow_release", "reserve_pouch", "flex_swap",
    ])
    const metrics = await (await request.get(`/api/changes/metrics?flight_id=${FLIGHT}`)).json()
    expect(metrics.ours.hard_met).toBe(metrics.ours.hard_total)
    expect(metrics.today.hard_met).toBeLessThan(metrics.ours.hard_met)
    await expect(page.getByText(/Mehta/i).first()).toBeVisible()
    expect((await promiseOf(request, "23C"))?.checkpoints.C2).toBe("fixed")
  })

  test("Act 3 · seat screens before the meal: 23C taps Yes, initials only, the meal after a tap", async ({ page, request }) => {
    await step(request, 4, false)
    const asked = await request.post("/api/seatback/ask", { data: { flight_id: FLIGHT } })
    expect(asked.ok(), await asked.text()).toBeTruthy()
    await page.goto("/seat?seat=23C")
    await page.getByRole("radio", { name: "EN" }).click()
    await expect(page.getByText("Your pre-ordered meal — still right?")).toBeVisible()
    await expect(page.getByText("P. S. · Seat 23C")).toBeVisible()
    await expect(page.getByText(/SHARMA|Sharma|Priya|PRIYA/)).toHaveCount(0)
    await page.getByRole("button", { name: "Show my meal" }).click()
    await expect(page.getByText(/no onion, no garlic/).first()).toBeVisible()
    await page.getByRole("button", { name: "Yes" }).click()
    await expect(page.getByText("Thank you. Your meal comes first.")).toBeVisible()
    const status = (await (await request.get(`/api/seatback/${FLIGHT}`)).json()) as { seats: { seat: string; status: string }[] }
    expect(status.seats.find((s) => s.seat === "23C")?.status).toBe("confirmed")
  })

  test("Act 3 · crew copilot: galley check offline, serve list, 2A's sun time", async ({ page, request }) => {
    await step(request, 4)
    await page.goto("/crew")
    await page.getByRole("button", { name: /Download/ }).first().click()
    // Galley 1 carries one more special meal than v1: the Jain meal Chaos Mode added to the final list for 21D.
    await expect(page.getByText(/8 of 9 found/).first()).toBeVisible()
    await page.getByText("Copilot", { exact: true }).first().click()
    await expect(page.getByText(/Yes 1 · Changed 0/).first()).toBeVisible()
    const pkg = await (await request.get(`/api/flights/${FLIGHT}/crew-package`)).json()
    const seats = Object.fromEntries(pkg.copilot.seats.map((s: { seat: string }) => [s.seat, s]))
    expect(pkg.copilot.sources).toEqual({ trays: "m18", sun: "m21" })
    expect(seats["2A"].may_eat_from).toContain("06:30")
    expect(pkg.copilot.serve_order).toContain("31K")
  })

  test("Act 4 · landed: smart load and sun at the aircraft", async ({ page, request }) => {
    await step(request, 5)
    await page.goto("/ops/load")
    await expect(page.getByText(/13 of 13/).first()).toBeVisible()
    await page.goto("/ops/sun")
    await expect(page.getByText(/05:42/).first()).toBeVisible()
    const priya = await promiseOf(request, "23C")
    expect(["C1", "C2", "C3", "C4", "C5"].every((c) => ["ok", "fixed"].includes(priya?.checkpoints[c] ?? ""))).toBeTruthy()
  })

  test("Flight home · Priya's 20 Nov return is a fast day; only the date is sent", async ({ page, request }) => {
    // Act 2 rebooked her, so look her up by today's booking reference; the page then keeps her id in the address.
    const rows = (await (await request.get(`/api/flights/${FLIGHT}/passengers`)).json()) as { seat: string; pnr: string }[]
    const pnr = rows.find((p) => p.seat === "23C")?.pnr
    await page.goto(`/p/days?pnr=${pnr}&surname=SHARMA`)
    await expect(page).toHaveURL(/passenger=PX-0057/)
    await page.getByRole("button", { name: "Ekadashi" }).click()
    await expect(page.getByText("Sends: 2026-11-20")).toBeVisible()
    await page.getByRole("button", { name: "Save fast days" }).click()
    await expect(page.getByText(/NO GRAIN NO LENTILS OR BEANS/).first()).toBeVisible()
  })
})
