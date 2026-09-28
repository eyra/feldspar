// Opt-in: node tests/memory-benchmark.cjs <production-preview-url> <fixture.zip>
// Uploads the fixture through the unchanged demo; never substitutes Python or worker code.
const { chromium } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

async function main() {
  const [url, fixture] = process.argv.slice(2);
  if (!url || !fixture) throw new Error('Usage: node tests/memory-benchmark.cjs <url> <fixture.zip>');
  const metadata = JSON.parse(execFileSync('python3', ['-c',
    'import json,sys,zipfile; print(zipfile.ZipFile(sys.argv[1]).comment.decode("ascii"))', fixture],
  { encoding: 'utf8' }));
  assert.equal(metadata.format, 'feldspar-demo-memory-1');

  const server = await chromium.launchServer({ headless: false });
  const browser = await chromium.connect(server.wsEndpoint());
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const pid = server.process().pid;
  const report = { url, fixture, metadata, outcome: 'failed', sample_interval_ms: 250, peak_rss_kib: 0, phase_peaks_kib: {}, samples: 0 };
  let phase = 'initialization';
  let sampleError;
  // Sum this Chromium process tree only. RSS includes shared pages, so it is
  // a sampled process-memory estimate, not unique physical memory or JS heap.
  const sample = () => {
    try {
      const processes = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' })
        .trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
      const descendants = new Set([pid]);
      let previous;
      do {
        previous = descendants.size;
        for (const [child, parent] of processes) if (descendants.has(parent)) descendants.add(child);
      } while (descendants.size !== previous);
      const rss = processes.reduce((sum, [child, , bytes]) => sum + (descendants.has(child) ? bytes : 0), 0);
      report.peak_rss_kib = Math.max(report.peak_rss_kib, rss);
      report.phase_peaks_kib[phase] = Math.max(report.phase_peaks_kib[phase] ?? 0, rss);
      report.samples++;
    } catch (error) { sampleError = error; }
  };
  sample();
  const timer = setInterval(sample, report.sample_interval_ms);
  let fail;
  const failure = new Promise((_, reject) => { fail = reject; });
  failure.catch(() => {}); // The same rejection is observed by the scenario race below.
  page.on('crash', () => fail(new Error('Chromium tab crashed')));
  page.on('pageerror', error => fail(error));
  await page.exposeFunction('memoryFailure', message => fail(new Error(message)));
  await page.addInitScript(({ metadata }) => {
    window.memoryDonation = null;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', event => {
          if (event.data?.eventType === 'error') window.memoryFailure(event.data.error);
        });
        this.addEventListener('error', event => window.memoryFailure(event.message));
      }
    };
    let initialized = false;
    window.addEventListener('message', event => {
      if (event.data?.action !== 'app-loaded' || initialized) return;
      initialized = true;
      const channel = new MessageChannel();
      window.memoryPort = channel.port1;
      channel.port1.onmessage = event => {
        const command = event.data;
        if (command.__type__ !== 'CommandSystemDonate') return;
        try {
          const tables = JSON.parse(command.json_string);
          const summary = tables.json_summary;
          const intact = summary.data.length === metadata.files && summary.data.every((row, index) => {
            const size = Math.floor(metadata.text_bytes / metadata.files) +
              (index === metadata.files - 1 ? metadata.text_bytes % metadata.files : 0);
            const prefix = 'SYNTHETIC MEMORY FIXTURE ' + String(index).padStart(6, '0') + ': ';
            return row.Filename === 'profile_' + String(index).padStart(6, '0') + '.json' &&
              row.User === prefix + 'x'.repeat(size - prefix.length) &&
              row['User ID'] === String(index) && row['Item count'] === '0' && row.Errors === 'no';
          });
          window.memoryDonation = {
            rows: summary.data.length, content_intact: intact,
            deleted_rows: summary.metadata.deletedRowCount,
            donation_bytes: new Blob([command.json_string]).size,
          };
        } catch (error) { window.memoryFailure(String(error)); }
      };
      window.postMessage({ action: 'live-init', locale: 'en' }, '*', [channel.port2]);
    });
  }, { metadata });

  try {
    await Promise.race([failure, (async () => {
      await page.goto(url);
      await page.getByRole('heading', { name: 'Data donation flow example' }).waitFor({ timeout: 90000 });
      sample();
      phase = 'upload_and_review';
      const chooser = page.waitForEvent('filechooser');
      await page.getByText('Choose file', { exact: true }).click();
      await (await chooser).setFiles(fixture);
      await page.getByText('Continue', { exact: true }).click();
      const table = page.getByTestId('table-json_summary');
      await table.waitFor({ timeout: 90000 });
      sample();
      phase = 'delete_and_undo';
      // Scope the Adjust checkbox to the JSON table, not the first inventory table.
      const container = table.locator('xpath=ancestor::div[contains(@class,"mb-20")][1]');
      await container.getByRole('checkbox').first().check();
      await table.getByRole('checkbox').nth(1).check();
      await container.getByText('Delete selected', { exact: true }).click();
      await container.getByRole('button', { name: 'Undo' }).click();
      sample();
      phase = 'donation';
      await page.getByText('Yes, donate', { exact: true }).click();
      await page.waitForFunction(() => window.memoryDonation !== null, {}, { timeout: 90000 });
      report.donation = await page.evaluate(() => window.memoryDonation);
      assert.equal(report.donation.content_intact, true);
      assert.equal(report.donation.deleted_rows, 0);
      sample();
      if (sampleError) throw sampleError;
      report.outcome = 'passed';
    })()]);
  } catch (error) {
    report.failure_phase = phase;
    report.error = String(error);
    process.exitCode = 1;
  } finally {
    clearInterval(timer);
    await browser.close();
    await server.close();
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
