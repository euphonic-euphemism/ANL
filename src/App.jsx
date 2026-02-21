import React, { useState, useEffect } from 'react';
import './App.css';
import { useAudioController } from './hooks/useAudioController';

import Calibration from './components/Calibration';
import Results from './components/Results';
import AutoTrackingPhase from './components/AutoTrackingPhase';
import TestTimer from './components/TestTimer';
import SettingsModal from './components/SettingsModal';

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

  const [autoSpeechLevel, setAutoSpeechLevel] = useState(75); // Fixed at 75 dB for Auto Mode

  // Clinic Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [clinicSettings, setClinicSettings] = useState({
    clinicName: '',
    providerName: '',
    licenseNumber: ''
  });



  // Speech Options
  const speechOptions = [
    { value: 'audio/history_glass.flac', label: 'History of Glass' },
    { value: 'audio/history_bicycle.flac', label: 'History of the Bicycle' },
    { value: 'audio/history_pencil.flac', label: 'History of the Pencil' },
    { value: 'audio/history_umbrella.flac', label: 'History of the Umbrella' }
  ];
  const [speechFile, setSpeechFile] = useState(speechOptions[0].value); // Default to first new option

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
  } = useAudioController(speechFile, 'audio/4-talker_babble.flac', 0); // Offset 0 to match MCL range

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

  useEffect(() => {
    if (phase === 'results') {
      stop();
    }
  }, [phase, stop]);



  const startTestB = () => {
    setActiveTestId('B');
    // Skip calibration check for Test B as requested
    setPhase('auto_test');
  };

  const startCalibration = () => {
    setPhase('calibration');
  };

  const skipCalibration = () => {
    setPhase('auto_test');
  };

  const restartFull = () => {
    setResultsA(null);
    setResultsB(null);
    setActiveTestId('A');
    setPhase('intro');
    // Keep patient name? Usually yes for re-test, but maybe clear if new patient.
    // Let's keep it for now.
  };

  const handleStartOver = () => {
    if (window.confirm("Are you sure you want to start over? This will reset the current test.")) {
      restartFull();
    }
  };

  const restartTest = (testId) => {
    if (testId === 'A') {
      setResultsA(null);
      setActiveTestId('A');
      setPhase('calibration');
    } else {
      setResultsB(null);
      setActiveTestId('B');
      setPhase('choice_calibration');
    }
  };

  return (
    <div className="app-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="app-title">Acceptable Noise Level Test <span className="version">v1.0.33</span></h1>
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
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {phase !== 'intro' && (
            <button
              onClick={handleStartOver}
              className="secondary-btn"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', borderColor: '#ef4444', color: '#ef4444' }}
            >
              Start Over
            </button>
          )}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Clinic Settings"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.5rem',
              fontSize: '1.2rem'
            }}
          >
            ⚙️
          </button>
          <TestTimer />
        </div>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={setClinicSettings}
        settings={clinicSettings}
      />

      <main>
        {phase === 'intro' && (
          <div className="card intro-card">
            <h2>Welcome</h2>
            <p>This application administers the Hearing Aid Noise Tolerance Test (formerly ANL).</p>

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



              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', marginTop: '1.5rem' }}>Speech Passage</label>
              <select
                value={speechFile}
                onChange={(e) => setSpeechFile(e.target.value)}
                className="text-input"
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: 'white' }}
              >
                {speechOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Fixed Speech Level</label>
                <div style={{ padding: '0.5rem', background: '#334155', borderRadius: '4px', color: '#cbd5e1', display: 'inline-block' }}>
                  75 dB
                </div>
              </div>
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

            <div style={{ margin: '1.5rem 0', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Select Speech Passage for Test B</label>
              <select
                value={speechFile}
                onChange={(e) => setSpeechFile(e.target.value)}
                className="text-input"
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: 'white' }}
              >
                {speechOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

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
              onComplete={() => {
                setPhase('auto_test');
              }}
              onBack={() => setPhase('intro')}
            />

            <div className="debug-controls card" style={{ marginTop: '1rem', padding: '1rem' }}>
              <h3>Audio Troubleshooting</h3>
              <p>If you cannot hear audio or it sounds wrong, try swapping channels.</p>
              <div className="control-row">
                <label>
                  Current Mode: <strong>{swapChannels ? "Swapped (Left=Speech, Right=Noise)" : "Normal (Right=Speech, Left=Noise)"}</strong>
                </label> <br />
                <button onClick={toggleSwapChannels} className="secondary-btn" style={{ marginTop: '0.5rem' }}>
                  Swap L/R Channels
                </button>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button onClick={() => { play(); setSpeechVolume(-25); setNoiseVolume(-100); }} style={{ marginRight: '10px' }}>Test Speech</button>
                <button onClick={() => { play(); setSpeechVolume(-100); setNoiseVolume(-25); }} style={{ marginRight: '10px' }}>Test Noise</button>
                <button onClick={stop}>Stop Audio</button>
              </div>
            </div>
          </div>
        )}

        {phase === 'auto_test' && (
          <AutoTrackingPhase
            speechLevel={autoSpeechLevel}
            onComplete={(data) => {
              // Data: { mcl, bnl, reason }
              if (activeTestId === 'A') {
                setResultsA(data);
              } else {
                setResultsB(data);
              }
              setPhase('results');
            }}
            onBack={() => setPhase('intro')}
            play={play}
            stop={stop}
            setSpeechVolume={setSpeechVolume}
            setNoiseVolume={setNoiseVolume}
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
            onRestartTest={restartTest}
            clinicSettings={clinicSettings}
          />
        )}
      </main>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'white', background: '#7f1d1d' }}>
          <h1>Something went wrong.</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem', cursor: 'pointer' }}>
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function WrappedApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
