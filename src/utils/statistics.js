/**
 * Calculates the statistical significance of the difference between two ANL test results.
 * Uses the Independent Samples t-test logic (assuming unequal variance, Welch's approximation simplified for CI overlap)
 * specifically using the Standard Error to calculate the Critical Difference.
 *
 * @param {Object} resultA - Result object for Test A
 * @param {Object} resultB - Result object for Test B
 * @returns {Object} { isSignificant, status, confidenceLevel, criticalDifference95, criticalDifference80, diff, message, color }
 */
export const calculateSignificance = (resultA, resultB) => {
    // Validate inputs
    if (!resultA || !resultB || !resultA.validity || !resultB.validity) {
        return { isSignificant: false, message: "Insufficient Data for Comparison", color: "#94a3b8" };
    }

    const scoreA = resultA.score.eANL;
    const scoreB = resultB.score.eANL;

    const seA = resultA.validity.se || 0;
    const seB = resultB.validity.se || 0;

    // Calculate absolute difference
    const diff = Math.abs(scoreA - scoreB);

    // If both have valid SE (Automatic Mode with sufficient data)
    if (seA > 0 && seB > 0) {
        // Critical Difference Formula: Z * sqrt(SE1^2 + SE2^2)
        const combinedError = Math.sqrt(Math.pow(seA, 2) + Math.pow(seB, 2));

        const criticalDifference95 = 1.96 * combinedError;
        const criticalDifference80 = 1.28 * combinedError;

        const isSig95 = diff > criticalDifference95;
        const isSig80 = diff > criticalDifference80;

        const rawDiff = scoreB - scoreA;
        const isImprovement = rawDiff > 0; // Higher HANT is better

        let status = "None";
        let message = "No Significant Difference";
        let color = "#94a3b8"; // Grey

        if (isSig95) {
            status = "Strong";
            message = isImprovement ? "Definite Improvement (95% CI)" : "Definite Decline (95% CI)";
            color = isImprovement ? "#4ade80" : "#f87171"; // Green or Red
        } else if (isSig80) {
            status = "Moderate";
            message = isImprovement ? "Likely Improvement (80% CI)" : "Likely Decline (80% CI)";
            color = isImprovement ? "#facc15" : "#f87171"; // Yellow or Red
        }

        return {
            isSignificant: isSig95 || isSig80,
            status,
            confidenceLevel: isSig95 ? 95 : (isSig80 ? 80 : 0),
            criticalDifference95: parseFloat(criticalDifference95.toFixed(2)),
            criticalDifference80: parseFloat(criticalDifference80.toFixed(2)),
            diff: parseFloat(diff.toFixed(1)),
            message,
            color
        };
    } else {
        // Fallback for Manual Mode or insufficient stats
        return {
            isSignificant: false,
            message: "Cannot calculate significance (Missing Statistical Data).",
            color: "#94a3b8"
        };
    }
};
