
import React from 'react';
import TestGraph from './TestGraph';

const ReliabilityDashboard = ({ history, speechLevel, eHANT, aHANT, sd, width = 800, height = 400 }) => {
    // Determine Reliability Status
    let reliabilityStatus = "Waiting...";
    let reliabilityColor = "#9ca3af"; // Gray
    let diff = null;

    if (eHANT !== null && aHANT !== null && history && history.length > 0) {
        // Only calculate if enough time has passed (e.g. 30s for aHANT to be valid)
        // Check if aHANT is actually a number, not null/undefined
        if (typeof aHANT === 'number') {
            diff = Math.abs(eHANT - aHANT).toFixed(1);
            if (diff <= 2.0) {
                reliabilityStatus = "High Reliability";
                reliabilityColor = "#22c55e"; // Green
            } else if (diff <= 5.0) {
                reliabilityStatus = "Moderate Reliability";
                reliabilityColor = "#eab308"; // Yellow
            } else {
                reliabilityStatus = "Low Reliability";
                reliabilityColor = "#ef4444"; // Red
            }
        } else {
            reliabilityStatus = "Collecting Data...";
            reliabilityColor = "#3b82f6"; // Blue
        }
    }

    // Determine Consistency Status based on SD
    let consistencyStatus = "--";
    let consistencyColor = "#64748b"; // Default slate
    if (sd !== null) {
        if (sd <= 4.0) {
            consistencyStatus = "Consistent";
            consistencyColor = "#22c55e";
        } else {
            consistencyStatus = "Inconsistent";
            consistencyColor = "#facc15"; // Warning Yellow
        }
    }

    return (
        <div className="reliability-dashboard">
            <div className="dashboard-grid">
                {/* Graph Section */}
                <div className="graph-card">
                    <h3>Tracking History</h3>
                    <div className="graph-wrapper">
                        <TestGraph
                            history={history}
                            speechLevel={speechLevel}
                            width={width}
                            height={height}
                            showAxes={true}
                        />
                    </div>
                </div>

                {/* Metrics Section */}
                <div className="metrics-column">
                    <div className="metric-card" style={{ borderLeft: `5px solid ${reliabilityColor}` }}>
                        <div className="metric-label">Reliability Status</div>
                        <div className="metric-value status-badge" style={{ color: reliabilityColor }}>
                            {reliabilityStatus}
                        </div>
                        {diff !== null && (
                            <div className="metric-subtext">Diff: {diff} dB</div>
                        )}
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">eHANT (Current)</div>
                        <div className="metric-value">{eHANT !== null ? eHANT.toFixed(1) : '--'} <span className="unit">dB</span></div>
                        <div className="metric-desc">Est. Tolerance</div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">aHANT (Average)</div>
                        <div className="metric-value">{aHANT !== null && typeof aHANT === 'number' ? aHANT.toFixed(1) : '--'} <span className="unit">dB</span></div>
                        <div className="metric-desc">Running Avg (&gt;30s)</div>
                    </div>

                    <div className="metric-card" style={{ borderLeft: `3px solid ${consistencyColor}` }}>
                        <div className="metric-label">Consistency Score</div>
                        <div className="metric-value" style={{ color: consistencyColor, fontSize: '1.4rem' }}>
                            {sd !== null ? sd.toFixed(1) : '--'} <span className="unit">dB (SD)</span>
                        </div>
                        <div className="metric-desc" style={{ color: consistencyColor }}>{consistencyStatus}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReliabilityDashboard;
