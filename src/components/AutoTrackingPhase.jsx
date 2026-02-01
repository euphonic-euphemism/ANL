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
    const [noiseLevel, setNoiseLevel] = useState(25); // Start low
    const [history, setHistory] = useState([]); // Array of {t, noise}
    const [startTime, setStartTime] = useState(null);
    const [reversals, setReversals] = useState(0);
    const [isSpaceHeld, setIsSpaceHeld] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    // Refs for logic loop to avoid stale closures
    const stateRef = useRef({
        noiseLevel: 25,
        isSpaceHeld: false,
        direction: 1, // 1 = up, -1 = down
        reversals: 0,
        rate: 1.0, // dB per second
        lastUpdate: 0
    });

    // Constants
    const TICK_RATE = 100; // Update every 100ms
    const INITIAL_RATE = 1.0;
    const SLOW_RATE = 0.5;
    const REVERSAL_THRESHOLD = 6;

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
                    // If direction changed since last tick? No, reversal is basically peak/valley.
                    // A reversal happens when we switch from increasing to decreasing or vice versa.
                    // We track the *previous* direction to detect change.
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
                    // Note: dt is small (~0.1), so change is ~0.1 or ~0.05
                    // We actually want strictly 1dB/sec or 0.5dB/sec.
                    // Ideally we simply add (rate * dt).

                    let newNoise = stateRef.current.noiseLevel + change;
                    newNoise = Math.max(0, Math.min(100, newNoise)); // Clamp

                    stateRef.current.noiseLevel = newNoise;
                    setNoiseLevel(newNoise);

                    // Update Audio
                    setNoiseVolume(newNoise - 85);

                    // Update Graph Data
                    const t = (now - startTime) / 1000;
                    setHistory(prev => [...prev, { t, noise: newNoise }]);
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
        stateRef.current = {
            noiseLevel: 25,
            isSpaceHeld: false,
            direction: 1,
            reversals: 0,
            rate: INITIAL_RATE,
            lastUpdate: Date.now()
        };
        setNoiseLevel(25);
        setReversals(0);
        setHistory([{ t: 0, noise: 25 }]);
        setStartTime(Date.now());
        setIsPlaying(true);
        setIsFinished(false);
    };

    const handleFinish = () => {
        setIsPlaying(false);
        setIsFinished(true);
        onComplete(); // Could pass results up if needed
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
                        Finish Test
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
