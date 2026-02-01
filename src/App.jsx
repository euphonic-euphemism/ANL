import React, { useState, useEffect } from 'react';
import './App.css';
import { useAudioController } from './hooks/useAudioController';
import TestPhase from './components/TestPhase';
import Calibration from './components/Calibration';
import Results from './components/Results';

function App() {
  const [phase, setPhase] = useState('intro'); // intro, calibration, mcl, bnl, results, choice_calibration

  // Test Data State
  const [patientName, setPatientName] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]); // Default to today YYYY-MM-DD
  const [labelA, setLabelA] = useState("Current Hearing Aids");
  const [labelB, setLabelB] = useState("New Hearing Aids");
  const [resultsA, setResultsA] = useState(null); // { mcl, bnl }
  const [resultsB, setResultsB] = useState(null); // { mcl, bnl }
  const [activeTestId, setActiveTestId] = useState('A'); // 'A' or 'B'
  const [testMode, setTestMode] = useState('manual'); // 'manual' or 'auto'

  // Current Active Values
  const [mcl, setMcl] = useState(null);
  const [bnl, setBnl] = useState(null);

  // Main Audio Controller
  // We initialize it here so it persists across MCL and BNL phases
  const {
    isReady,
    play,
    stop,
    setSpeechVolume,
    setNoiseVolume,
    swapChannels,
    toggleSwapChannels
  } = useAudioController('audio/anl_speech.flac', 'audio/anl_noise.flac', 0); // Offset 0 to match MCL range

  // Helper to get current label
  const currentLabel = activeTestId === 'A' ? labelA : labelB;

  // Save Patient Data
  const savePatientData = () => {
    const data = {
      patientName,
      testDate,
      timestamp: new Date().toISOString(),
      labelA,
      labelB,
      resultsA,
      resultsB,
      activeTestId,
      phase
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ANL_Test_${patientName.replace(/\s+/g, '_') || 'Patient'}_${testDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load Patient Data
  const loadPatientData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.patientName !== undefined) setPatientName(data.patientName);
        if (data.testDate) setTestDate(data.testDate);
        if (data.labelA) setLabelA(data.labelA);
        if (data.labelB) setLabelB(data.labelB);
        if (data.resultsA) setResultsA(data.resultsA);
        if (data.resultsB) setResultsB(data.resultsB);
        if (data.activeTestId) setActiveTestId(data.activeTestId);

        // Optional: restore phase or just go to results if done
        if (data.resultsB) {
          setPhase('results');
        } else if (data.resultsA) {
          setPhase('intro'); // Or prompt to continue
        }
      } catch (error) {
        console.error("Error parsing patient data:", error);
        alert("Invalid file format");
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = null;
  };

  // When entering MCL phase, ensure noise is muted and speech is audible
  useEffect(() => {
    if (phase === 'mcl' && isReady) {
      setSpeechVolume((mcl !== null ? mcl : 50) - 85); // Start at comfortable level (50dB Display -> -35dB Audio)
      setNoiseVolume(-100); // Mute noise
    } else if (phase === 'bnl' && isReady) {
      // Keep speech at MCL
      setSpeechVolume(mcl - 85);
      // Start noise low (e.g. 25dB Display -> -60dB Audio)
      setNoiseVolume(25 - 85);
    } else if (phase === 'results') {
      stop();
    }
  }, [phase, isReady, play, stop, setSpeechVolume, setNoiseVolume, mcl]);

  const handleMclConfirm = () => {
    setPhase('bnl');
  };

  const handleBnlConfirm = () => {
    // Save results for the active test
    const resultData = { mcl, bnl };
    if (activeTestId === 'A') {
      setResultsA(resultData);
    } else {
      setResultsB(resultData);
    }
    setPhase('results');
  };

  const startTestB = () => {
    setActiveTestId('B');
    setMcl(null);
    setBnl(null);
    // Go to choice_calibration to ask if they need to recalibrate
    setPhase('choice_calibration');
  };

  const startCalibration = () => {
    setPhase('calibration');
  };

  const skipCalibration = () => {
    setPhase('mcl');
  };

  const restartFull = () => {
    setMcl(null);
    setBnl(null);
    setResultsA(null);
    setResultsB(null);
    setActiveTestId('A');
    setPhase('intro');
    // Keep patient name? Usually yes for re-test, but maybe clear if new patient.
    // Let's keep it for now.
  };

  return (
    <div className="app-container">
      <header>
        <h1>ANL Test <span style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 'normal' }}>v1.0.12</span></h1>
        {patientName && (
          <div className="patient-badge" style={{ marginTop: '0.2rem', fontSize: '1rem', color: '#64748b' }}>
            Patient: <strong style={{ color: '#fff' }}>{patientName}</strong>
          </div>
        )}
        {phase !== 'intro' && (
          <div className="test-badge" style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
            Testing: <strong style={{ color: '#fff' }}>{currentLabel}</strong>
          </div>
        )}
      </header>

      <main>
        {phase === 'intro' && (
          <div className="card intro-card">
            <h2>Welcome</h2>
            <p>This application administers the Acceptable Noise Level (ANL) test.</p>

            <div className="input-group" style={{ margin: '2rem 0', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Patient Name / ID</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="text-input"
                placeholder="Enter Patient Name"
                style={{ width: '100%', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: 'white' }}
              />

              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Test Date</label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="text-input"
                style={{ width: '100%', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: 'white' }}
              />

              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Test A Description</label>
              <input
                type="text"
                value={labelA}
                onChange={(e) => setLabelA(e.target.value)}
                className="text-input"
                style={{ width: '100%', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: 'white' }}
              />

              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Test B Description</label>
              <input
                type="text"
                value={labelB}
                onChange={(e) => setLabelB(e.target.value)}
                className="text-input"
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: 'white', marginBottom: '1.5rem' }}
              />

              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Mode</label>
              <select
                value={testMode}
                onChange={(e) => setTestMode(e.target.value)}
                className="text-input"
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: 'white' }}
              >
                <option value="manual">Manual (Standard)</option>
                <option value="auto">Automatic (1 dB/sec)</option>
              </select>
            </div>

            <div className="data-controls" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <label className="secondary-btn" style={{ cursor: 'pointer', display: 'inline-block' }}>
                Load Patient Data
                <input type="file" accept=".json" onChange={loadPatientData} style={{ display: 'none' }} />
              </label>
            </div>

            <p>Please ensure you are in a quiet environment and have calibrated your audio output.</p>
            <button className="confirm-btn" onClick={() => { setActiveTestId('A'); setPhase('calibration'); }}>
              Start Test A
            </button>
          </div>
        )}

        {phase === 'choice_calibration' && (
          <div className="card intro-card">
            <h2>Proceed to {labelB}</h2>
            <p>Do you need to re-calibrate audio for the new device?</p>
            <div className="action-buttons" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
              <button className="secondary-btn" onClick={startCalibration}>
                Re-Calibrate
              </button>
              <button className="confirm-btn" onClick={skipCalibration}>
                Skip & Start Test
              </button>
            </div>
          </div>
        )}

        {phase === 'calibration' && (
          <div className="calibration-wrapper">
            <Calibration
              onComplete={() => setPhase('mcl')}
              onBack={() => setPhase('intro')}
            />

            <div className="debug-controls card" style={{ marginTop: '1rem', padding: '1rem' }}>
              <h3>Audio Troubleshooting</h3>
              <p>If you cannot hear audio or it sounds wrong, try swapping channels.</p>
              <div className="control-row">
                <label>
                  Current Mode: <strong>{swapChannels ? "Swapped (Left=Noise, Right=Speech)" : "Normal (Left=Speech, Right=Noise)"}</strong>
                </label> <br />
                <button onClick={toggleSwapChannels} className="secondary-btn" style={{ marginTop: '0.5rem' }}>
                  Swap L/R Channels
                </button>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button onClick={() => { play(); setSpeechVolume(-10); setNoiseVolume(-100); }} style={{ marginRight: '10px' }}>Test Speech</button>
                <button onClick={() => { play(); setSpeechVolume(-100); setNoiseVolume(-10); }} style={{ marginRight: '10px' }}>Test Noise</button>
                <button onClick={stop}>Stop Audio</button>
              </div>
            </div>
          </div>
        )}

        {phase === 'mcl' && (
          <div>
            {!isReady ? (
              <div className="loading">Loading Test Audio...</div>
            ) : (
              <TestPhase
                title={`MCL - ${currentLabel}`}
                instruction="Adjust the speech volume until it is at your most comfortable listening level."
                value={mcl === null ? 50 : mcl}
                minVal={25}
                maxVal={100}
                onChange={(val) => {
                  setMcl(val);
                  // Map Display dB (25-100) to WebAudio dB (-60 to +15)
                  // Offset is -85dB. 100 - 85 = +15dB (Max). 25 - 85 = -60dB (Min).
                  setSpeechVolume(val - 85);
                }}
                onConfirm={handleMclConfirm}
                onBack={() => {
                  stop(); // Stop audio when going back to calibration
                  setPhase('calibration');
                }}
                onPlay={() => {
                  play();
                  // RE-APPLY Volumes because play() creates new GainNodes with 1.0 (Loud) gain.
                  // This ensures we resume at the user's selected comfort level.
                  const speechLevel = (mcl !== null ? mcl : 50) - 85;
                  setSpeechVolume(speechLevel);
                  setNoiseVolume(-100);
                }}
                onStop={stop}
              />
            )}
          </div>
        )}

        {phase === 'bnl' && (
          <TestPhase
            title={`BNL - ${currentLabel}`}
            instruction="Adjust the background noise to the MAXIMUM level you would be willing to 'put up with' while listening to the story."
            value={bnl === null ? 25 : bnl}
            minVal={25}
            maxVal={100}
            onChange={(val) => {
              setBnl(val);
              // Map Display dB (25-100) to WebAudio dB (-60 to +15)
              setNoiseVolume(val - 85);
            }}
            onConfirm={handleBnlConfirm}
            onBack={() => setPhase('mcl')}
            isAuto={testMode === 'auto'}
            onPlay={() => {
              play();
              // Keep speech at MCL
              setSpeechVolume((mcl !== null ? mcl : 50) - 85);
              // Noise is at current BNL
              setNoiseVolume((bnl !== null ? bnl : 25) - 85);
            }}
            onStop={stop}
          />
        )}

        {phase === 'results' && (
          <Results
            resultsA={resultsA}
            resultsB={resultsB}
            labelA={labelA}
            labelB={labelB}
            activeTestId={activeTestId}
            onStartTestB={startTestB}
            onRestart={restartFull}
            patientName={patientName}
            testDate={testDate}
            onSave={savePatientData}
          />
        )}
      </main>
    </div>
  );
}

export default App;
