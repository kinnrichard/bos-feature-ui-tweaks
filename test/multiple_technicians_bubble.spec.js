import { test, expect } from '@playwright/test'

test.describe('Multiple Technicians in Status Bubble', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/users/sign_in')
    
    // Login
    await page.fill('#user_email', 'jake@bosapp.com')
    await page.fill('#user_password', 'password')
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    await page.waitForURL('**/clients')
    
    // Navigate to a client with jobs
    const clientCard = page.locator('.client-card').first()
    await clientCard.click()
    
    // Wait for client page to load
    await page.waitForSelector('.client-view')
    
    // Navigate to Jobs tab
    await page.getByRole('link', { name: 'Jobs' }).click()
    
    // Wait for jobs to load
    await page.waitForSelector('.jobs-view')
    
    // Click on the first job
    await page.locator('.job-card').first().click()
    
    // Wait for job page to load
    await page.waitForSelector('.job-view')
  })

  test('status bubble expands to show multiple technician avatars', async ({ page }) => {
    // Click the status bubble to open popover
    const statusBubble = page.locator('.job-status-bubble')
    await statusBubble.click()
    
    // Wait for popover to appear
    await page.waitForSelector('.job-popover', { state: 'visible' })
    
    // Click the assignee dropdown
    await page.click('.popover-section:has(h3:text("Assigned to")) .dropdown-button')
    
    // Wait for dropdown menu
    await page.waitForSelector('.dropdown-menu', { state: 'visible' })
    
    // Select multiple technicians
    const technicians = page.locator('.assignee-option[data-technician-id]')
    const count = await technicians.count()
    
    if (count >= 3) {
      // Click first three technicians
      await technicians.nth(0).click()
      await technicians.nth(1).click()
      await technicians.nth(2).click()
      
      // Check that the status bubble contains multiple avatars
      const avatarsInBubble = statusBubble.locator('.assignee-icon .user-avatar')
      await expect(avatarsInBubble).toHaveCount(3)
      
      // Verify each avatar is visible
      for (let i = 0; i < 3; i++) {
        await expect(avatarsInBubble.nth(i)).toBeVisible()
      }
      
      // Take a screenshot to verify visual appearance
      await statusBubble.screenshot({ 
        path: 'tests/screenshots/multiple-technicians-bubble.png' 
      })
      
      // Verify the bubble has expanded to fit all avatars
      const bubbleBox = await statusBubble.boundingBox()
      expect(bubbleBox.width).toBeGreaterThan(100) // Should be wider than default
    }
  })

  test('status bubble shows unassigned when no technicians selected', async ({ page }) => {
    // Click the status bubble to open popover
    const statusBubble = page.locator('.job-status-bubble')
    await statusBubble.click()
    
    // Wait for popover to appear
    await page.waitForSelector('.job-popover', { state: 'visible' })
    
    // Click the assignee dropdown
    await page.click('.popover-section:has(h3:text("Assigned to")) .dropdown-button')
    
    // Wait for dropdown menu
    await page.waitForSelector('.dropdown-menu', { state: 'visible' })
    
    // If any technicians are selected, deselect them
    const activeTechnicians = page.locator('.assignee-option.active[data-technician-id]')
    const activeCount = await activeTechnicians.count()
    
    for (let i = 0; i < activeCount; i++) {
      await activeTechnicians.first().click()
    }
    
    // Verify status bubble shows unassigned icon
    const unassignedIcon = statusBubble.locator('.assignee-icon:has-text("❓")')
    await expect(unassignedIcon).toBeVisible()
  })
})