import { test, expect } from '@playwright/test'

test.describe('Multiple Technicians in Jobs List', () => {
  test('job cards show all assigned technician avatars', async ({ page }) => {
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
    
    // Wait for jobs list to load
    await page.waitForSelector('.jobs-list')
    
    // Find job cards
    const jobCards = page.locator('.job-card-inline')
    const jobCount = await jobCards.count()
    
    // Check at least one job card for multiple technicians
    for (let i = 0; i < Math.min(jobCount, 3); i++) {
      const jobCard = jobCards.nth(i)
      const techAvatars = jobCard.locator('.technician-avatar')
      const avatarCount = await techAvatars.count()
      
      if (avatarCount > 1) {
        // Verify multiple avatars are visible
        for (let j = 0; j < avatarCount; j++) {
          await expect(techAvatars.nth(j)).toBeVisible()
        }
        
        // Verify overlap styling
        if (avatarCount > 1) {
          const firstAvatar = await techAvatars.nth(0).boundingBox()
          const secondAvatar = await techAvatars.nth(1).boundingBox()
          
          // Second avatar should overlap the first (x position should be less than first.x + first.width)
          expect(secondAvatar.x).toBeLessThan(firstAvatar.x + firstAvatar.width)
        }
        
        // Take a screenshot of a job card with multiple technicians
        await jobCard.screenshot({ 
          path: 'tests/screenshots/job-card-multiple-technicians.png' 
        })
        
        break // Found one with multiple technicians
      }
    }
  })

  test('job cards without technicians show no avatars', async ({ page }) => {
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
    
    // Wait for jobs list to load
    await page.waitForSelector('.jobs-list')
    
    // Find job cards
    const jobCards = page.locator('.job-card-inline')
    const jobCount = await jobCards.count()
    
    // Check for job cards without technicians
    for (let i = 0; i < Math.min(jobCount, 5); i++) {
      const jobCard = jobCards.nth(i)
      const techAvatarsContainer = jobCard.locator('.technician-avatars')
      const hasContainer = await techAvatarsContainer.count() > 0
      
      if (!hasContainer) {
        // This job has no technicians assigned
        const techAvatars = jobCard.locator('.technician-avatar')
        await expect(techAvatars).toHaveCount(0)
        
        // Take a screenshot
        await jobCard.screenshot({ 
          path: 'tests/screenshots/job-card-no-technicians.png' 
        })
        
        break
      }
    }
  })
})