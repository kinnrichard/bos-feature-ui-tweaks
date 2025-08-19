import { test, expect } from '@playwright/test'

test.describe('BOS Application Database Test', () => {
  test('test database has seed data', async ({ page }) => {
    // Test that we can verify our test data exists via API
    const response = await page.request.get('http://localhost:3000/api/v1/jobs')
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.jobs.length).toBeGreaterThan(0)
  })
})