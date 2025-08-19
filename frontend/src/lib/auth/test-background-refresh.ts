/**
 * Test script for background refresh functionality
 * Run in browser console to test the authentication refresh system
 */

import { backgroundRefresh } from './background-refresh';
import { csrfTokenManager } from '$lib/api/csrf';

export async function testBackgroundRefresh() {
  console.log('🧪 Testing Background Refresh System');
  console.log('=====================================');

  // Test 1: Check if service is initialized
  console.log('\n1️⃣ Checking service status...');
  const isActive = backgroundRefresh.isActive();
  console.log(`   Service active: ${isActive}`);

  // Test 2: Get session info
  console.log('\n2️⃣ Session information:');
  const sessionInfo = backgroundRefresh.getSessionInfo();
  console.log(`   Session age: ${sessionInfo.sessionAgeHours.toFixed(2)} hours`);
  console.log(`   Idle time: ${sessionInfo.idleHours.toFixed(2)} hours`);
  console.log(`   Session valid: ${sessionInfo.isValid}`);

  // Test 3: Manual refresh test
  console.log('\n3️⃣ Testing manual refresh...');
  try {
    const csrfToken = await csrfTokenManager.getToken();
    console.log(`   CSRF token obtained: ${csrfToken ? '✅' : '❌'}`);

    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
    });

    console.log(`   Refresh response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Refresh successful!');

      if (data.auth) {
        console.log(`   Token expires at: ${data.auth.expires_at}`);
        console.log(`   Session created: ${data.auth.session_created_at}`);
        console.log(`   Session age: ${data.auth.session_age_hours} hours`);
      }
    } else {
      console.log('   ❌ Refresh failed!');
      const error = await response.text();
      console.log(`   Error: ${error}`);
    }
  } catch (error) {
    console.log('   ❌ Refresh error:', error);
  }

  // Test 4: Check localStorage
  console.log('\n4️⃣ LocalStorage values:');
  const sessionStart = localStorage.getItem('sessionStartTime');
  const lastRefresh = localStorage.getItem('lastRefreshTime');

  if (sessionStart) {
    const startDate = new Date(parseInt(sessionStart));
    console.log(`   Session started: ${startDate.toLocaleString()}`);
  }

  if (lastRefresh) {
    const refreshDate = new Date(parseInt(lastRefresh));
    console.log(`   Last refresh: ${refreshDate.toLocaleString()}`);
  }

  console.log('\n=====================================');
  console.log('✅ Test complete!');

  return {
    isActive,
    sessionInfo,
    sessionStart,
    lastRefresh,
  };
}

// Make it available globally for easy testing
if (typeof window !== 'undefined') {
  (window as any).testBackgroundRefresh = testBackgroundRefresh;
}
