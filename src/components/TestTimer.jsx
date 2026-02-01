import React, { useState, useEffect, useRef } from 'react';

const TestTimer = () => {
    const [time, setTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                setTime((prevTime) => prevTime + 1);
            }, 1000);
        } else {
            clearInterval(intervalRef.current);
        }

        return () => clearInterval(intervalRef.current);
    }, [isRunning]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartPause = () => {
        setIsRunning(!isRunning);
    };

    const handleReset = () => {
        setIsRunning(false);
        setTime(0);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: '#1e293b',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid #334155',
            marginLeft: 'auto' // Push to right if in flex container
        }}>
            <div style={{
                fontSize: '1.5rem',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: isRunning ? '#4ade80' : '#cbd5e1',
                marginBottom: '0.25rem'
            }}>
                {formatTime(time)}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={handleStartPause}
                    style={{
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.8rem',
                        background: isRunning ? '#cbd5e1' : '#3b82f6',
                        color: isRunning ? '#0f172a' : 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {isRunning ? 'Pause' : 'Start'}
                </button>
                <button
                    onClick={handleReset}
                    style={{
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.8rem',
                        background: 'transparent',
                        color: '#94a3b8',
                        border: '1px solid #475569',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Reset
                </button>
            </div>
        </div>
    );
};

export default TestTimer;
