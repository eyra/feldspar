import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

/**
 * Common setup for tests: navigate to the page, upload a test file
 */
async function setupTestWithFileUpload(page: Page): Promise<void> {
  // Navigate to the local development server
  await page.goto('http://localhost:3000/');
 
  // Wait for the page to load with increased timeout
  await expect(page.getByRole('heading', { name: 'Data donation flow example' })).toBeVisible({ timeout: 30000 });
  
  // Create a temporary file input for file upload
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Choose file').click();
  const fileChooser = await fileChooserPromise;
  
  // Set a test zip file path
  const zipFilePath = path.join(__dirname, 'test.zip');
  await fileChooser.setFiles(zipFilePath);
  
  // Click continue to process the file
  await page.getByText('Continue').click();
}

/**
 * Helper to handle data submission and return the submitted data
 */

function setupRouteForDataSubmission(page: Page): Promise<string|null> {
  return new Promise<string|null>((resolve) => {
    page.route('/data-submission', async route => {
      const json = {ok: true};
      await route.fulfill({ json });
      resolve(route.request().postData());
    });
  });
}

async function submitDataAndGetResult(page: Page): Promise<string | null> {
  const result = setupRouteForDataSubmission(page);
  await page.getByText('Yes, donate', { exact: true }).click();
  return result;
}

test('can submit data', async ({ page }) => {
  await setupTestWithFileUpload(page);
  
  const submittedData = await submitDataAndGetResult(page);
  
  // The submitted data should contain the expected file
  expect(submittedData).toEqual(expect.stringContaining("hello_world.txt"));
});

test('can remove rows from submission', async ({ page }) => {
  await setupTestWithFileUpload(page);

  // Toggle the adjust checkbox
  await page.getByRole('checkbox').first().click();
  // Select all items for deletion
  await page.getByTestId('table-zip_content').getByRole('checkbox').first().click();

  await page.getByText('Delete selected').first().click();
  await expect(page.getByText('hello_world.txt')).not.toBeVisible();

  const submittedData = await submitDataAndGetResult(page);
  
  // The submitted data should not contain the deleted file
  expect(submittedData).not.toEqual(expect.stringContaining("hello_world.txt"));
  // The submitted data should contain the other table contents
  expect(submittedData).toEqual(expect.stringContaining("Device A"));
  // It should also contain the deleted row count
  const parsedData = JSON.parse(submittedData!);
  const data = JSON.parse(parsedData.data!);
  expect(data.zip_content.metadata.deletedRowCount).toEqual(1);
});

test('can undo row removal before submission', async ({ page }) => {
  await setupTestWithFileUpload(page);

  // Toggle the adjust checkbox
  await page.getByRole('checkbox').first().click();
  
  // Select all items for deletion
  const table = await page.getByTestId('table-zip_content');
  await table.getByRole('checkbox').first().click();

  await page.getByText('Delete selected').first().click();
  await expect(table.getByText('hello_world.txt')).not.toBeVisible();
  
  // Click the undo button
  await page.getByRole('button', { name: 'Undo' }).click();
  
  // Verify the deleted file is visible again
  await expect(table.getByText('hello_world.txt')).toBeVisible();

  const submittedData = await submitDataAndGetResult(page);
  
  // The submitted data should contain the previously deleted file
  expect(submittedData).toEqual(expect.stringContaining("hello_world.txt"));
  // The submitted data should also contain the other table contents
  expect(submittedData).toEqual(expect.stringContaining("Device A"));
});

test('can cancel submission', async ({ page }) => {
  await setupTestWithFileUpload(page);

  // Toggle the adjust checkbox
  await page.getByRole('checkbox').first().click();
  
  // Setup the route to capture the submission data
  const result = setupRouteForDataSubmission(page);
  await page.getByText('No', { exact: true }).click();
  const submittedData = await result;

  // The submitted data should not contain the previously deleted file
  expect(submittedData).not.toEqual(expect.stringContaining("hello_world.txt"));
  // The submitted data should also not contain the other table contents
  expect(submittedData).not.toEqual(expect.stringContaining("I don't always test my code"));
  // The submitted data should contain the cancellation message
  expect(submittedData).toEqual(expect.stringContaining("data_submission declined"));
});
