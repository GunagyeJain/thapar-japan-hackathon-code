// The JL740 story, end to end: reset, then each act on its own screen.
// Server-side steps go through /api/demo/step (auto), so a slow click never breaks the run.
// A screen still showing its module placeholder is noted, not failed; it is checked once its owner ships it.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const FLIGHT = "JL740-20261025"

async function step(request: APIRequestContext, n: number, auto = true) {
  const res = await request.post("/api/demo/step", { data: { n, auto } })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()) as { current: number; did: string[] }
}

/** Opens a screen; false (and a note in the report) while it still shows its module placeholder. */
async function openBuilt(page: Page, path: string): Promise<boolean> {
  await page.goto(path)
  await page.waitForLoadState("networkidle")
  const pending = await page.getByText("In progress · owner").isVisible()
  if (pending) test.info().annotations.push({ type: "screen pending", description: `${path} not built yet; checked by API only` })
  return !pending
}

async function promiseOf(request: APIRequestContext, seat: string) {
  const res = await request.get(`/api/flights/${FLIGHT}/passengers?with_promises=true`)
  const rows = (await res.json()) as { seat: string; promise?: { code: string; checkpoints: Record<string, string> } }[]
  return rows.find((p) => p.seat === seat)?.promise
}

test.describe.serial("JL740 story", () => {
  test.beforeAll(async ({ request }) => {
    const reset = await request.post("/api/demo/reset", { data: { keep_judges: false } })
    expect(reset.ok()).toBeTruthy()
    await step(request, 0)
  })

  test("Act 0 · /demo: cue and judge QR", async ({ page }) => {
    await page.goto("/demo")
    await expect(page.getByRole("heading", { name: "Demo control" })).toBeVisible()
    await expect(page.getByText("Invite the judges now")).toBeVisible()
    await expect(page.getByRole("img", { name: /QR code for .*\/j$/ })).toBeVisible()
  })

  test("Act 1 · Priya saves her rules → AVML", async ({ page, request }) => {
    await step(request, 1)
    expect((await promiseOf(request, "23C"))?.code).toBe("AVML")
    await page.goto("/p")
    await page.getByLabel("Booking reference (PNR)").fill("6XK2QP")
    await page.getByLabel("Surname").fill("SHARMA")
    await page.getByLabel("Surname").press("Enter")
    await expect(page.getByText(/PRIYA|Priya/).first()).toBeVisible()
  })

  test("Act 2 · rebooking drops the meal; ops requests it again", async ({ page, request }) => {
    await step(request, 2)
    expect((await promiseOf(request, "23C"))?.checkpoints.C2).toBe("fail")
    if (await openBuilt(page, "/ops")) {
      await expect(page.getByText("Meal request dropped after rebooking").first()).toBeVisible()
    }
    await step(request, 3)
    expect((await promiseOf(request, "23C"))?.checkpoints.C2).toBe("fixed")
  })

  test("Act 3 · caterer acknowledges meal list v3", async ({ page, request }) => {
    await step(request, 4)
    expect((await promiseOf(request, "23C"))?.checkpoints.C3).toBe("ok")
    if (await openBuilt(page, "/caterer")) await expect(page.getByText("v3").first()).toBeVisible()
  })

  test("Act 4 · /ops/late: Mehta's Jain meal is the spare VJML in galley 2", async ({ page, request }) => {
    await step(request, 5, false)
    await page.goto("/ops/late")
    await page.getByLabel("Passenger (seat, PNR or surname)").fill("31K")
    await page.getByRole("button", { name: /31K\s+MEHTA/ }).click()
    await page.getByText("Jain", { exact: true }).first().click()
    await page.getByRole("button", { name: "Find a safe meal" }).click()
    const result = page.getByRole("region", { name: "Match result" })
    await expect(result.getByText("VJML", { exact: true })).toBeVisible()
    await expect(result.getByText(/Galley 2/)).toBeVisible()
    await expect(result.getByText(/Contains onion/).first()).toBeVisible()
    await page.getByRole("button", { name: "Reserve" }).click()
    await expect(page.getByText(/Done: late request LR-/)).toBeVisible()
  })

  test("Act 5 · crew: galley check and the backup for 27D", async ({ page, request }) => {
    await step(request, 6)
    await step(request, 7)
    expect(await openBuilt(page, "/crew")).toBeTruthy()
    await page.getByRole("button", { name: /Download/ }).first().click()
    await expect(page.getByText(/7 of 8 found/)).toBeVisible()
  })

  test("Act 6 · landed: Priya's promise held, C1 to C5", async ({ page, request }) => {
    await step(request, 8)
    const priya = await promiseOf(request, "23C")
    expect(Object.values(priya?.checkpoints ?? {}).every((c) => c === "ok" || c === "fixed")).toBeTruthy()
    if (await openBuilt(page, "/insights")) await expect(page.getByText("C5").first()).toBeVisible()
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
    await expect(page.getByText(/NO GRAIN NO LENTILS OR BEANS/)).toBeVisible()
    await expect(page.getByText(/穀物・豆類不使用/)).toBeVisible()
  })
})
