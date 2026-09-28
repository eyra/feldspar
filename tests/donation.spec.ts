import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import { execFileSync } from 'node:child_process';

/**
 * Common setup for tests: navigate to the page, upload a test file
 */
async function setupTestWithFileUpload(
  page: Page,
  file?: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  // Navigate to the local development server
  await page.goto('http://localhost:3000/');

  // Wait for Pyodide to initialize and render the page (can take a while on CI)
  await expect(page.getByRole('heading', { name: 'Data donation flow example' })).toBeVisible({ timeout: 90000 });
  
  // Create a temporary file input for file upload
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Choose file').click();
  const fileChooser = await fileChooserPromise;
  
  // Set a test zip file path
  const zipFilePath = path.join(__dirname, 'test.zip');
  await fileChooser.setFiles(file ?? zipFilePath);
  
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

test('preserves Unicode and escaped text through worker review and donation', async ({ page }) => {
  const filename = '\uFEFFcafé — 中文 — \u{1D11E}\n"quoted" \\ note.txt';
  const buffer = execFileSync('python3', ['-c', [
    'import io, sys, zipfile',
    'buffer = io.BytesIO()',
    'with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:',
    '    archive.writestr(sys.argv[1], "synthetic content")',
    'sys.stdout.buffer.write(buffer.getvalue())',
  ].join('\n'), filename]);
  await setupTestWithFileUpload(page, {
    name: 'unicode.zip', mimeType: 'application/zip', buffer,
  });
  await expect(page.getByTestId('table-file_inventory').getByText('café — 中文', { exact: false })).toBeVisible();

  const submitted = await submitDataAndGetResult(page);
  const data = JSON.parse(JSON.parse(submitted!).data);
  expect(data.file_inventory.data.map((row: Record<string, string>) => row.Filename)).toEqual([filename]);
});

test('shows header labels and widths while donating data frame column names', async ({ page }) => {
  await setupTestWithFileUpload(page);

  const table = page.getByTestId('table-zip_content');
  const participant = table.getByRole('columnheader', { name: 'Participant ID' });
  const device = table.getByRole('columnheader', { name: 'Device' });
  await expect(participant).toBeVisible();

  // column_widths gives the participant column twice the relative width
  const participantWidth = (await participant.boundingBox())!.width;
  const deviceWidth = (await device.boundingBox())!.width;
  expect(participantWidth / deviceWidth).toBeCloseTo(2, 1);

  const submittedData = await submitDataAndGetResult(page);
  const data = JSON.parse(JSON.parse(submittedData!).data);
  expect(data.zip_content.data[0]).toEqual({
    participant_id: 'participant-001',
    device: 'Device A',
    date: '2025-06-01',
    notes: 'Morning session\nQuiet room\n\nNo issues',
  });
});

test('collapses line breaks in text previews but keeps them in the full text', async ({ page }) => {
  await setupTestWithFileUpload(page);

  const table = page.getByTestId('table-zip_content');
  // Four source lines collapse into one preview line, so nothing is hidden.
  const shortRow = table.getByRole('row').filter({ hasText: 'participant-001' });
  await expect(shortRow.getByText('Morning session')).toBeVisible();
  await expect(shortRow.getByRole('button', { name: 'Read full text' })).toHaveCount(0);

  // A long note is clipped; the dialog shows its original paragraph breaks.
  const longRow = table.getByRole('row').filter({ hasText: 'participant-002' });
  await longRow.getByRole('button', { name: 'Read full text' }).click();
  const dialog = page.getByRole('dialog', { name: 'Notes Full text' });
  expect(await dialog.locator('.table-text-dialog-body').innerText()).toContain('Short break.\n\nThe participant asked');
});

test('shows a table description under its title only when set', async ({ page }) => {
  await setupTestWithFileUpload(page);

  const consentTable = (title: string) =>
    page.locator('div.mb-20', { has: page.getByText(title, { exact: true }) });
  const description = (title: string) => consentTable(title).locator(':scope > .text-bodymedium');

  await expect(description('File Inventory')).toHaveText('Overview of file inventory from your zip file.');
  // The static example table passes description=None.
  await expect(consentTable('Example Metadata Table')).toBeVisible();
  await expect(description('Example Metadata Table')).toHaveCount(0);
});

test('can remove rows from submission', async ({ page }) => {
  await setupTestWithFileUpload(page);

  // Toggle the adjust checkbox
  await page.getByRole('checkbox').first().click();
  // Select all items for deletion from the file inventory table
  const inventoryTable = page.getByTestId('table-file_inventory');
  await inventoryTable.getByRole('checkbox').first().click();

  await page.getByText('Delete selected').first().click();
  await expect(inventoryTable.getByText('hello_world.txt')).not.toBeVisible();

  const submittedData = await submitDataAndGetResult(page);

  // The submitted data should contain the static table contents
  expect(submittedData).toEqual(expect.stringContaining("Device A"));
  // It should also contain the deleted row count
  const parsedData = JSON.parse(submittedData!);
  const data = JSON.parse(parsedData.data!);
  expect(data.file_inventory.metadata.deletedRowCount).toEqual(1);
});

test('can undo row removal before submission', async ({ page }) => {
  await setupTestWithFileUpload(page);

  // Toggle the adjust checkbox
  await page.getByRole('checkbox').first().click();
  
  // Select all items for deletion from the file inventory table
  const table = page.getByTestId('table-file_inventory');
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

test('shows confirm prompt when uploading a bad zip and can retry', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await expect(page.getByRole('heading', { name: 'Data donation flow example' })).toBeVisible({ timeout: 90000 });

  // Upload a non-zip file to trigger the BadZipFile error path
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Choose file').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({ name: 'bad.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip') });

  await page.getByText('Continue').click();

  // The confirm prompt should appear with only the "Try again" button (no cancel)
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  expect(await page.getByRole('button', { name: 'Cancel' }).count()).toBe(0);

  // Clicking "Try again" should return to the file upload step
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Choose file')).toBeVisible();
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
