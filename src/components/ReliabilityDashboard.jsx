
import React from 'react';
import TestGraph from './TestGraph';

const ReliabilityDashboard = ({ history, speechLevel, eHANT, aHANT, sd, stabilitySD, width = 800, height = 400 }) => {
    // Determine Tracking Stability Status
    let stabilityStatus = "Waiting...";
    let stabilityColor = "#9ca3af"; // Gray
    let stabilityValue = null;

    // Use stabilitySD if provided (new logic), otherwise fallback (shouldn't happen with new AutoTrackingPhase)
    if (stabilitySD !== undefined && stabilitySD !== null) {
        stabilityValue = stabilitySD;

        // Thresholds: High <= 2.0, Moderate <= 4.0, Low > 4.0
        if (stabilitySD <= 2.0) {
            stabilityStatus = "High Stability";
            stabilityColor = "#22c55e"; // Green
        } else if (stabilitySD <= 4.0) {
            stabilityStatus = "Moderate Stability";
            stabilityColor = "#eab308"; // Yellow
        } else {
            stabilityStatus = "Low Stability";
            stabilityColor = "#ef4444"; // Red
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
                    <div className="metric-card" style={{ borderLeft: `5px solid ${stabilityColor}` }}>
                        <div className="metric-label">Tracking Stability</div>
                        <div className="metric-value status-badge" style={{ color: stabilityColor }}>
                            {stabilityStatus}
                        </div>
                        {stabilityValue !== null && (
                            <div className="metric-subtext">SD (Last 30s): {stabilityValue} dB</div>
                        )}
                        {stabilityValue === null && eHANT !== null && (
                            <div className="metric-subtext">Calculating... (&gt;30s)</div>
                        )}
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">eHANT (Current)</div>
                        <div className="metric-value">{eHANT !== null ? Number(eHANT).toFixed(1) : '--'} <span className="unit">dB</span></div>
                        <div className="metric-desc">Est. Tolerance</div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">aHANT (Average)</div>
                        <div className="metric-value">{aHANT !== null && typeof aHANT === 'number' ? Number(aHANT).toFixed(1) : '--'} <span className="unit">dB</span></div>
                        <div className="metric-desc">Running Avg (&gt;30s)</div>
                    </div>

                    {/* Excursion Height (Previously Excursion Consistency/SD) 
                        User request 2: "If Avg Excursion Height > 5.0 dB, flag as Possible Guessing"
                        This replaces the consistency score card.
                    */}
                    <div className="metric-card" style={{ borderLeft: `3px solid ${sd !== null && sd > 5.0 ? '#ef4444' : '#22c55e'}` }}>
                        <div className="metric-label">Avg Excursion Height</div>
                        <div className="metric-value" style={{ color: sd !== null && sd > 5.0 ? '#ef4444' : '#22c55e', fontSize: '1.4rem' }}>
                            {sd !== null ? Number(sd).toFixed(1) : '--'} <span className="unit">dB</span>
                        </div>
                        <div className="metric-desc" style={{ color: sd !== null && sd > 5.0 ? '#ef4444' : '#64748b' }}>
                            {sd !== null && sd > 5.0 ? "Wide Excursions" : "Normal"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReliabilityDashboard;
