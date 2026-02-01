import React, { useState, useEffect, useRef } from 'react';
import './AutoTrackingPhase.css';
import TestGraph from './TestGraph';

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
    // Refs for logic loop to avoid stale closures
    const REVERSAL_THRESHOLD = 6; // Keep for reference, but logic is now dynamic

    const stateRef = useRef({
        noiseLevel: speechLevel - 10,
        isSpaceHeld: false,
        isNoiseIncreasing: true, // Renamed from direction (derived boolean)
        reversalCount: 0, // Renamed from reversals
        reversalCount: 0, // Renamed from reversals
        dbPerSecond: 2.0, // Initial fast rate
        reversalLevels: [], // Capture levels at reversal points
        lastReversalTime: 0, // Debounce: Timestamp of last valid reversal
        lastUpdate: 0,
        stats: { slope: 0, stdDev: 0, mean: 0 },
        isFinishing: false
    });

    // Calculate Average Excursion Width
    const calculateExcursionWidth = (levels) => {
        if (levels.length < 4) return 0; // Need at least 3 diffs (so 4 points)

        let sumDiffs = 0;
        let count = 0;

        // Iterate through reversal levels, calculating diffs
        for (let i = 1; i < levels.length; i++) {
            const diff = Math.abs(levels[i] - levels[i - 1]);

            // Exclude the first 2 differences (indices 0 and 1 relative to the diff array)
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
        if (reversalLevels.length >= 4) {
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
        const finalPoint = history[history.length - 1];
        const eBNL = finalPoint ? finalPoint.noise : speechLevel - 10;
        const eANL = speechLevel - eBNL;

        const reversals = [];
        const reversalTimes = [];

        for (let i = 1; i < history.length - 1; i++) {
            const prev = history[i - 1].noise;
            const curr = history[i].noise;
            const next = history[i + 1].noise;
            if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
                reversals.push(curr);
                reversalTimes.push(history[i].t);
            }
        }

        // Calculate Stabilization Time (Time of 3rd reversal, index 2)
        const stabilization_seconds = reversalTimes.length >= 3 ? reversalTimes[2] : null;

        // Interpret Stabilization Time
        const getStabilizationInterpretation = (seconds) => {
            if (seconds === null) return "Did Not Stabilize";
            if (seconds < 10) return "Suspiciously Fast (Check for 'Set-and-Forget' behavior)";
            if (seconds < 30) return "High Certainty (Fast Convergence)";
            if (seconds <= 60) return "Normal";
            return "Delayed (High Difficulty/Uncertainty)";
        };
        const stabilization_status = getStabilizationInterpretation(stabilization_seconds);

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

        // Calculate Stats for Validity (Standard Error & CI)
        let finalStats = { se: 0, ci95: 0, stdDev: 0 };
        if (reversals.length >= 4) {
            const validReversals = reversals.slice(3);
            if (validReversals.length >= 4) { // Need at least 4 for valid stats
                const n = validReversals.length;
                const mean = validReversals.reduce((a, b) => a + b, 0) / n;
                const variance = validReversals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
                const stdDev = Math.sqrt(variance);
                const se = stdDev / Math.sqrt(n);
                const ci95 = 1.96 * se;

                finalStats = { se, ci95, stdDev };
            }
        }

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

        return {
            score: {
                eANL: parseFloat(eANL.toFixed(1)),
                eBNL: parseFloat(eBNL.toFixed(1))
            },
            validity: {
                aANL: aANL,
                aBNL: aBNL,
                se: parseFloat(finalStats.se.toFixed(2)),
                ci95: parseFloat(finalStats.ci95.toFixed(2)),
                reliability_status,
                reliability_diff,
                stabilization_status
            },
            meta: {
                speech_level: speechLevel,
                reversal_count: reversals.length,
                duration_seconds: finalPoint ? parseFloat(finalPoint.t.toFixed(1)) : 0,
                stabilization_seconds: stabilization_seconds !== null ? parseFloat(stabilization_seconds.toFixed(1)) : null
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
                avgExcursion: parseFloat(calculateExcursionWidth(stateRef.current.reversalLevels)),
                reason,
                history: finalHistory // Pass full history for graphing
            });
        }, 0);
    };

    useEffect(() => {
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

        const handleBlur = () => {
            // Safety: If window loses focus, release the key
            if (stateRef.current.isSpaceHeld) {
                setIsSpaceHeld(false);
                stateRef.current.isSpaceHeld = false;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    useEffect(() => {
        let animationFrame;

        if (isPlaying && !isFinished) {
            play();
            setSpeechVolume(speechLevel - 95);

            const getCurrentTrackingRate = (reversalCount) => {
                // Warm Start Logic: Removed 2.0 dB/s sprint since we start at Speech-10
                if (reversalCount < 4) return 1.0;   // Standard learning speed
                return 0.5;                          // Precision phase
            };

            const checkStoppingCriteria = (history, t, reversalCount) => {
                // Guardrail 1: Time (Minimum 60 seconds)
                if (t < 60) return false;

                // Guardrail 2: Data Density (Minimum 7 reversals)
                if (reversalCount < 7) return false;

                // --- CI Calculation (New) ---
                // 1. Get all captured reversal levels
                const allReversals = stateRef.current.reversalLevels;

                // 2. Drop the first 3 (stabilization)
                const validReversals = allReversals.slice(3);

                // 3. Need at least 4 valid points for stats
                if (validReversals.length < 4) return false;

                // 4. Calculate Stats (Mean, StdDev, SE, CI)
                const n = validReversals.length;
                const mean = validReversals.reduce((a, b) => a + b, 0) / n;
                const variance = validReversals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1); // Sample Variance
                const stdDev = Math.sqrt(variance);
                const standardError = stdDev / Math.sqrt(n);
                const ci95 = 1.96 * standardError; // Margin of Error

                // --- Existing Slope Logic (Still valuable for trend detection) ---
                const windowData = history.filter(pt => pt.t >= t - 30);
                let slope = 0;
                let windowStdDev = 0;

                if (windowData.length > 10) {
                    const nW = windowData.length;
                    const sumX = windowData.reduce((acc, pt) => acc + pt.t, 0);
                    const sumY = windowData.reduce((acc, pt) => acc + pt.noise, 0);
                    const sumXY = windowData.reduce((acc, pt) => acc + (pt.t * pt.noise), 0);
                    const sumX2 = windowData.reduce((acc, pt) => acc + (pt.t * pt.t), 0);

                    const numerator = (nW * sumXY) - (sumX * sumY);
                    const denominator = (nW * sumX2) - (sumX * sumX);
                    slope = denominator !== 0 ? numerator / denominator : 0;

                    const windowMean = sumY / nW;
                    const windowVariance = windowData.reduce((acc, pt) => acc + Math.pow(pt.noise - windowMean, 2), 0) / nW;
                    windowStdDev = Math.sqrt(windowVariance);
                }

                stateRef.current.stats = { slope, stdDev: windowStdDev, mean, ci95 };

                // Smart Stop Condition:
                // 1. Confidence Interval is tight (<= 2.5 dB)
                // 2. Slope is flat (<= 0.05) - ensures we aren't drifting
                if (ci95 <= 2.5 && Math.abs(slope) <= 0.05) {
                    // console.log(`Smart Stop Triggered! CI: ${ci95.toFixed(2)}, Slope: ${slope.toFixed(3)}`);
                    return true;
                }

                return false;
            };

            const loop = () => {
                const now = Date.now();
                const dt = (now - stateRef.current.lastUpdate) / 1000;

                if (dt >= 0.1) {
                    stateRef.current.lastUpdate = now;

                    const isNoiseIncreasing = !stateRef.current.isSpaceHeld;

                    if (isNoiseIncreasing !== stateRef.current.isNoiseIncreasing) {
                        const now = Date.now();
                        const TIME_SINCE_LAST_REVERSAL = now - stateRef.current.lastReversalTime;

                        // DEBOUNCE: 1000ms (1 second) guardrail
                        if (TIME_SINCE_LAST_REVERSAL > 1000) {
                            stateRef.current.reversalCount += 1;
                            stateRef.current.reversalLevels.push(stateRef.current.noiseLevel);
                            stateRef.current.lastReversalTime = now;
                            setReversalCount(stateRef.current.reversalCount);

                            if (stateRef.current.reversalCount >= REVERSAL_THRESHOLD) {
                                // Rate is now dynamic calculated per frame below
                            }

                            // ONLY update direction if we passed the debounce check
                            stateRef.current.isNoiseIncreasing = isNoiseIncreasing;
                        } else {
                            // Ignore the input change completely (Heavy controls)
                            // console.log("Reversal ignored (too fast)", TIME_SINCE_LAST_REVERSAL);
                        }
                    }

                    const directionMultiplier = isNoiseIncreasing ? 1 : -1;

                    // Dynamic Rate Calculation
                    const currentRate = getCurrentTrackingRate(stateRef.current.reversalCount);
                    stateRef.current.dbPerSecond = currentRate; // Update ref for display/debugging

                    const change = directionMultiplier * currentRate * dt;

                    let newNoise = stateRef.current.noiseLevel + change;
                    newNoise = Math.max(0, Math.min(100, newNoise));

                    stateRef.current.noiseLevel = newNoise;
                    setNoiseLevel(newNoise);

                    const metrics = calculateLiveMetrics(newNoise, stateRef.current.reversalLevels, speechLevel);
                    setCurrentEANL(metrics.eANL.toFixed(1));
                    setCurrentAANL(metrics.aANL !== null ? metrics.aANL.toFixed(1) : null);

                    setNoiseVolume(newNoise - 95);

                    const t = (now - startTime) / 1000;
                    setHistory(prev => {
                        const newHistory = [...prev, { t, noise: newNoise }];

                        if (t >= 120) { // Timeout at 2 min
                            finishTest(newHistory, "Timeout (2 min)");
                            return newHistory;
                        }

                        // Check Stopping Criteria
                        if (checkStoppingCriteria(newHistory, t, stateRef.current.reversalCount)) {
                            finishTest(newHistory, "Stable Criteria Met");
                            return newHistory;
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
            dbPerSecond: 1.0, // Initial Rate for Warm Start
            reversalLevels: [],
            lastReversalTime: 0,
            lastUpdate: Date.now(),
            stats: { slope: 0, stdDev: 0, mean: 0 },
            isFinishing: false
        };
        setNoiseLevel(startLevel);
        setReversalCount(0);
        setCurrentEANL(null);
        setCurrentAANL(null);
        setHistory([{ t: 0, noise: startLevel }]);
        setStartTime(Date.now());
        setIsPlaying(true);
        setIsFinished(false);
    };

    const handleFinish = () => {
        finishTest(history, "Manual Stop");
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
                    <span className="badge">Reversals: <strong>{reversalCount}</strong></span>
                    <span className="badge">
                        Rate: <strong>{reversalCount < 4 ? '1.0' : '0.5'} dB/s</strong>
                    </span>
                    <span className="badge" style={{ background: '#334155', border: '1px solid #475569' }}>
                        eANL: <strong>{currentEANL !== null ? currentEANL : '--'} dB</strong>
                    </span>
                    <span className="badge" style={{ background: '#334155', border: '1px solid #475569', opacity: currentAANL ? 1 : 0.5 }}>
                        aANL: <strong>{currentAANL !== null ? currentAANL : '--'} dB</strong>
                    </span>
                </div>
            </div>

            <div className="graph-container">
                <TestGraph history={history} speechLevel={speechLevel} />
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
