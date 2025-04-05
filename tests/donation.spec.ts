import { test, expect } from '@playwright/test';
import * as path from 'path';

test('can upload a zip file and view contents', async ({ page }) => {
  // Navigate to the local development server
  await page.goto('http://localhost:3000/');
  
  // Wait for the page to load with increased timeout
  await expect(page.getByRole('heading', { name: 'Data donation demo' })).toBeVisible({ timeout: 30000 });
  
  // Create a temporary file input for file upload (Playwright needs to use setInputFiles method)
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Choose file').click();
  const fileChooser = await fileChooserPromise;
  
  // Set a test zip file path (you'll need to ensure this file exists)
  const zipFilePath = path.join(__dirname,  'test.zip');
  await fileChooser.setFiles(zipFilePath);
  
  // Click continue to process the file
  await page.getByText('Continue').click();
  
  // Check that the ZIP file content is visible
  await expect(page.getByText('hello_world.txt')).toBeVisible();
  
  // Check that the donation actions are visible
  await expect(page.getByText('Would you like to donate this data?')).toBeVisible();
});
