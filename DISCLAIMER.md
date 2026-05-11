# Technical Limitations and Disclaimer

This document outlines the current technical limitations of Feldspar when used with the [Next](https://next.eyra.co) platform.

## Background

Feldspar was originally designed to support data donation workflows where participants upload **aggregated data** extracted from Data Download Packages (DDPs). The system was built with an expected payload size of approximately **1 MB** per donation.

Over time, research use cases have evolved. Researchers increasingly request raw, non-aggregated data, and platforms like TikTok produce DDPs exceeding **100 MB**. This pushes the system beyond its original design parameters.

## Current Limitations

### Server-Side Limits

| Limit | Value |
|-------|-------|
| Maximum donation payload size | 200 MB |

### Dataframe Row Limits

Tables exceeding the row limits are **truncated** (not discarded). The first N rows are kept, and the remaining rows are removed.

| Layer | Default Limit | Behavior |
|-------|---------------|----------|
| Python API | 10,000 rows | Truncates to first 10,000 rows; count of removed rows included in metadata |
| UI (JavaScript) | 50,000 rows | Hard cap; truncates to first 50,000 rows |

The metadata includes a `deletedRowCount` field indicating how many rows were truncated, allowing researchers to identify incomplete data.

### Client-Side Constraints

Feldspar runs in participants' web browsers across a wide variety of devices, including mobile phones. The following factors can cause donation failures:

- **Memory limitations**: Large data files may exceed available browser memory, especially on mobile devices
- **Network conditions**: Slow or unstable internet connections may cause upload timeouts
- **Browser constraints**: Different browsers have varying limits on memory usage and request sizes

### Silent Failures

**Important**: In the current implementation, participants may not be aware when a donation fails.

- If the donation is successfully received by the server, the task is marked complete
- If a **server error** occurs, it is logged and can be investigated
- If a **client-side error** occurs (e.g., network timeout, memory issue), the donation data may be lost without notification to the participant or researcher

The participant's task will appear green (complete) after returning to the Next task list, regardless of whether the donation was actually received.

### Out of Memory Errors

When an out-of-memory error occurs in the browser:
- The JavaScript runtime crashes
- The task will **not** receive a green checkmark
- No error data is captured or sent to the server

## Logging and Error Monitoring

As part of ongoing improvements to the reliability and stability of Feldspar, error and diagnostic logging may be enabled.

### What is logged

Feldspar may collect and forward technical log messages, including:
- JavaScript errors (browser level)
- Framework-level errors
- Python runtime errors (if enabled)

These logs are used solely for debugging and improving the platform.

### Important: Potential inclusion of personal data

Although logs are intended to contain only technical information, log messages may unintentionally include personal data.

This can occur in two ways:
- When developers explicitly log messages that include user-provided input or data
- When runtime errors or exceptions include data in their error messages or stack traces

### Data handling

- Logs are processed within the Next platform infrastructure
- Logs are not used for research purposes
- Logs are only accessed for debugging and system improvement

### Responsibilities

Script developers and researchers setting up the data donation study are responsible for:
- Avoiding logging of personal data in their scripts
- Handling exceptions in a way that prevents unintended inclusion of personal data in log messages

### Roadmap

The following features are on the Feldspar development roadmap:
- More granular logging controls (per layer: browser, framework, Python)
- Options to disable logging entirely for privacy-sensitive studies

## Recommendations

To maximize successful data donations:

1. **Aggregate data in Python scripts** rather than sending raw records
2. **Limit table sizes** to stay within the dataframe row limits
3. **Test with representative data sizes** before deploying to participants
4. **Monitor server logs** for donation errors
5. **Consider participant device diversity** when designing data extraction scripts

## Questions

For questions about these limitations or guidance on designing data donation workflows, please open an issue in this repository.
