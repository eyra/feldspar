import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

/**
 * Common setup for tests: navigate to the page, upload a test file
 */
async function setupTestWithFileUpload(page: Page): Promise<void> {
  // Navigate to the local development server
  await page.goto('http://localhost:3000/');

  // Wait for the page to load with increased timeout
  await expect(page.getByRole('heading', { name: 'Youtube Data donation' })).toBeVisible({ timeout: 90000 });

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

  // The submitted data should contain the youtube search history file content
  expect(submittedData).toEqual(expect.stringContaining("A third title"));
});

test('can remove rows from submission', async ({ page }) => {
  await setupTestWithFileUpload(page);
  const table = await page.getByTestId('table-search_data');
  await expect(table.getByText('Some title')).toBeVisible();
  await expect(table.getByText('Some other title')).toBeVisible();

  // Toggle the adjust checkbox
  await page.getByRole('checkbox').first().click();

  // Select the first entry in the table, i.e. the second checkbox
  await table.getByRole('checkbox').nth(1).click();

  // Delete the selected row
  await page.getByText('Delete selected').first().click();
  await expect(table.getByText('Some title')).not.toBeVisible();
  await expect(table.getByText('Some other title')).toBeVisible();

  // Submit the data
  const submittedData = await submitDataAndGetResult(page);

  // The submitted data should not contain the deleted entry
  expect(submittedData).not.toEqual(expect.stringContaining("Some title"));
  // The submitted data should contain the other entry
  expect(submittedData).toEqual(expect.stringContaining("Some other title"));

  // It should also contain the deleted row count
  // TODO: Re-enable this check once the backend supports it
  // const parsedData = JSON.parse(submittedData!);
  // const data = JSON.parse(parsedData.data!);
  // expect(data.zip_content.metadata.deletedRowCount).toEqual(1);
});

test('can undo row removal before submission', async ({ page }) => {
  await setupTestWithFileUpload(page);

  // Toggle the adjust checkbox
  await page.getByRole('checkbox').first().click();

  // Select all items for deletion
  const table = await page.getByTestId('table-search_data');
  await table.getByRole('checkbox').first().click();

  await page.getByText('Delete selected').first().click();
  await expect(table.getByText('Some title')).not.toBeVisible();
  await expect(table.getByText('Some other title')).not.toBeVisible();

  // Click the undo button
  await page.getByRole('button', { name: 'Undo' }).click();

  // Verify the deleted file is visible again
  await expect(table.getByText('Some title')).toBeVisible();

  const submittedData = await submitDataAndGetResult(page);

  // The submitted data should contain the previously deleted file
  expect(submittedData).toEqual(expect.stringContaining("Some title"));
  // The submitted data should also contain the other table contents
  expect(submittedData).toEqual(expect.stringContaining("Some other title"));
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
