# Changelog

## [1.0.29] - 2026-02-07
### Added
- **Reliability Dashboard**: New real-time dashboard for the Automatic Test.
- **Consistency Score**: Measures patient tracking stability using Standard Deviation of Excursion Widths.
- **Reliability Status**: Color-coded indicators for eHANT vs aHANT difference.
- **aHANT Calculation**: Improved averaging logic to exclude the first 30 seconds of data.


## [1.0.28] - 2026-02-02
### Fixed
- **Statistical Significance Direction**: Fixed a critical logic bug where "Decline" (worse performance) was incorrectly labeled as "Improvement". The system now correctly distinguishes between positive (Decline) and negative (Improvement) score differences.
- **Crash Fix**: Resolved a reference error in the statistics module that could cause the app to crash when calculating non-significant results.

### Changed
- **Streamlined Workflow**: Removed the intermediate calibration prompt ("Do you need to re-calibrate?") between Test A and Test B. The test now proceeds directly to the Test B tracking phase for a smoother user experience.

## [1.0.27] - 2026-02-01
### Added
- **Test Timer**: A persistent stopwatch in the header to track session duration.
- **Clinic Settings**: New settings modal to customize PDF reports with Clinic Name, Provider Name, and License Number.
- **Input Guardrails**: Fixed a bug where the spacebar could get stuck if focus was lost.

## [1.0.26] - 2026-02-01
### Added
- **Tiered Significance Check**: Results now categorized as "Strong" (95% CI), "Moderate" (80% CI), or "None".
- **Dual Confidence Intervals**: Visual feedback in results for both 80% and 95% confidence levels.

## [1.0.25] - 2026-02-01
### Changed
- Default test mode set to "Automatic".
- Default calibration tone set to "Warble".
- Updated internal audio normalization logic.
