import { useChat } from '../../hooks/useChat';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import './AICoPilot.css';

export const AICoPilot = () => {
  const {
    messages,
    isLoading,
    pendingCommand,
    addMessage,
    sendCommand,
    confirmAction,
    cancelAction,
  } = useChat();

  const { isListening, transcript, startListening, stopListening, reset } = useVoiceInput();

  const handleSendMessage = (text: string) => {
    if (text.trim()) {
      sendCommand(text);
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      reset();
      startListening();
    }
  };

  return (
    <div className="ai-copilot">
      <div className="copilot-header">
        <h3>TACTICAL AI CO-PILOT</h3>
      </div>

      <div className="chat-feed">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.type}`}>
            {msg.type === 'assistant' && msg.isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: msg.content }} />
            ) : (
              msg.content
            )}
          </div>
        ))}
        {isLoading && <div className="chat-message assistant">Processing...</div>}
      </div>

      {pendingCommand && (
        <div className="confirmation-dialog">
          <p>High-risk action requires confirmation:</p>
          <button className="success" onClick={confirmAction}>
            CONFIRM
          </button>
          <button className="danger" onClick={cancelAction}>
            CANCEL
          </button>
        </div>
      )}

      <div className="copilot-controls">
        <div className="voice-section">
          <button
            className={`voice-button ${isListening ? 'active' : ''}`}
            onClick={handleVoiceToggle}
            title={isListening ? 'Stop recording' : 'Start recording'}
          >
            🎤
          </button>
          {isListening && <span className="listening-indicator">Recording...</span>}
          {transcript && <span className="transcript">{transcript}</span>}
        </div>

        <div className="input-section">
          <input
            type="text"
            placeholder="run: Get-Process | select -First 5  — or ask Jarvis anything"
            onKeyPress={e => {
              if (e.key === 'Enter') {
                const input = e.currentTarget;
                handleSendMessage(input.value || transcript);
                input.value = '';
                reset();
              }
            }}
          />
          <button
            className="send-button"
            onClick={() => {
              const input = document.querySelector('.input-section input') as HTMLInputElement;
              handleSendMessage(input?.value || transcript);
              if (input) input.value = '';
              reset();
            }}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};
