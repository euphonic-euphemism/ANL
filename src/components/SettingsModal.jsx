import React, { useState, useEffect } from 'react';

const SettingsModal = ({ isOpen, onClose, onSave, settings }) => {
    const [formData, setFormData] = useState({
        clinicName: '',
        providerName: '',
        licenseNumber: ''
    });

    useEffect(() => {
        if (settings) {
            setFormData(settings);
        }
    }, [settings]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSave = () => {
        onSave(formData);
        onClose();
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div className="modal-content" style={{
                background: '#1e293b',
                padding: '2rem',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '500px',
                border: '1px solid #334155',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}>
                <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'white' }}>Clinic Settings</h2>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Clinic Name</label>
                    <input
                        type="text"
                        name="clinicName"
                        value={formData.clinicName}
                        onChange={handleChange}
                        className="text-input"
                        placeholder="e.g. City Audiology"
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: 'white' }}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Provider Name</label>
                    <input
                        type="text"
                        name="providerName"
                        value={formData.providerName}
                        onChange={handleChange}
                        className="text-input"
                        placeholder="e.g. Dr. Jane Smith"
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: 'white' }}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>License Number</label>
                    <input
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleChange}
                        className="text-input"
                        placeholder="e.g. AUD-12345"
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: 'white' }}
                    />
                </div>

                <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.6rem 1.2rem',
                            background: 'transparent',
                            color: '#cbd5e1',
                            border: '1px solid #475569',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: '0.6rem 1.2rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
