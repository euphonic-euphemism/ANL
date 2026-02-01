# Changelog

## [1.0.24] - 2026-02-01

### Added
- **Safety Guardrails**: Added strict stopping criteria for Automatic tests (Minimum 60s duration, Minimum 7 reversals).
- **Adaptive Tracking**: Implemented variable tracking rates (1.0 dB/s -> 0.5 dB/s) based on progress ("Warm Start").

### Changed
- **Input Hardening**: Increased reversal debounce to 1000ms (1 second) and strictly ignored inputs during lockout to prevent double-triggers.
- **PDF Export**: Updated PDF styling to force a white background, black text, and hide graphs for printer-friendly reports.
- **Defaults**: Changed default Test Mode to 'Automatic' and Calibration to 'Warble'.
- **Initial Level**: Automatic test now starts at Speech - 10 dB ("Warm Start").

## [1.0.23] - 2026-02-01

### Added
- **Stabilization Metrics**: Added `stabilization_seconds` (time of 3rd reversal) and interpretation status to results.

### Changed
- **Automatic Test UI**: Reverted side-by-side graphs in the active test view to a single, larger graph for better visibility.

## [1.0.22] - 2026-02-01

### Added
-   **Restart Test**: Added ability to restart Test A and Test B individually from the Results screen.
-   **Live Metrics**: Added real-time display of eANL (Estimated ANL) and aANL (Average ANL) during Automatic Mode tests.
-   **Reliability Status**: Added reliability indicators (High/Medium/Low) to the results.

### Fixed
-   **Reversal Debounce**: Implemented a 500ms debounce timer to prevent rapid spacebar presses from registering as multiple reversals (jitter fix).
