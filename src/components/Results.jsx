
import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const Results = ({ resultsA, resultsB, labelA, labelB, activeTestId, onStartTestB, onRestart, patientName, testDate, onSave }) => {
  const reportRef = useRef(null);

  // Export PDF
  const exportPDF = async () => {
    if (!reportRef.current) return;

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // High resolution
        backgroundColor: '#1e293b' // Match theme
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
    if (!data) return { anl: 0, probability: '', color: '' };
    const anl = data.mcl - data.bnl;
    let probability = "";
    let color = "";

    if (anl <= 7) {
      probability = "High Probability (85%+) of Successful Hearing Aid Use";
      color = "#4ade80"; // Green
    } else if (anl <= 13) {
      probability = "Moderate Probability of Successful Hearing Aid Use";
      color = "#facc15"; // Yellow
    } else {
      probability = "Low Probability of Successful Hearing Aid Use";
      color = "#f87171"; // Red
    }
    return { anl, probability, color };
  };

  const renderCard = (label, data) => {
    const { anl, probability, color } = calculateScore(data);
    return (
      <div className="result-card" style={{ flex: 1, minWidth: '300px', padding: '1.5rem', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
        <h3 style={{ marginTop: 0, borderBottom: '1px solid #475569', paddingBottom: '0.5rem', marginBottom: '1rem' }}>{label}</h3>

        <div className="score-display">
          <div className="score-item">
            <span className="label">MCL</span>
            <span className="value">{data.mcl} dB</span>
          </div>
          <div className="score-item">
            <span className="label">BNL</span>
            <span className="value">{data.bnl} dB</span>
          </div>
        </div>

        <div className="final-score" style={{ borderColor: color, padding: '1.5rem 1rem' }}>
          <span className="anl-label">ANL Score</span>
          <span className="anl-value" style={{ color: color, fontSize: '3rem' }}>{anl} dB</span>
        </div>

        <p className="probability" style={{ fontSize: '1rem' }}>{probability}</p>
      </div>
    );
  };

  // Prepare content for PDF
  // We wrap everything in a ref div to capture it

  // If only A is done (and we are still in activeTest A flow context which led here)
  if (activeTestId === 'A' && !resultsB) {
    const scoreA = calculateScore(resultsA);
    return (
      <div className="card results-container">
        <h2>Test A Complete</h2>
        <div className="result-single">
          {renderCard(labelA, resultsA)}
        </div>

        <div className="action-buttons" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button className="confirm-btn" onClick={onStartTestB}>
            Proceed to Test B ({labelB})
          </button>
          <button className="secondary-btn" onClick={onExportPartial => alert("Please save partial results or continue to Test B for full report.")}>
            Export Partial Results (Note: Full Report available after Test B)
          </button>
        </div>
        <style>{`
  .results - container { max - width: 600px; margin: 0 auto; }
                    .score - display { display: flex; justify - content: space - around; margin - bottom: 1.5rem; }
                    .score - item { display: flex; flex - direction: column; }
                    .label { font - size: 0.8rem; color: #94a3b8; }
                    .value { font - size: 1.5rem; font - weight: 600; }
                    .final - score { border: 2px solid; border - radius: 12px; margin - bottom: 1rem; }
                    .anl - value { font - weight: 800; line - height: 1; display: block; }
                    .anl - label { display: block; margin - bottom: 0.5rem; }
`}</style>
      </div>
    );
  }

  // Comparison View
  const scoreA = calculateScore(resultsA);
  const scoreB = calculateScore(resultsB);
  const improvement = scoreA.anl - scoreB.anl; // Positive means B is lower (better)

  const getInterpretation = (diff) => {
    const abs = Math.abs(diff);
    if (abs < 3) return { text: "No Significant Change", color: "#94a3b8" }; // Grey

    const direction = diff > 0 ? "Improvement" : "Decline";
    const significance = abs >= 4 ? "Significant" : "Likely";
    const confidence = abs >= 4 ? "95% Confidence" : "80% Confidence";

    // Green for improvement, Red for decline
    const color = diff > 0 ? "#4ade80" : "#f87171";

    return { text: `${significance} ${direction} (${confidence})`, color };
  };

  const interpretation = getInterpretation(improvement);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div ref={reportRef} style={{ padding: '2rem', background: '#0f172a', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>ANL Test Report <span style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 'normal' }}>v1.0.1</span></h2>
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
            Difference (Test A - Test B): <strong style={{ color: interpretation.color }}>{improvement} dB</strong>
          </p>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: interpretation.color, marginTop: '-0.5rem' }}>
            {interpretation.text}
          </p>
          <p style={{ color: '#ccc', fontStyle: 'italic', fontSize: '0.9rem', marginTop: '1rem' }}>
            (Lower ANL scores indicate better acceptance of background noise)<br />
            (Change ≥ 4 dB is significant at 95% CI; ≥ 3 dB at 80% CI)
          </p>
        </div>
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

      <style>{`
  .score - display { display: flex; justify - content: space - around; margin - bottom: 1.5rem; }
                    .score - item { display: flex; flex - direction: column; }
                    .label { font - size: 0.8rem; color: #94a3b8; }
                    .value { font - size: 1.5rem; font - weight: 600; }
                    .final - score { border: 2px solid; border - radius: 12px; margin - bottom: 1rem; }
                    .anl - value { font - weight: 800; line - height: 1; display: block; }
                    .anl - label { display: block; margin - bottom: 0.5rem; }
`}</style>
    </div>
  );
};

export default Results;

