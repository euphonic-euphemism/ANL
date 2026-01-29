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
    step = 5,
    fineStep = 2,
    minVal = 25,
    maxVal = 100
}) => {

    // Keyboard accessibility
    useEffect(() => {
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
