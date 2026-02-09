import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import TestGraph from './TestGraph';

import { calculateSignificance } from '../utils/statistics';

const Results = ({ resultsA, resultsB, labelA, labelB, activeTestId, onStartTestB, onRestart, patientName, testDate, onSave, onRestartTest, clinicSettings }) => {
  const reportRef = useRef(null);

  // Export PDF
  const exportPDF = async () => {
    if (!reportRef.current) return;

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // High resolution
        backgroundColor: '#ffffff', // White background
        onclone: (clonedDoc) => {
          const element = clonedDoc.body.firstChild;
          if (element) {
            // Root Background
            element.style.background = '#ffffff';
            element.style.color = '#000000';

            // Add Clinic Header if settings exist
            if (clinicSettings && (clinicSettings.clinicName || clinicSettings.providerName)) {
              const headerDiv = document.createElement('div');
              headerDiv.style.textAlign = 'center';
              headerDiv.style.marginBottom = '20px';
              headerDiv.style.borderBottom = '1px solid #ccc';
              headerDiv.style.paddingBottom = '10px';
              headerDiv.style.width = '100%';

              if (clinicSettings.clinicName) {
                const h1 = document.createElement('h1');
                h1.innerText = clinicSettings.clinicName;
                h1.style.margin = '0 0 5px 0';
                h1.style.fontSize = '24px';
                h1.style.color = '#000000';
                headerDiv.appendChild(h1);
              }

              const details = [];
              if (clinicSettings.providerName) details.push(`Provider: ${clinicSettings.providerName}`);
              if (clinicSettings.licenseNumber) details.push(`Lic: ${clinicSettings.licenseNumber}`);

              if (details.length > 0) {
                const p = document.createElement('p');
                p.innerText = details.join(' | ');
                p.style.margin = '0';
                p.style.fontSize = '14px';
                p.style.color = '#333';
                headerDiv.appendChild(p);
              }

              // Prepend to the element
              element.insertBefore(headerDiv, element.firstChild);
            }

            // Fix colors
            const allElements = element.querySelectorAll('*');
            allElements.forEach(el => {
              const style = getComputedStyle(el);
              // Check inline styles primarily as that's what we use
              if (el.style.color === 'rgb(255, 255, 255)' || el.style.color === '#fff' || el.style.color === 'white') {
                el.style.color = '#000000';
              }
              if (el.style.color === 'rgb(148, 163, 184)' || el.style.color === '#94a3b8') {
                el.style.color = '#333333';
              }
              if (el.style.borderColor === 'rgb(51, 65, 85)' || el.style.borderColor === '#334155' ||
                el.style.borderColor === 'rgb(71, 85, 105)' || el.style.borderColor === '#475569') {
                el.style.borderColor = '#000000';
              }
            });

            // Specific Card Styling
            const cards = element.querySelectorAll('.card, .result-card, .summary-card');
            cards.forEach(card => {
              card.style.background = '#ffffff';
              card.style.border = '1px solid #000000';
              card.style.color = '#000000';
              card.style.boxShadow = 'none';
            });

            // Explicitly fix Strong tags in header
            const strongTags = element.querySelectorAll('strong');
            strongTags.forEach(strong => {
              if (strong.style.color.includes('255') || strong.style.color === '#fff') {
                strong.style.color = '#000000';
              }
            });

            // Hide Graphs
            const graphSections = element.querySelectorAll('.tracking-history-section');
            graphSections.forEach(section => section.style.display = 'none');
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ANL_Report_${patientName.replace(/\s+/g, '_') || 'Patient'}.pdf`);
    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("Failed to export PDF.");
    }
  };

  // Helper to calculate score
  const calculateScore = (data) => {
    if (!data) return { anl: 0, color: '' };
    const anl = data.bnl - data.mcl;
    // Probability text removed as per user request. 
    // Defined boundaries for color coding only:
    // High Probability (>= -7) -> Green
    // Moderate Probability (>= -13) -> Yellow
    // Low Probability (< -13) -> Red
    let color = "";

    if (anl >= -7) {
      color = "#4ade80"; // Green
    } else if (anl >= -13) {
      color = "#facc15"; // Yellow
    } else {
      color = "#f87171"; // Red
    }
    return { anl, color };
  };

  const renderCard = (label, data) => {
    const { anl, color } = calculateScore(data);
    return (
      <div className="result-card" style={{ flex: 1, minWidth: '300px', padding: '1.5rem', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
        <h3 style={{ marginTop: 0, borderBottom: '1px solid #475569', paddingBottom: '0.5rem', marginBottom: '1rem' }}>{label}</h3>

        <div className="score-display">
          <div className="score-item">
            <span className="label">Speech Level</span>
            <span className="value">{data.mcl} dB</span>
          </div>
          <div className="score-item">
            <span className="label">Noise Level</span>
            <span className="value">{data.bnl} dB</span>
          </div>
          {data.avgExcursion !== undefined && (
            <div className="score-item">
              <span className="label">Excursion</span>
              <span className="value">{data.avgExcursion} dB</span>
              {data.avgExcursion < 4 && <span style={{ fontSize: '0.7rem', color: '#4ade80' }}>High Confidence</span>}
              {data.avgExcursion > 5 && <span style={{ fontSize: '0.7rem', color: '#f87171' }}>Low Confidence</span>}
            </div>
          )}

          {/* Automatic Mode Metrics */}
          {data.score && data.validity && (
            <>
              <div className="score-item" style={{ borderLeft: '1px solid #475569', paddingLeft: '1rem' }}>
                <span className="label" title="Estimated HANT (Last Level)">eHANT</span>
                <span className="value">{data.score.eANL} dB</span>
              </div>
              <div className="score-item">
                <span className="label" title="Average HANT (Reversals)">aHANT</span>
                <span className="value">{data.validity.aANL !== null && data.validity.aANL !== undefined ? Number(data.validity.aANL).toFixed(1) + ' dB' : 'N/A'}</span>
              </div>
            </>
          )}

          {data.meta && data.meta.stabilization_seconds !== undefined && (
            <div className="score-item" style={{ borderLeft: '1px solid #475569', paddingLeft: '1rem' }}>
              <span className="label">Stabilized In</span>
              {data.meta.stabilization_seconds !== null ? (
                <span className="value" style={{ fontSize: '1.2rem' }}>{data.meta.stabilization_seconds}s</span>
              ) : (
                <span className="value" style={{ fontSize: '1.2rem', color: '#f87171' }}>Did Not Stabilize</span>
              )}
              {data.validity && data.validity.stabilization_status && data.meta.stabilization_seconds !== null && (
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>{data.validity.stabilization_status}</span>
              )}
            </div>
          )}
        </div>

        <div className="final-score" style={{ borderColor: color, padding: '1.5rem 1rem' }}>
          <span className="anl-label">HANT Score</span>
          <span className="anl-value" style={{ color: color, fontSize: '3rem' }}>{anl} dB</span>
        </div>

        {data.reason && (
          <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
            Stop Reason: <span style={{ color: '#cbd5e1' }}>{data.reason}</span>
          </div>
        )}



        {data.validity && (data.validity.stability_status || data.validity.reliability_status) && (
          <div style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #334155', fontSize: '0.85rem' }}>
            <span style={{ color: '#94a3b8' }}>{data.validity.stability_status ? 'Stability:' : 'Reliability:'} </span>
            <strong style={{
              color: (data.validity.stability_status || data.validity.reliability_status).includes('High') ? '#4ade80' :
                (data.validity.stability_status || data.validity.reliability_status).includes('Moderate') ? '#facc15' : '#f87171'
            }}>
              {data.validity.stability_status || data.validity.reliability_status}
            </strong>
            {data.validity.stability_sd !== undefined && (
              <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>(SD: {data.validity.stability_sd} dB)</span>
            )}
            {/* Fallback for legacy data */}
            {!data.validity.stability_status && data.validity.reliability_diff !== null && (
              <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>(Diff: {data.validity.reliability_diff} dB)</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // If only A is done (and we are still in activeTest A flow context which led here)
  if (activeTestId === 'A' && !resultsB) {
    return (
      <div className="card results-container">
        <h2>Test A Complete</h2>
        <div className="result-single">
          {renderCard(labelA, resultsA)}
        </div>

        {resultsA?.history && (
          <div className="tracking-history-section" style={{ marginTop: '2rem' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Tracking History</h3>
            <div style={{ height: '250px', background: '#1e293b', borderRadius: '12px', padding: '1rem' }}>
              <TestGraph history={resultsA.history} speechLevel={resultsA.mcl} width={500} height={250} />
            </div>
          </div>
        )}

        <div className="action-buttons" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button className="confirm-btn" onClick={onStartTestB}>
            Proceed to Test B ({labelB})
          </button>
          <button className="secondary-btn" onClick={onExportPartial => alert("Please save partial results or continue to Test B for full report.")}>
            Export Partial Results (Note: Full Report available after Test B)
          </button>
          <button className="secondary-btn" style={{ marginTop: '1rem', borderColor: '#64748b', color: '#cbd5e1' }} onClick={() => onRestartTest('A')}>
            Restart Test A
          </button>
        </div>
        <style>{`
  .results-container { max-width: 600px; margin: 0 auto; }
                    .score-display { display: flex; justify-content: space-around; margin-bottom: 1.5rem; }
                    .score-item { display: flex; flex-direction: column; }
                    .label { font-size: 0.8rem; color: #94a3b8; }
                    .value { font-size: 1.5rem; font-weight: 600; }
                    .final-score { border: 2px solid; border-radius: 12px; margin-bottom: 1rem; }
                    .anl-value { font-weight: 800; line-height: 1; display: block; }
                    .anl-label { display: block; margin-bottom: 0.5rem; }
`}</style>
      </div>
    );
  }

  // Comparison View
  const scoreA = calculateScore(resultsA);
  const scoreB = calculateScore(resultsB);

  // Improvement based on ANL score.
  const improvement = scoreB.anl - scoreA.anl;

  const getInterpretation = (diff) => {
    const abs = Math.abs(diff);
    if (abs < 3) return { text: "No Significant Change", color: "#94a3b8" }; // Grey

    // For HANT (Noise - Speech), Positive difference (Higher B than A) is Improvement.
    // Wait, let's trace:
    // HANT = Noise - Speech.
    // Higher Noise tolerance = Higher HANT Score.
    // Gain = Score B - Score A.
    // If B > A, diff > 0. This is Improvement.
    const direction = diff > 0 ? "Improvement" : "Decline";
    const significance = abs >= 4 ? "Significant" : "Likely";
    const confidence = abs >= 4 ? "95% Confidence" : "80% Confidence";

    // Green for improvement (positive diff), Red for decline
    const color = diff > 0 ? "#4ade80" : "#f87171";

    return { text: `${significance} ${direction} (${confidence})`, color };
  };

  const interpretation = getInterpretation(improvement);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div ref={reportRef} style={{ padding: '2rem', background: '#0f172a', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Hearing Aid Noise Tolerance Test Report <span style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 'normal' }}>v1.0.32</span></h2>
          <div style={{ textAlign: 'right', fontSize: '0.9rem', color: '#94a3b8' }}>
            <div>Patient: <strong style={{ color: '#fff' }}>{patientName || "N/A"}</strong></div>
            <div>Date: {testDate || new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <h3 style={{ textAlign: 'center', marginBottom: '2rem' }}>Comparative Results</h3>

        <div className="comparison-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center', marginBottom: '2rem' }}>
          {renderCard(labelA, resultsA)}
          {renderCard(labelB, resultsB)}
        </div>

        <div className="card summary-card" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto', background: '#1e293b' }}>
          <h3>Outcome</h3>
          <p style={{ fontSize: '1.2rem' }}>
            Benefit in HANT (Test B - Test A): <strong style={{ color: interpretation.color }}>{improvement > 0 ? '+' : ''}{improvement} dB</strong>
          </p>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: interpretation.color, marginTop: '-0.5rem' }}>
            {interpretation.text}
          </p>

          {/* Statistical Significance Display */}
          {(() => {
            const sig = calculateSignificance(resultsA, resultsB);
            if (sig.diff !== undefined) {
              return (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: `1px solid ${sig.color}` }}>
                  <strong style={{ color: sig.color, display: 'block', marginBottom: '0.25rem', fontSize: '1.1rem' }}>
                    {sig.message}
                  </strong>

                  {sig.confidenceLevel > 0 ? (
                    <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                      Difference: <strong>{sig.diff} dB</strong>
                      <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>|</span>
                      {sig.confidenceLevel === 95 ? (
                        <span>&gt; Critical Limit (95%): {sig.criticalDifference95} dB</span>
                      ) : (
                        <span>&gt; Critical Limit (80%): {sig.criticalDifference80} dB</span>
                      )}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      Diff: {sig.diff} dB &lt; Critical Limit (80%): {sig.criticalDifference80} dB
                    </span>
                  )}
                </div>
              );
            }
            return null;
          })()}

          <p style={{ color: '#ccc', fontStyle: 'italic', fontSize: '0.9rem', marginTop: '1rem' }}>
            (Higher HANT scores indicate better acceptance of background noise)<br />
          </p>
        </div>

        {/* Graphs - Side by Side if available */}
        {(resultsA?.history || resultsB?.history) && (
          <div className="tracking-history-section" style={{ marginTop: '2rem' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Tracking History</h3>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {resultsA?.history && (
                <div className="card" style={{ flex: 1, minWidth: '400px', padding: '1rem', background: '#1e293b' }}>
                  <h4 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>{labelA}</h4>
                  <div style={{ height: '250px' }}>
                    <TestGraph history={resultsA.history} speechLevel={resultsA.mcl} width={400} height={250} />
                  </div>
                </div>
              )}
              {resultsB?.history && (
                <div className="card" style={{ flex: 1, minWidth: '400px', padding: '1rem', background: '#1e293b' }}>
                  <h4 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>{labelB}</h4>
                  <div style={{ height: '250px' }}>
                    <TestGraph history={resultsB.history} speechLevel={resultsB.mcl} width={400} height={250} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="action-row" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="confirm-btn" style={{ background: '#10b981', borderColor: '#059669' }} onClick={exportPDF}>
          Download PDF Report
        </button>
        <button className="secondary-btn" onClick={onSave} style={{ background: '#3b82f6', borderColor: '#2563eb' }}>
          Save Data (JSON)
        </button>

        <button className="secondary-btn" onClick={onRestart}>
          Start New Patient
        </button>
      </div>

      <div className="restart-section" style={{ marginTop: '1.5rem', borderTop: '1px solid #334155', paddingTop: '1.5rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem' }}>Retest Specific Phase</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="secondary-btn" style={{ borderColor: '#64748b', color: '#cbd5e1' }} onClick={() => onRestartTest('A')}>
            Restart Test A
          </button>
          <button className="secondary-btn" style={{ borderColor: '#64748b', color: '#cbd5e1' }} onClick={() => onRestartTest('B')}>
            Restart Test B
          </button>
        </div>
      </div>

      <style>{`
  .score-display { display: flex; justify-content: space-around; margin-bottom: 1.5rem; }
                    .score-item { display: flex; flex-direction: column; }
                    .label { font-size: 0.8rem; color: #94a3b8; }
                    .value { font-size: 1.5rem; font-weight: 600; }
                    .final-score { border: 2px solid; border-radius: 12px; margin-bottom: 1rem; }
                    .anl-value { font-weight: 800; line-height: 1; display: block; }
                    .anl-label { display: block; margin-bottom: 0.5rem; }
`}</style>
    </div>
  );
};

export default Results;
