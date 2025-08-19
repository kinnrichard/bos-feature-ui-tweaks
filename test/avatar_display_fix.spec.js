import { test, expect } from '@playwright/test'

test.describe('Avatar Display in Job Assignment', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/users/sign_in')
    
    // Login
    await page.fill('#user_email', 'jake@bosapp.com')
    await page.fill('#user_password', 'password')
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    await page.waitForURL('**/clients')
    
    // Navigate to Darla Draper's client page
    const clientCard = page.locator('.client-card', { hasText: 'Darla Draper' })
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

  test('avatar displays correctly when changing assignee', async ({ page }) => {
    // Click the status bubble to open popover
    await page.click('.job-status-bubble')
    
    // Wait for popover to appear
    await page.waitForSelector('.job-popover', { state: 'visible' })
    
    // Click the assignee dropdown
    await page.click('.popover-section:has(h3:text("Assigned to")) .dropdown-button')
    
    // Wait for dropdown menu
    await page.waitForSelector('.dropdown-menu', { state: 'visible' })
    
    // Click on a technician (not the first unassigned option)
    const technicianOption = page.locator('.assignee-option[data-technician-id]').first()
    await technicianOption.click()
    
    // Check that the avatar in the dropdown button has proper styling
    const dropdownAvatar = page.locator('.popover-section:has(h3:text("Assigned to")) .dropdown-value .user-avatar')
    
    // Verify the avatar has the correct styles
    await expect(dropdownAvatar).toBeVisible()
    
    // Check computed styles
    const avatarStyles = await dropdownAvatar.evaluate(el => {
      const computed = window.getComputedStyle(el)
      return {
        display: computed.display,
        borderRadius: computed.borderRadius,
        width: computed.width,
        height: computed.height,
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        fontWeight: computed.fontWeight,
        textTransform: computed.textTransform
      }
    })
    
    // Verify avatar is displayed as a circle with proper dimensions
    expect(avatarStyles.display).toBe('inline-flex')
    expect(avatarStyles.borderRadius).toBe('50%')
    expect(avatarStyles.width).toBe('24px')
    expect(avatarStyles.height).toBe('24px')
    expect(avatarStyles.color).toBe('rgb(255, 255, 255)') // white
    expect(avatarStyles.fontWeight).toBe('600')
    expect(avatarStyles.textTransform).toBe('uppercase')
    
    // Verify the avatar has initials
    const avatarText = await dropdownAvatar.textContent()
    expect(avatarText).toMatch(/^[A-Z]{1,2}$/) // Should be 1-2 uppercase letters
    
    // Take a screenshot for visual verification
    await page.locator('.popover-section:has(h3:text("Assigned to"))').screenshot({ 
      path: 'tests/screenshots/avatar-after-assignment.png' 
    })
  })

  test('multiple assignees display correctly', async ({ page }) => {
    // Click the status bubble to open popover
    await page.click('.job-status-bubble')
    
    // Wait for popover to appear
    await page.waitForSelector('.job-popover', { state: 'visible' })
    
    // Click the assignee dropdown
    await page.click('.popover-section:has(h3:text("Assigned to")) .dropdown-button')
    
    // Wait for dropdown menu
    await page.waitForSelector('.dropdown-menu', { state: 'visible' })
    
    // Select multiple technicians
    const technicians = page.locator('.assignee-option[data-technician-id]')
    const count = await technicians.count()
    
    if (count >= 2) {
      // Click first two technicians
      await technicians.nth(0).click()
      await technicians.nth(1).click()
      
      // Verify the dropdown shows "2 assigned"
      const dropdownValue = page.locator('.popover-section:has(h3:text("Assigned to")) .dropdown-value')
      await expect(dropdownValue).toHaveText('2 assigned')
    }
  })

  test('unassigned state displays correctly', async ({ page }) => {
    // Click the status bubble to open popover
    await page.click('.job-status-bubble')
    
    // Wait for popover to appear
    await page.waitForSelector('.job-popover', { state: 'visible' })
    
    // Click the assignee dropdown
    await page.click('.popover-section:has(h3:text("Assigned to")) .dropdown-button')
    
    // Wait for dropdown menu
    await page.waitForSelector('.dropdown-menu', { state: 'visible' })
    
    // First, assign someone if not already assigned
    const firstTechnician = page.locator('.assignee-option[data-technician-id]').first()
    const isActive = await firstTechnician.evaluate(el => el.classList.contains('active'))
    
    if (!isActive) {
      await firstTechnician.click()
    }
    
    // Now click to unassign
    await firstTechnician.click()
    
    // Verify the dropdown shows unassigned state
    const dropdownValue = page.locator('.popover-section:has(h3:text("Assigned to")) .dropdown-value')
    await expect(dropdownValue).toContainText('Unassigned')
  })
})