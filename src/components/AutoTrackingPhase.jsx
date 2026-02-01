import React, { useState, useEffect, useRef } from 'react';
import './AutoTrackingPhase.css';

const AutoTrackingPhase = ({
    speechLevel, // 65 or 75
    onComplete,
    onBack,
    play,
    stop,
    setSpeechVolume,
    setNoiseVolume
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [noiseLevel, setNoiseLevel] = useState(speechLevel - 10); // Start 10dB below speech
    const [history, setHistory] = useState([]); // Array of {t, noise}
    const [startTime, setStartTime] = useState(null);
    const [reversalCount, setReversalCount] = useState(0); // Renamed from reversals
    const [isSpaceHeld, setIsSpaceHeld] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    // Refs for logic loop to avoid stale closures
    const INITIAL_RATE = 1.0;
    const SLOW_RATE = 0.5;
    const REVERSAL_THRESHOLD = 6;

    const stateRef = useRef({
        noiseLevel: speechLevel - 10,
        isSpaceHeld: false,
        isNoiseIncreasing: true, // Renamed from direction (derived boolean)
        reversalCount: 0, // Renamed from reversals
        dbPerSecond: INITIAL_RATE, // Renamed from rate
        reversalLevels: [], // Capture levels at reversal points
        lastReversalTime: 0, // Debounce: Timestamp of last valid reversal
        lastUpdate: 0,
        stats: { slope: 0, stdDev: 0, mean: 0 },
        isFinishing: false
    });

    // Calculate Average Excursion Width
    const calculateExcursionWidth = (levels) => {
        if (levels.length < 4) return 0; // Need at least 3 diffs (so 4 points) to count anything after ignoring first 2

        let sumDiffs = 0;
        let count = 0;

        // Iterate through reversal levels, calculating diffs
        for (let i = 1; i < levels.length; i++) {
            const diff = Math.abs(levels[i] - levels[i - 1]);

            // Exclude the first 2 differences (indices 0 and 1 relative to the diff array)
            // i=1 is Diff 1 (Level 1 - Level 0). i=2 is Diff 2. i=3 is Diff 3.
            // We want to skip Diff 1 and Diff 2. So start counting from i=3.
            if (i >= 3) {
                sumDiffs += diff;
                count++;
            }
        }

        return count > 0 ? (sumDiffs / count).toFixed(1) : 0;
    };

    // Live Metrics State
    const [currentEANL, setCurrentEANL] = useState(null);
    const [currentAANL, setCurrentAANL] = useState(null);

    // Helper: Calculate Metrics from current state
    const calculateLiveMetrics = (currentNoise, reversalLevels, speechLvl) => {
        // eANL
        const eANL = speechLvl - currentNoise;

        // aANL
        let aANL = null;
        if (reversalLevels.length >= 4) { // Need at least 4 to have any left after discarding 3
            const validReversals = reversalLevels.slice(3);
            if (validReversals.length > 0) {
                const sum = validReversals.reduce((a, b) => a + b, 0);
                const aBNL = sum / validReversals.length;
                aANL = speechLvl - aBNL;
            }
        }

        return { eANL, aANL };
    };

    // Generate Final Results (Hybrid ANL/TNT Logic)
    const generateFinalResults = (history, speechLevel, stoppingReason) => {
        // ... (Logic is effectively same as live, but using final points)
        // We can reuse the same concepts but keeping existing function for safety/exactness

        // 1. Calculate "Estimated" Metrics (The Score)
        const finalPoint = history[history.length - 1];
        const eBNL = finalPoint ? finalPoint.noise : speechLevel - 10;
        const eANL = speechLevel - eBNL;

        // 2. Calculate "Average" Metrics
        const reversals = [];
        for (let i = 1; i < history.length - 1; i++) {
            const prev = history[i - 1].noise;
            const curr = history[i].noise;
            const next = history[i + 1].noise;
            if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
                reversals.push(curr);
            }
        }

        let aBNL = null;
        let aANL = null;
        if (reversals.length >= 4) {
            const validReversals = reversals.slice(3);
            if (validReversals.length > 0) {
                const sum = validReversals.reduce((a, b) => a + b, 0);
                aBNL = parseFloat((sum / validReversals.length).toFixed(1));
                aANL = parseFloat((speechLevel - aBNL).toFixed(1));
            }
        }

        // 3. Determine Reliability Status
        let reliability_status = "Unknown/Insufficient Data";
        let reliability_diff = null;

        if (aANL !== null) {
            const diff = Math.abs(eANL - aANL);
            reliability_diff = parseFloat(diff.toFixed(1));

            if (diff <= 2.0) {
                reliability_status = "High";
            } else if (diff <= 4.0) {
                reliability_status = "Medium";
            } else {
                reliability_status = "Low";
            }
        }

        // 4. Return Structured Object
        return {
            score: {
                eANL: parseFloat(eANL.toFixed(1)),
                eBNL: parseFloat(eBNL.toFixed(1))
            },
            validity: {
                aANL: aANL,
                aBNL: aBNL,
                reliability_status,
                reliability_diff
            },
            meta: {
                speech_level: speechLevel,
                reversal_count: reversals.length,
                duration_seconds: finalPoint ? parseFloat(finalPoint.t.toFixed(1)) : 0
            }
        };
    };

    // Helper to safely finish
    const finishTest = (finalHistory, reason) => {
        if (stateRef.current.isFinishing) return;
        stateRef.current.isFinishing = true;

        const results = generateFinalResults(finalHistory, speechLevel, reason);
        const { score, validity } = results;

        console.log(`[AutoTracking] Finished: ${reason}`, results);

        setTimeout(() => {
            setIsPlaying(false);
            setIsFinished(true);

            // Merge with fields expected by Results.jsx
            onComplete({
                ...results, // Include full structured object
                mcl: speechLevel,
                bnl: Math.round(score.eBNL), // Backward compatibility
                avgExcursion: parseFloat(calculateExcursionWidth(stateRef.current.reversalLevels)), // Keep excursion if Results uses it
                reason
            });
        }, 0);
    };

    useEffect(() => {
        // Keyboard listeners
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                if (!e.repeat) {
                    setIsSpaceHeld(true);
                    stateRef.current.isSpaceHeld = true;
                    e.preventDefault();
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                setIsSpaceHeld(false);
                stateRef.current.isSpaceHeld = false;
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        let animationFrame;

        if (isPlaying && !isFinished) {
            // Start audio
            play();
            setSpeechVolume(speechLevel - 95);

            const loop = () => {
                const now = Date.now();
                const dt = (now - stateRef.current.lastUpdate) / 1000; // delta in seconds

                if (dt >= 0.1) { // Process roughly every 100ms
                    stateRef.current.lastUpdate = now;

                    // Logic: If space is held, noise decreases (isNoiseIncreasing = false)
                    const isNoiseIncreasing = !stateRef.current.isSpaceHeld;

                    // Detect Reversal: If direction changes
                    if (isNoiseIncreasing !== stateRef.current.isNoiseIncreasing) {
                        const now = Date.now();

                        // Debounce: Only count if > 500ms since last reversal
                        if (now - stateRef.current.lastReversalTime > 500) {
                            stateRef.current.reversalCount += 1;
                            stateRef.current.reversalLevels.push(stateRef.current.noiseLevel); // Capture Level
                            stateRef.current.lastReversalTime = now;
                            setReversalCount(stateRef.current.reversalCount); // Update UI state

                            // Adapt Rate
                            if (stateRef.current.reversalCount >= REVERSAL_THRESHOLD) {
                                stateRef.current.dbPerSecond = SLOW_RATE;
                            }
                        } else {
                            // Ignored Reversal (Jitter/Double-click)
                            console.log("Reversal ignored (debounce)", now - stateRef.current.lastReversalTime);
                        }

                        stateRef.current.isNoiseIncreasing = isNoiseIncreasing;
                    }

                    // Update Level
                    // Dictionary direction: true (+1), false (-1)
                    const directionMultiplier = isNoiseIncreasing ? 1 : -1;
                    const change = directionMultiplier * stateRef.current.dbPerSecond * dt;

                    let newNoise = stateRef.current.noiseLevel + change;
                    newNoise = Math.max(0, Math.min(100, newNoise)); // Clamp

                    stateRef.current.noiseLevel = newNoise;
                    setNoiseLevel(newNoise);

                    // --- Live Metrics Update (New) ---
                    const metrics = calculateLiveMetrics(newNoise, stateRef.current.reversalLevels, speechLevel);
                    setCurrentEANL(metrics.eANL.toFixed(1));
                    setCurrentAANL(metrics.aANL !== null ? metrics.aANL.toFixed(1) : null);

                    // Update Audio
                    setNoiseVolume(newNoise - 95);

                    // Update Graph Data
                    const t = (now - startTime) / 1000;
                    setHistory(prev => {
                        const newHistory = [...prev, { t, noise: newNoise }];

                        // --- Stopping Criteria Logic ---

                        // 1. Hard Timeout (120s)
                        if (t >= 120) {
                            finishTest(newHistory, "Timeout (2 min)");
                            return newHistory;
                        }

                        // 2. Stability Check (After 30s)
                        if (t >= 30) {
                            // Get last 30s of data
                            const windowData = newHistory.filter(pt => pt.t >= t - 30);

                            if (windowData.length > 10) { // Ensure enough points
                                // Calculate Statistics
                                const n = windowData.length;
                                const sumX = windowData.reduce((acc, pt) => acc + pt.t, 0);
                                const sumY = windowData.reduce((acc, pt) => acc + pt.noise, 0);
                                const sumXY = windowData.reduce((acc, pt) => acc + (pt.t * pt.noise), 0);
                                const sumX2 = windowData.reduce((acc, pt) => acc + (pt.t * pt.t), 0);

                                // Slope (m)
                                const numerator = (n * sumXY) - (sumX * sumY);
                                const denominator = (n * sumX2) - (sumX * sumX);
                                const slope = denominator !== 0 ? numerator / denominator : 0;

                                // Standard Deviation (SD)
                                const mean = sumY / n;
                                const variance = windowData.reduce((acc, pt) => acc + Math.pow(pt.noise - mean, 2), 0) / n;
                                const stdDev = Math.sqrt(variance);

                                stateRef.current.stats = { slope, stdDev, mean };

                                // Criteria: Slope approx 0 (+/- 0.05) AND Variance/SD < 2
                                if (Math.abs(slope) <= 0.05 && stdDev < 2.0) {
                                    finishTest(newHistory, "Stable Criteria Met", mean);
                                    return newHistory;
                                }
                            }
                        }

                        return newHistory;
                    });
                }

                animationFrame = requestAnimationFrame(loop);
            };

            stateRef.current.lastUpdate = Date.now();
            loop();
        } else {
            stop();
        }

        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying, isFinished, speechLevel, play, stop, setSpeechVolume, setNoiseVolume, startTime]);

    const handleStart = () => {
        const startLevel = speechLevel - 10;
        stateRef.current = {
            noiseLevel: startLevel,
            isSpaceHeld: false,
            isNoiseIncreasing: true,
            reversalCount: 0,
            dbPerSecond: INITIAL_RATE,
            reversalLevels: [], // Initialize array to prevent crash
            lastReversalTime: 0,
            lastUpdate: Date.now(),
            stats: { slope: 0, stdDev: 0, mean: 0 },
            isFinishing: false
        };
        setNoiseLevel(startLevel);
        setReversalCount(0);
        setCurrentEANL(null); // Reset
        setCurrentAANL(null);
        setHistory([{ t: 0, noise: startLevel }]);
        setStartTime(Date.now());
        setIsPlaying(true);
        setIsFinished(false);
    };

    const handleFinish = () => {
        finishTest(history, "Manual Stop");
    };

    // Graph Rendering Helper
    const renderGraph = () => {
        if (history.length < 2) return null;

        // SVG Config
        const width = 600;
        const height = 300;
        const margin = { top: 20, right: 30, bottom: 50, left: 60 }; // Increased margins for labels
        const graphWidth = width - margin.left - margin.right;
        const graphHeight = height - margin.top - margin.bottom;

        const maxTime = Math.max(60, history[history.length - 1].t); // Min 60s width
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

        // X-Axis Ticks (every 15s or 30s depending on scale)
        const xTickInterval = maxTime > 120 ? 30 : 15;
        const xTicks = [];
        for (let t = 0; t <= maxTime; t += xTickInterval) {
            xTicks.push(t);
        }

        return (
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="graph" preserveAspectRatio="xMidYMid meet">
                {/* Background Grid */}
                <rect x={margin.left} y={margin.top} width={graphWidth} height={graphHeight} fill="#1e293b" />

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
                <text x={width - margin.right + 5} y={speechY} fill="#22c55e" fontSize="12" alignmentBaseline="middle">Speech</text>

                {/* Noise Line */}
                <path d={pathD} stroke="#3b82f6" strokeWidth="2" fill="none" />

                {/* Axes Lines */}
                <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="#94a3b8" strokeWidth="2" />
                <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#94a3b8" strokeWidth="2" />

                {/* Axis Titles */}
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
            </svg>
        );
    };

    return (
        <div className="auto-tracking-container card">
            <div className="header">
                <h2>Automatic BNL Test</h2>
                <p className="instruction" style={{ color: '#cbd5e1', margin: '1rem 0', fontSize: '1.1rem', fontStyle: 'italic' }}>
                    "Instruct listeners to maintain the noise at the highest level where they can still understand ≥90% of the words."
                </p>
                <div className="status-badges">
                    <span className="badge">Speech: <strong>{speechLevel} dB</strong></span>
                    <span className="badge">Noise: <strong>{noiseLevel.toFixed(1)} dB</strong></span>
                    <span className="badge">Reversals: <strong>{reversalCount}</strong></span>
                    <span className="badge" style={{ opacity: reversalCount >= 6 ? 1 : 0.5 }}>
                        Rate: <strong>{reversalCount >= 6 ? '0.5' : '1.0'} dB/s</strong>
                    </span>
                    {/* Live Metrics */}
                    <span className="badge" style={{ background: '#334155', border: '1px solid #475569' }}>
                        eANL: <strong>{currentEANL !== null ? currentEANL : '--'} dB</strong>
                    </span>
                    <span className="badge" style={{ background: '#334155', border: '1px solid #475569', opacity: currentAANL ? 1 : 0.5 }}>
                        aANL: <strong>{currentAANL !== null ? currentAANL : '--'} dB</strong>
                    </span>
                </div>
            </div>

            <div className="graph-container">
                {renderGraph()}
            </div>

            {isPlaying ? (
                <div className="controls-active">
                    <div className={`instruction-panel ${isSpaceHeld ? 'active' : ''}`}>
                        {isSpaceHeld ? 'Decreasing Noise...' : 'Hold SPACEBAR to Decrease Noise'}
                    </div>
                    <button className="confirm-btn finish-btn" onClick={handleFinish}>
                        Stop & Finish
                    </button>
                </div>
            ) : (
                <div className="controls-start">
                    <p>Press Start to begin the automatic test.</p>
                    <div className="action-buttons">
                        <button className="secondary-btn" onClick={onBack}>Back</button>
                        <button className="confirm-btn" onClick={handleStart}>Start</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutoTrackingPhase;
