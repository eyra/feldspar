import { test, expect } from '@playwright/test'

for (const locale of ['en', 'nl', 'de', 'it']) {
  for (const width of [1280, 390]) {
    test(`consent labels, donation keys and widths: ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`/test/consent.html?locale=${locale}`)
      const english = locale === 'en'
      await expect(page.getByText(english ? 'Conversation data' : 'Gespreksgegevens', { exact: true })).toBeVisible()
      await expect(page.getByText(english ? 'Review your messages.' : 'Controleer uw berichten.', { exact: true })).toBeVisible()
      const role = english ? 'Role' : 'Rol'
      const message = english ? 'Message' : 'Bericht'
      const table = page.getByTestId('table-locale-check')
      if (width > 640) {
        const roleHead = table.locator('thead th').nth(0)
        const messageHead = table.locator('thead th').nth(1)
        await expect(roleHead).toHaveText(role)
        await expect(messageHead).toHaveText(message)
        const ratio = async () => (await messageHead.boundingBox())!.width / (await roleHead.boundingBox())!.width
        expect(await ratio()).toBeCloseTo(4, 1)
        await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true })
        await page.getByRole('checkbox').last().click()
        await expect(table.getByRole('checkbox')).toHaveCount(3)
        expect(await ratio()).toBeCloseTo(4, 1)
        const check = table.locator('thead td')
        expect((await check.boundingBox())!.width).toBeGreaterThan(20)
        await table.getByRole('checkbox').nth(1).click()
        await expect(table.getByRole('checkbox').nth(1)).toBeChecked()
        await page.screenshot({ path: testInfo.outputPath('adjust.png'), fullPage: true })
      } else {
        await expect(table).toBeHidden()
        await expect(page.getByText(role, { exact: true }).last()).toBeVisible()
        await expect(page.getByText(message, { exact: true }).last()).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true })
      }
      // The full-text heading uses the same resolved label on desktop and mobile.
      await page.getByRole('button', { name: /Read full text|Lees volledige tekst|Leggi il testo completo|Vollständigen Text/ }).filter({ visible: true }).first().click()
      await expect(page.getByRole('dialog')).toContainText(message)
      const donation = JSON.parse(await page.getByTestId('donation').textContent() ?? '{}')
      expect(donation.data).toHaveLength(2)
      expect(donation.data[0]).toEqual({ role: 'user', message: 'A synthetic message. '.repeat(70), model: 'test-model' })
      expect(donation.metadata.deletedRowCount).toBe(0)
    })
  }
}

test('consent falls back to first available text without Dutch', async ({ page }) => {
  await page.goto('/test/consent.html?locale=it&noDutch')
  await expect(page.getByText('Conversation data', { exact: true })).toBeVisible()
  await expect(page.getByText('Review your messages.', { exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Message', exact: true })).toBeVisible()
})

test('consent without headers or width hints keeps data frame labels and equal widths', async ({ page }) => {
  await page.goto('/test/consent.html?locale=en&legacy')
  const role = page.getByRole('columnheader', { name: 'role', exact: true })
  const message = page.getByRole('columnheader', { name: 'message', exact: true })
  await expect(role).toBeVisible()
  expect((await role.boundingBox())!.width).toBeCloseTo((await message.boundingBox())!.width, 0)
  expect(Object.keys(JSON.parse((await page.getByTestId('donation').textContent())!).data[0])).toEqual(['role', 'message', 'model'])
})
