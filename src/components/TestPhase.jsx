import React, { useEffect } from 'react';
import './TestPhase.css';

const TestPhase = ({
    title,
    instruction,
    value,
    onChange,
    onConfirm,
    onBack,
    onPlay,
    onStop,
    isAuto = false,
    step = 5,
    fineStep = 2,
    minVal = 25,
    maxVal = 100
}) => {
    const [isSpaceHeld, setIsSpaceHeld] = React.useState(false);

    // Automatic Mode Logic
    useEffect(() => {
        if (!isAuto) return;

        const interval = setInterval(() => {
            const delta = isSpaceHeld ? -1 : 1;
            const newValue = Math.min(maxVal, Math.max(minVal, value + delta));
            if (newValue !== value) {
                onChange(newValue);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isAuto, isSpaceHeld, value, onChange, minVal, maxVal]);

    // Spacebar Listener for Auto Mode
    useEffect(() => {
        if (!isAuto) return;

        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                if (!e.repeat) setIsSpaceHeld(true);
                e.preventDefault();
            }
        };

        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                setIsSpaceHeld(false);
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isAuto]);

    // Manual Keyboard accessibility (Arrow Keys)
    useEffect(() => {
        // If in Auto mode, maybe disable arrow keys? leaving them allows manual override/correction
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowUp') {
                onChange(Math.min(maxVal, value + step));
            } else if (e.key === 'ArrowDown') {
                onChange(Math.max(minVal, value - step));
            } else if (e.key === 'Enter') {
                onConfirm();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [value, onChange, onConfirm, maxVal, minVal, step]);

    const adjust = (delta) => {
        const newValue = Math.min(maxVal, Math.max(minVal, value + delta));
        onChange(newValue);
    };

    return (
        <div className="test-phase-container card">
            <h2>{title}</h2>
            <p className="instruction">{instruction}</p>

            <div className="controls">
                <div className="display-value">
                    <span className="value-label">Level</span>
                    <span className="value-number">{value > -100 ? `${value} dB` : 'Muted'}</span>
                </div>

                {(onPlay || onStop) && (
                    <div className="playback-controls" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
                        {onPlay && (
                            <button className="control-btn" onClick={onPlay} style={{ padding: '0.8rem 1.5rem', background: '#3b82f6', borderColor: '#2563eb' }}>
                                Run (Play)
                            </button>
                        )}
                        {onStop && (
                            <button className="control-btn" onClick={onStop} style={{ padding: '0.8rem 1.5rem', background: '#ef4444', borderColor: '#dc2626' }}>
                                Stop
                            </button>
                        )}
                    </div>
                )}

                {isAuto ? (
                    <div className="auto-controls" style={{ margin: '2rem 0', padding: '1.5rem', background: '#1e293b', borderRadius: '8px', border: '1px solid #475569' }}>
                        <div style={{ marginBottom: '1rem', color: '#94a3b8' }}>Mode: <strong>Automatic</strong></div>
                        <div style={{
                            padding: '1rem',
                            background: isSpaceHeld ? '#3b82f6' : '#334155',
                            color: isSpaceHeld ? 'white' : '#cbd5e1',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s',
                            display: 'inline-block',
                            border: isSpaceHeld ? '2px solid #60a5fa' : '2px solid transparent'
                        }}>
                            {isSpaceHeld ? "DECREASING LEVEL..." : "HOLD SPACEBAR TO DECREASE"}
                        </div>
                        <p style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>
                            Noise level increases automatically.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="button-group">
                            <button className="control-btn up" onClick={() => adjust(step)}>
                                <span className="icon">▲</span> Louder ({step}dB)
                            </button>
                            <button className="control-btn up-fine" onClick={() => adjust(fineStep)}>
                                <span className="icon">△</span> +{fineStep}dB
                            </button>
                        </div>

                        <div className="button-group">
                            <button className="control-btn down-fine" onClick={() => adjust(-fineStep)}>
                                <span className="icon">▽</span> -{fineStep}dB
                            </button>
                            <button className="control-btn down" onClick={() => adjust(-step)}>
                                <span className="icon">▼</span> Softer ({step}dB)
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="action-buttons" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="secondary-btn" onClick={onBack}>
                    Back
                </button>
                <button className="confirm-btn" onClick={onConfirm}>
                    Select Level
                </button>
            </div>
        </div>
    );
};

export default TestPhase;
