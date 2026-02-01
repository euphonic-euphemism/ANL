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
    const [reversals, setReversals] = useState(0);
    const [isSpaceHeld, setIsSpaceHeld] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    // Refs for logic loop to avoid stale closures
    const INITIAL_RATE = 1.0;
    const SLOW_RATE = 0.5;
    const REVERSAL_THRESHOLD = 6;

    const stateRef = useRef({
        noiseLevel: speechLevel - 10,
        isSpaceHeld: false,
        direction: 1, // 1 = up, -1 = down
        reversals: 0,
        rate: INITIAL_RATE,
        lastUpdate: 0,
        stats: { slope: 0, stdDev: 0, mean: 0 },
        isFinishing: false
    });

    // Helper to safely finish
    const finishTest = (finalHistory, reason) => {
        if (stateRef.current.isFinishing) return;
        stateRef.current.isFinishing = true;

        let finalBnl = stateRef.current.noiseLevel;
        if (reason === "Stable Criteria Met" && stateRef.current.stats) {
            finalBnl = stateRef.current.stats.mean;
        }

        console.log(`[AutoTracking] Finishing: ${reason}. Final BNL: ${finalBnl}`);

        setTimeout(() => {
            setIsPlaying(false);
            setIsFinished(true);
            onComplete({ mcl: speechLevel, bnl: Math.round(finalBnl), reason });
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
            setSpeechVolume(speechLevel - 85);

            const loop = () => {
                const now = Date.now();
                const dt = (now - stateRef.current.lastUpdate) / 1000; // delta in seconds

                if (dt >= 0.1) { // Process roughly every 100ms
                    stateRef.current.lastUpdate = now;

                    // Logic
                    const currentDirection = stateRef.current.isSpaceHeld ? -1 : 1;

                    // Detect Reversal
                    if (currentDirection !== stateRef.current.direction) {
                        stateRef.current.reversals += 1;
                        setReversals(stateRef.current.reversals);

                        // Adapt Rate
                        if (stateRef.current.reversals >= REVERSAL_THRESHOLD) {
                            stateRef.current.rate = SLOW_RATE;
                        }

                        stateRef.current.direction = currentDirection;
                    }

                    // Update Level
                    const change = currentDirection * stateRef.current.rate * dt;
                    let newNoise = stateRef.current.noiseLevel + change;
                    newNoise = Math.max(0, Math.min(100, newNoise)); // Clamp

                    stateRef.current.noiseLevel = newNoise;
                    setNoiseLevel(newNoise);

                    // Update Audio
                    setNoiseVolume(newNoise - 85);

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
                                    finishTest(newHistory, "Stable Criteria Met");
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
            direction: 1,
            reversals: 0,
            rate: INITIAL_RATE,
            lastUpdate: Date.now(),
            stats: { slope: 0, stdDev: 0, mean: 0 },
            isFinishing: false
        };
        setNoiseLevel(startLevel);
        setReversals(0);
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
        const padding = 20;

        const maxTime = Math.max(60, history[history.length - 1].t); // Min 60s width
        const minDb = 0;
        const maxDb = 100;

        const xScale = (t) => padding + (t / maxTime) * (width - 2 * padding);
        const yScale = (db) => height - padding - (db / maxDb) * (height - 2 * padding);

        // Speech Line
        const speechY = yScale(speechLevel);

        // Noise Path
        const pathD = history.map((pt, i) => {
            return `${i === 0 ? 'M' : 'L'} ${xScale(pt.t)} ${yScale(pt.noise)}`;
        }).join(' ');

        return (
            <svg width="100%" height="300" viewBox={`0 0 ${width} ${height}`} className="graph">
                {/* Background Grid */}
                <rect x={padding} y={padding} width={width - 2 * padding} height={height - 2 * padding} fill="#1e293b" />

                {/* Horizontal Grid Lines */}
                {[0, 25, 50, 75, 100].map(db => (
                    <line
                        key={db}
                        x1={padding} y1={yScale(db)}
                        x2={width - padding} y2={yScale(db)}
                        stroke="#334155" strokeWidth="1"
                    />
                ))}

                {/* Speech Line */}
                <line
                    x1={padding} y1={speechY}
                    x2={width - padding} y2={speechY}
                    stroke="#22c55e" strokeWidth="2" strokeDasharray="5,5"
                />
                <text x={width - padding + 5} y={speechY} fill="#22c55e" fontSize="12" alignmentBaseline="middle">Speech ({speechLevel})</text>

                {/* Noise Line */}
                <path d={pathD} stroke="#3b82f6" strokeWidth="2" fill="none" />

                {/* Axes */}
                <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#94a3b8" />
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#94a3b8" />
            </svg>
        );
    };

    return (
        <div className="auto-tracking-container card">
            <div className="header">
                <h2>Automatic BNL Test</h2>
                <div className="status-badges">
                    <span className="badge">Speech: <strong>{speechLevel} dB</strong></span>
                    <span className="badge">Noise: <strong>{noiseLevel.toFixed(1)} dB</strong></span>
                    <span className="badge">Reversals: <strong>{reversals}</strong></span>
                    <span className="badge" style={{ opacity: reversals >= 6 ? 1 : 0.5 }}>
                        Rate: <strong>{reversals >= 6 ? '0.5' : '1.0'} dB/s</strong>
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
