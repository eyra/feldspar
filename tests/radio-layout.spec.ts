import { test, expect } from '@playwright/test'
import * as path from 'node:path'

for (const width of [1280, 390]) {
  test(`radio prompt stacks long labels within the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/test/radio.html')
    const group = page.getByRole('radiogroup', { name: 'Choose how to continue' })
    await expect(group).toBeVisible()
    const labels = group.locator('label')
    await expect(labels).toHaveCount(3)
    const geometry = await group.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return {
        direction: getComputedStyle(element).flexDirection,
        gap: getComputedStyle(element).rowGap,
        margin: parseFloat(getComputedStyle(element).marginLeft),
        left: bounds.left, right: bounds.right,
        labels: [...element.querySelectorAll('label')].map(label => {
          const rect = label.getBoundingClientRect()
          const range = document.createRange()
          range.selectNodeContents(label)
          return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
            textRight: Math.max(...[...range.getClientRects()].map(rect => rect.right)) }
        }),
      }
    })
    expect(geometry.direction).toBe('column')
    expect(geometry.gap).toBe('12px')
    expect(geometry.margin).toBeGreaterThan(0) // Prism's outline-ring clearance survives.
    for (const [index, label] of geometry.labels.entries()) {
      expect(label.x).toBeCloseTo(geometry.labels[0].x, 1)
      expect(label.x).toBeGreaterThanOrEqual(geometry.left)
      expect(label.right).toBeLessThanOrEqual(geometry.right + 1)
      expect(label.textRight).toBeLessThanOrEqual(width)
      if (index) expect(label.y - geometry.labels[index - 1].bottom).toBeCloseTo(12, 1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await page.getByRole('radio').nth(1).check()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.locator('body')).toHaveAttribute('data-result', /PayloadString/)
    if (process.env.FELDSPAR_SCREENSHOT_DIR) await page.screenshot({
      path: path.join(process.env.FELDSPAR_SCREENSHOT_DIR, `radio-${width}.png`), fullPage: true,
    })
  })
}
