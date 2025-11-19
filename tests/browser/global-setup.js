/**
 * Global setup for Playwright browser tests
 * Ensures the test environment is properly configured
 */

import { execSync } from 'child_process';

async function globalSetup(config) {
  console.log('🔧 Setting up browser test environment...');

  // Build the library if not already built
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Library built successfully');
  } catch (error) {
    console.error('❌ Failed to build library:', error);
    throw error;
  }

  console.log('🎯 Browser test environment ready');
}

export default globalSetup;