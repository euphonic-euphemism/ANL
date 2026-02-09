import React, { useState, useEffect, useRef } from 'react';
import './AutoTrackingPhase.css';
import TestGraph from './TestGraph';
import ReliabilityDashboard from './ReliabilityDashboard';
import './ReliabilityDashboard.css';

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
        dbPerSecond: 2.0, // Initial fast rate
        reversalLevels: [], // Capture levels at reversal points
        lastReversalTime: 0, // Debounce: Timestamp of last valid reversal
        lastUpdate: 0,
        stats: { slope: 0, stdDev: 0, mean: 0 },
        isFinishing: false,
        // New: Track running average for aHANT (t > 30s)
        sumNoiseAfter30: 0,
        countNoiseAfter30: 0
    });

    // Calculate Average Excursion Width (Existing helper, keeping for now)
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

    // New Helper: Identify Reversal Points (Peaks and Valleys)
    // Returns array of {x, y} coordinates, ignoring the first `ignoreSeconds`
    const identifyReversalPoints = (history, ignoreSeconds = 30) => {
        const validData = history.filter(pt => pt.t > ignoreSeconds);
        if (validData.length < 3) return []; // Need at least 3 points for a peak/valley

        const reversals = [];

        for (let i = 1; i < validData.length - 1; i++) {
            const prev = validData[i - 1].noise;
            const curr = validData[i].noise;
            const next = validData[i + 1].noise;

            // Strict local extrema check (Peak: increasing->decreasing OR Valley: decreasing->increasing)
            if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
                reversals.push({ x: validData[i].t, y: curr });
            }
        }
        return reversals;
    };

    // New Helper: Calculate Average HANT (Running Average > 30s)
    const calculateAverageHANT = (history, speechLvl) => {
        const lateData = history.filter(pt => pt.t > 30);
        if (lateData.length === 0) return { aBNL: null, aANL: null };

        const sum = lateData.reduce((a, b) => a + b.noise, 0);
        const aBNL = sum / lateData.length;
        const aANL = aBNL - speechLvl;

        return { aBNL, aANL, count: lateData.length };
    };

    const [currentEANL, setCurrentEANL] = useState(null);
    const [currentAANL, setCurrentAANL] = useState(null);
    const [currentSD, setCurrentSD] = useState(null); // New state for live SD

    // Helper: Calculate Metrics from current state
    const calculateLiveMetrics = (currentNoise, reversalLevels, speechLvl, sumNoiseAfter30, countNoiseAfter30) => {
        // eANL
        const eANL = currentNoise - speechLvl;

        // aANL (Running Average after 30s)
        let aANL = null;
        if (countNoiseAfter30 > 0) {
            const aBNL = sumNoiseAfter30 / countNoiseAfter30;
            aANL = aBNL - speechLvl;
        }

        return { eANL, aANL };
    };



    // New Helper: Calculate Average Excursion Height (dB)
    // Input: Array of {x, y} reversal points (peaks and valleys)
    const calculateAverageExcursionHeight = (reversalPoints) => {
        if (reversalPoints.length < 2) return 0; // Need at least 2 points to have a height diff

        let sumHeights = 0;
        let count = 0;

        for (let i = 1; i < reversalPoints.length; i++) {
            // Absolute difference between current reversal Y (dB) and previous reversal Y (dB)
            const height = Math.abs(reversalPoints[i].y - reversalPoints[i - 1].y);
            sumHeights += height;
            count++;
        }

        return count > 0 ? sumHeights / count : 0;
    };

    // New Helper: Calculate Stability SD (Standard Deviation of Noise Levels in Last 30s)
    const calculateStabilitySD = (history, duration) => {
        // Filter for points in the last 30 seconds
        const startTime = Math.max(0, duration - 30);
        const lateData = history.filter(pt => pt.t >= startTime);

        if (lateData.length < 2) return 0; // Need at least 2 points for SD

        const values = lateData.map(pt => pt.noise);
        const n = values.length;
        const mean = values.reduce((a, b) => a + b, 0) / n;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);

        return Math.sqrt(variance);
    };

    // Generate Final Results (Hybrid ANL/TNT Logic - Updated eHANT)
    const generateFinalResults = (history, speechLevel, stoppingReason) => {
        // --- Average HANT (Refined Logic: Peaks/Valleys after 30s) ---
        // Using new identifyReversalPoints function
        const reversalPoints = identifyReversalPoints(history, 30);

        const finalPoint = history.length > 0 ? history[history.length - 1] : { t: 0, noise: speechLevel - 10 };
        const durationSeconds = finalPoint ? parseFloat(finalPoint.t.toFixed(1)) : 0;

        let eBNL;
        if (reversalPoints.length > 0) {
            // Calculate mean of the Y-values (Noise Levels) of the reversal points
            const sum = reversalPoints.reduce((acc, pt) => acc + pt.y, 0);
            eBNL = sum / reversalPoints.length;
            console.log(`[AutoTracking] eHANT Calc: Found ${reversalPoints.length} peaks/valleys after 30s. Mean Noise: ${eBNL.toFixed(1)}`);
        } else {
            // Fallback: If no peaks/valleys after 30s (e.g. tracking too smooth or test too short),
            // take average of all data points after 30s.
            const lateData = history.filter(pt => pt.t > 30);
            if (lateData.length > 0) {
                const sum = lateData.reduce((a, b) => a + b.noise, 0);
                eBNL = sum / lateData.length;
                console.log(`[AutoTracking] eHANT Calc: No peaks found. Using average of trailing data (t>30s). Mean Noise: ${eBNL.toFixed(1)}`);
            } else {
                // Fallback 2: Test duration < 30s? Use final point.
                eBNL = finalPoint.noise;
                console.log(`[AutoTracking] eHANT Calc: Test < 30s. Using final point. Noise: ${eBNL.toFixed(1)}`);
            }
        }

        // Apply Formula: eHANT = Noise - Speech
        const eANL = eBNL - speechLevel;

        // --- Average HANT (New Logic: External Function) ---
        const { aBNL, aANL, count } = calculateAverageHANT(history, speechLevel);

        if (aANL !== null) {
            console.log(`[AutoTracking] aHANT Calc: Mean of ${count} points (t>30s). Mean Noise: ${aBNL.toFixed(1)}`);
        } else {
            console.log("[AutoTracking] aHANT Calc: Insufficient data (>30s) for aHANT.");
        }

        const reversals = [];
        const reversalTimes = [];

        // Legacy Reversal Identification (Keeping for Stats/Confidence checks)
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


        // Calculate Stats for Validity (Standard Error & CI)
        let finalStats = { se: 0, ci95: 0, stdDev: 0 };
        // let excursionStats = { meanWidth: 0, sdWidth: 0 }; // Removed sdWidth check

        if (reversals.length >= 4) {
            const validReversals = reversals.slice(3); // Drop first 3
            if (validReversals.length >= 4) { // Need at least 4 for valid stats
                const n = validReversals.length;
                const mean = validReversals.reduce((a, b) => a + b, 0) / n;
                const variance = validReversals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
                const stdDev = Math.sqrt(variance);
                const se = stdDev / Math.sqrt(n);
                const ci95 = 1.96 * se;

                finalStats = { se, ci95, stdDev };


                // Calculate Excursion Stats (Guessing Detection) - OLD Logic Removed
                // excursionStats = calculateExcursionStats(reversalPoints); 
            }
        }

        // --- Tracking Stability Logic (Updated 2026-02-08) ---
        // Uses SD of noise levels in the last 30 seconds
        const stability_sd = calculateStabilitySD(history, durationSeconds);
        const stability_sd_formatted = parseFloat(stability_sd.toFixed(2));

        let stability_status = "Unknown";

        if (durationSeconds >= 30) {
            if (stability_sd <= 2.0) {
                stability_status = "High";
            } else if (stability_sd <= 4.0) {
                stability_status = "Moderate";
            } else {
                stability_status = "Low";
            }
            // Append context if Low Stability due to high drift
            if (stability_status === "Low") {
                stability_status += " (Erratic/Drifting)";
            }
        } else {
            stability_status = "Insufficient Data (<30s)";
        }

        // --- Guessing Logic (Updated 2026-02-08) ---
        // Uses Average Excursion Height > 5.0 dB
        const avgExcursionHeight = calculateAverageExcursionHeight(reversalPoints);

        // Check for Guessing (Average Excursion Height > 5.0 dB)
        // Only trigger if we have enough data (stability status is not insufficient)
        if (durationSeconds >= 30 && avgExcursionHeight > 5.0) {
            stability_status += " (Possible Guessing)";
        }

        // Legacy "Reliability" mapped to new Stability for backward compatibility if needed, 
        // but we are fully replacing it in the UI.

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
                stability_status, // New Key
                stability_sd: stability_sd_formatted, // New Key
                avg_excursion_height: parseFloat(avgExcursionHeight.toFixed(1)), // New Metric

                // Deprecated keys for backward compat (mapped to new values where appropriate or null)
                reliability_status: stability_status,
                reliability_diff: stability_sd_formatted, // Overloaded for now, or just null it? Better to keep semantic meaning clear.

                stabilization_status,
                // excursion_sd removed
            },
            meta: {
                speech_level: speechLevel,
                reversal_count: reversals.length,
                duration_seconds: durationSeconds,
                stabilization_seconds: stabilization_seconds !== null ? parseFloat(stabilization_seconds.toFixed(1)) : null
            }
        };
    };

    // Helper to safely finish
    const finishTest = (finalHistory, reason) => {
        if (stateRef.current.isFinishing) return;
        stateRef.current.isFinishing = true;

        // Force stop loop immediately
        setIsPlaying(false);
        setIsFinished(true);

        try {
            const results = generateFinalResults(finalHistory, speechLevel, reason);
            const { score, validity } = results;

            console.log(`[AutoTracking] Finished: ${reason}`, results);

            // Defer callback to next tick to allow UI update
            setTimeout(() => {
                onComplete({
                    ...results, // Include full structured object
                    mcl: speechLevel,
                    bnl: Math.round(score.eBNL), // Backward compatibility
                    avgExcursion: parseFloat(calculateExcursionWidth(stateRef.current.reversalLevels)),
                    reason,
                    history: finalHistory // Pass full history for graphing
                });
            }, 0);
        } catch (error) {
            console.error("[AutoTracking] Critical Error in finishTest:", error);
            // Fallback: still try to finish so user isn't stuck
            setTimeout(() => {
                onComplete({
                    score: { eANL: 0, eBNL: 0 },
                    validity: { reliability_status: "Error" },
                    mcl: speechLevel,
                    bnl: speechLevel - 10,
                    avgExcursion: 0,
                    reason: `Error: ${reason}`,
                    history: finalHistory
                });
            }, 0);
        }
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
            setNoiseVolume(noiseLevel - 95); // Set initial noise volume immediately

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

                    // Calculate Excursion Stats for live dashboard
                    // Filter reversals for those after 30s to match MEW logic if possible, 
                    // but for live stability we might want all. 
                    // Let's use the same logic as final results: ignore first 30s?
                    // For live feedback, showing immediate excursion height is better.
                    // Adapt reversalLevels (array of numbers) to format expected by helper (array of {y: val})
                    const reversalsAsObjects = stateRef.current.reversalLevels.map(val => ({ y: val }));
                    const liveAvgHeight = calculateAverageExcursionHeight(reversalsAsObjects);

                    const metrics = calculateLiveMetrics(
                        newNoise,
                        stateRef.current.reversalLevels,
                        speechLevel,
                        stateRef.current.sumNoiseAfter30,
                        stateRef.current.countNoiseAfter30
                    );
                    setCurrentEANL(metrics.eANL.toFixed(1));
                    setCurrentAANL(metrics.aANL !== null ? metrics.aANL.toFixed(1) : null);
                    setCurrentSD(liveAvgHeight.toFixed(1)); // Passing Avg Height as 'sd' prop for now

                    setNoiseVolume(newNoise - 95);

                    const t = (now - startTime) / 1000;

                    // Update Running Average for aHANT
                    if (t > 30) {
                        stateRef.current.sumNoiseAfter30 += newNoise;
                        stateRef.current.countNoiseAfter30++;
                    }

                    setHistory(prev => {
                        const newHistory = [...prev, { t, noise: newNoise }];

                        if (t >= 120) { // Timeout at 2 min
                            // Force stop loop logic by checking if we are already finishing
                            if (!stateRef.current.isFinishing) {
                                finishTest(newHistory, "Timeout (2 min)");
                            }
                            // Return history but loop should stop via isPlaying effect
                            return newHistory;
                        }

                        // Check Stopping Criteria
                        if (checkStoppingCriteria(newHistory, t, stateRef.current.reversalCount)) {
                            if (!stateRef.current.isFinishing) {
                                finishTest(newHistory, "Stable Criteria Met");
                            }
                            return newHistory;
                        }

                        return newHistory;
                    });
                }
                if (!stateRef.current.isFinishing) {
                    animationFrame = requestAnimationFrame(loop);
                }
            };

            stateRef.current.lastUpdate = Date.now();
            loop();
        } else {
            stop();
        }

        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying, isFinished, speechLevel, play, stop, setSpeechVolume, setNoiseVolume, startTime]);

    const handleStart = () => {
        // Fix: Call play() directly here to ensure AudioContext resumes within a user gesture
        play();

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
            isFinishing: false,
            sumNoiseAfter30: 0,
            countNoiseAfter30: 0
        };
        setNoiseLevel(startLevel);
        setReversalCount(0);
        setCurrentEANL(null);
        setCurrentAANL(null);
        setCurrentSD(null);
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
                <h2>Hearing Aid Noise Tolerance Test</h2>
                <p className="instruction" style={{ color: '#cbd5e1', margin: '0.5rem 0 1.5rem', fontSize: '1.1rem', fontStyle: 'italic' }}>
                    "Instruct listeners to maintain the noise at the highest level where they can still understand ≥90% of the words."
                </p>

                {/* Dashboard View */}
                <ReliabilityDashboard
                    history={history}
                    speechLevel={speechLevel}
                    eHANT={currentEANL !== null ? parseFloat(currentEANL) : null}
                    aHANT={currentAANL !== null ? parseFloat(currentAANL) : null}
                    sd={currentSD !== null ? parseFloat(currentSD) : null}
                />
            </div>

            {/* Render Graph only if not in dashboard (redundant here as dashboard has it, removed standalone graph) */}

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
