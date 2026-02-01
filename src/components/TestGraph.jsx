import React from 'react';

const TestGraph = ({ history, speechLevel, width = 600, height = 300, showAxes = true }) => {
    if (!history || history.length < 2) return null;

    // SVG Config
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;

    // Calculate max time for X-axis
    // If live, we might want to scale dynamically. Use last point's time.
    // Enforce minimum 60s width for visual consistency
    const lastTime = history[history.length - 1].t;
    const maxTime = Math.max(60, lastTime);

    // Y-Axis Range
    const minDb = 0;
    const maxDb = 100;

    const xScale = (t) => margin.left + (t / maxTime) * graphWidth;
    const yScale = (db) => margin.top + graphHeight - (db / maxDb) * graphHeight;

    // Speech Line
    const speechY = yScale(speechLevel);

    // Noise Path
    const pathD = history.map((pt, i) => {
        return `${i === 0 ? 'M' : 'L'} ${xScale(pt.t)} ${yScale(pt.noise)}`;
    }).join(' ');

    // X-Axis Ticks (adaptive interval)
    // If < 120s, every 15s. If > 120s, every 30s.
    const xTickInterval = maxTime > 120 ? 30 : 15;
    const xTicks = [];
    for (let t = 0; t <= maxTime; t += xTickInterval) {
        xTicks.push(t);
    }

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="graph" preserveAspectRatio="xMidYMid meet">
            {/* Background Grid */}
            <rect x={margin.left} y={margin.top} width={graphWidth} height={graphHeight} fill="#1e293b" rx="4" />

            {/* Horizontal Grid Lines & Y-Axis Labels */}
            {[0, 25, 50, 75, 100].map(db => (
                <g key={db}>
                    <line
                        x1={margin.left} y1={yScale(db)}
                        x2={width - margin.right} y2={yScale(db)}
                        stroke="#334155" strokeWidth="1"
                    />
                    <text
                        x={margin.left - 10}
                        y={yScale(db)}
                        fill="#94a3b8"
                        fontSize="12"
                        textAnchor="end"
                        alignmentBaseline="middle"
                    >
                        {db}
                    </text>
                </g>
            ))}

            {/* Vertical Grid Lines & X-Axis Labels */}
            {xTicks.map(t => (
                <g key={t}>
                    <line
                        x1={xScale(t)} y1={margin.top}
                        x2={xScale(t)} y2={height - margin.bottom}
                        stroke="#334155" strokeWidth="1"
                        strokeOpacity="0.5"
                    />
                    <text
                        x={xScale(t)}
                        y={height - margin.bottom + 15}
                        fill="#94a3b8"
                        fontSize="12"
                        textAnchor="middle"
                    >
                        {t}
                    </text>
                </g>
            ))}

            {/* Speech Line */}
            <line
                x1={margin.left} y1={speechY}
                x2={width - margin.right} y2={speechY}
                stroke="#22c55e" strokeWidth="2" strokeDasharray="5,5"
            />
            {showAxes && (
                <text x={width - margin.right + 5} y={speechY} fill="#22c55e" fontSize="12" alignmentBaseline="middle">Speech</text>
            )}

            {/* Noise Line */}
            <path d={pathD} stroke="#3b82f6" strokeWidth="2" fill="none" />

            {/* Axes Lines */}
            <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="#94a3b8" strokeWidth="2" />
            <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#94a3b8" strokeWidth="2" />

            {/* Axis Titles */}
            {showAxes && (
                <>
                    <text
                        x={width / 2}
                        y={height - 10}
                        fill="#cbd5e1"
                        fontSize="14"
                        fontWeight="bold"
                        textAnchor="middle"
                    >
                        Time (seconds)
                    </text>
                    <text
                        x={15}
                        y={height / 2}
                        fill="#cbd5e1"
                        fontSize="14"
                        fontWeight="bold"
                        textAnchor="middle"
                        transform={`rotate(-90, 15, ${height / 2})`}
                    >
                        Level (dB)
                    </text>
                </>
            )}
        </svg>
    );
};

export default TestGraph;
