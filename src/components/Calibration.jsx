import React, { useState } from 'react';
import { useAudioController } from '../hooks/useAudioController';

const Calibration = ({ onComplete, onBack }) => {
    // Use the calibration file
    const [calType, setCalType] = useState('standard'); // 'standard' | 'warble'
    const speechUrl = calType === 'standard' ? 'audio/cal_pulse_L.flac' : 'audio/cal_warble_L.flac';
    const noiseUrl = calType === 'standard' ? 'audio/cal_pulse_R.flac' : 'audio/cal_warble_R.flac';

    const {
        isReady,
        play,
        stop,
        setSpeechVolume,
        setNoiseVolume
    } = useAudioController(speechUrl, noiseUrl);

    const [activeTest, setActiveTest] = useState(null);

    const testRight = () => {
        setActiveTest('right');
        play();
        setSpeechVolume(-100); // Mute Speech (Left)
        setNoiseVolume(-25); // -25dB (Right, corresponds to 70dB Display)
    };

    const testLeft = () => {
        setActiveTest('left');
        play();
        setSpeechVolume(-25); // -25dB (Left, corresponds to 70dB Display)
        setNoiseVolume(-100); // Mute Noise (Right)
    };

    const stopTest = () => {
        setActiveTest(null);
        stop();
    };

    return (
        <div className="card calibration-container">
            <h2>Audio Calibration</h2>
            <p className="description">Select the calibration type below:</p>

            <div className="calibration-type-selector">
                <button
                    className={`type-btn ${calType === 'standard' ? 'active' : ''}`}
                    onClick={() => setCalType('standard')}
                >
                    Standard (Tones/Pulses)
                </button>
                <button
                    className={`type-btn ${calType === 'warble' ? 'active' : ''}`}
                    onClick={() => setCalType('warble')}
                >
                    Soundfield (Warble Tone)
                </button>
            </div>

            <div className="current-mode-info">
                {calType === 'standard' ? (
                    <p><strong>Standard Mode:</strong> Verify Tone (Right) and Noise Pulses (Left).</p>
                ) : (
                    <p><strong>Soundfield Mode:</strong> Verify Warble Tone on both channels.</p>
                )}
            </div>

            {!isReady ? (
                <div className="loading-indicator">Loading Audio...</div>
            ) : (
                <div className="calibration-controls">
                    <button onClick={activeTest === 'right' ? stopTest : testRight} disabled={!isReady}>
                        {activeTest === 'right' ? 'Stop Right Test' : 'Test Right Channel'}
                    </button>

                    <button onClick={activeTest === 'left' ? stopTest : testLeft} disabled={!isReady}>
                        {activeTest === 'left' ? 'Stop Left Test' : 'Test Left Channel'}
                    </button>
                </div>
            )}

            <div className="instructions">
                <ul>
                    {calType === 'standard' ? (
                        null
                    ) : (
                        <>
                            <li><strong>Right Channel:</strong> 10% Warble Tone</li>
                            <li><strong>Left Channel:</strong> 10% Warble Tone</li>
                        </>
                    )}
                </ul>
            </div>

            <div className="action-buttons" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="secondary-btn" onClick={onBack}>
                    Back
                </button>
                <button className="confirm-btn" onClick={() => { stop(); onComplete(); }}>
                    Calibration Complete - Start Test
                </button>
            </div>

            <style>{`
        .calibration-container {
          max-width: 600px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .calibration-type-selector {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-bottom: 1rem;
        }
        .type-btn {
            padding: 8px 16px;
            border: 1px solid #444;
            background: #222;
            color: #ccc;
            cursor: pointer;
            border-radius: 4px;
        }
        .type-btn.active {
            background: #646cff;
            color: white;
            border-color: #646cff;
        }
        .calibration-controls {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }
        .current-mode-info {
            text-align: center;
            color: #aaa;
            font-size: 0.9em;
        }
      `}</style>
        </div>
    );
};

export default Calibration;
