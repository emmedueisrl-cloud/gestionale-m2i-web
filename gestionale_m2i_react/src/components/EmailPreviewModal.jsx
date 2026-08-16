import React from 'react';

const EmailPreviewModal = ({ showEmailPreviewModal, setShowEmailPreviewModal, emailData, setEmailData, handleSendCVEmail }) => {
  return (
    <>
      {/* 5. EMAIL PREVIEW MODAL */}
      {showEmailPreviewModal && emailData && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-container" style={{ width: '650px' }}>
            <form onSubmit={handleSendCVEmail}>
              <div className="modal-header">
                <h2>Anteprima ed Invio E-mail</h2>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEmailPreviewModal(false)}>✕</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>Destinatario Referente</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    required 
                    value={emailData.destEmail}
                    onChange={(e) => setEmailData({ ...emailData, destEmail: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Oggetto E-mail</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required 
                    value={emailData.subject}
                    onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Testo del Messaggio</label>
                  <textarea 
                    className="form-control" 
                    required 
                    value={emailData.body}
                    onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                    style={{ minHeight: '180px' }}
                  />
                </div>
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: emailData.hasCV || emailData.newCVFile ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  borderRadius: '6px',
                  border: emailData.hasCV || emailData.newCVFile ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                  fontSize: '12px',
                  color: emailData.hasCV || emailData.newCVFile ? '#34D399' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {emailData.hasCV || emailData.newCVFile ? (
                    <>
                      📎 <strong>Allegato rilevato:</strong> Il file del curriculum vitae originale verrà inviato in allegato fisico a questa e-mail.
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      <span>⚠️ <strong>Attenzione:</strong> Nessun CV rilevato per questo candidato. Puoi sceglierne uno ora per allegarlo e salvarlo nel database.</span>
                      <input 
                        type="file" 
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setEmailData({ ...emailData, newCVFile: e.target.files[0] })}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEmailPreviewModal(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">📧 Invia E-mail Ora</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
};

export default EmailPreviewModal;
