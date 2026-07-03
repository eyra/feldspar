# Changelog

## Types of Changes and How to Note Them

* Added - For any new features that have been added since the last version was released
* Changed - To note any changes to the software's existing functionality
* Deprecated - To note any features that were once stable but are no longer and have thus been removed
* Fixed - Any bugs or errors that have been fixed should be so noted
* Removed - This notes any features that have been deleted and removed from the software
* Security - This acts as an invitation to users who want to upgrade and avoid any software vulnerabilities

## \#8 2026-07-03

* Added SafeData for crash-resistant JSON access in donation scripts
* Added locale routing from JavaScript to Python via `port.start(context)` so Python can localize DataFrame content the React i18n layer can't reach
* Added `python -m port` CLI extraction runner for local script development
* Added `workerLog` forwarding and `FlushLogs` sentinel so long-running Python extractions stream log progress to the client in real time
* Changed `PropsUIPromptConfirm.cancel` to be optional; removed the default cancel affordance from demo confirm prompts
* Changed demo `script.py`: refactored into step functions using `yield from` for clearer control flow
* Changed dependency stack: Vite 8, TypeScript 6, Node.js 24.18, Python 3.14.6, Tailwind 4.3, Playwright 1.61, plus a large batch of Renovate/Dependabot bumps
* Fixed `sys.modules` pollution in `test_script_wrapper`
* Fixed release workflow to pin the release tag to the workflow commit

## \#7 2026-03-05

* Added status text during data submission to inform users to keep the window open
* Added CommandSystemLog for forwarding logs from JavaScript and Python to the hosting application
* Changed Tailwind CSS to v4
* Changed CI workflows: added dependency update testing, feature branch releases
* Removed unused _build_release.yml workflow

## \#6 2026-02-25

* Added maximum data frame sizes to both the API and UI
* Added GitHub Actions release workflow with automated testing
* Added unit tests for dataframe truncation (Python and JavaScript)
* Added Lithuanian (LT) and Romanian (RO) translations
* Added Git LFS for test fixtures
* Fixed case-insensitive search in consent table
* Removed redundant Playwright workflow (consolidated into release workflow)

## \#5 2025-09-10

* Switched to pnpm for package management
* Switched to Vite for the frontend build system
* Added Spanish language
* Changed: split script.py into a default basic version in script.py and an advanced version script_custom_ui.py
* Added renovate

## \#4 2025-05-02

* Fixed - Explicit loaded event is sent to ensure proper initialization (channel setup)
* Changed: Feldspar is now split into React component and app
* Changed: Allow multiple block-types to interleave on a submission page
* Added: end to end tests using Playwright

## \#3 2025-04-08

* Changed: layout to support mobile screens (enables mobile friendly data donation)
* Added: support for mobile variant of a table using cards (used for data donation consent screen)

## \#2 2024-06-13

* Added: Support for progress prompt
* Added: German translations
* Added: Support for assets available in Python

## \#1 2024-03-15

Initial version
