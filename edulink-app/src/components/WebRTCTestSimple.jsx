import React from 'react';
import { useWebRTCSimple } from '../hooks/useWebRTCSimple';
import { useAuth } from '../hooks/useAuth';

const WebRTCTestSimple = () => {
    const { user } = useAuth();
    const {
        localStream,
        remoteStream,
        currentCall,
        incomingCall,
        isConnecting,
        startCall,
        answerCall,
        declineCall,
        endCall,
        isScreenSharing
    } = useWebRTCSimple(user);

    // Test with dummy conversation ID and target user
    const testConversationId = 'test-conversation-123';
    const testTargetUserId = 'test-user-456';

    return (
        <div style={{ padding: '20px', border: '2px solid #007bff', margin: '20px', borderRadius: '8px' }}>
            <h2>🧪 Simplified WebRTC Test</h2>
            
            <div style={{ marginBottom: '20px' }}>
                <h3>Status</h3>
                <p>User ID: {user?.uid || 'Not logged in'}</p>
                <p>Current Call: {currentCall ? `✅ ${currentCall.type} in ${currentCall.roomId}` : '❌ None'}</p>
                <p>Screen Sharing: {isScreenSharing ? '✅ Yes' : '❌ No'}</p>
                <p>Connecting: {isConnecting ? '⏳ Yes' : '❌ No'}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3>Test Controls</h3>
                <button 
                    onClick={() => startCall(testConversationId, 'audio', testTargetUserId)}
                    disabled={currentCall || !user}
                    style={{ margin: '5px', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                    🎵 Test Audio Call
                </button>
                
                <button 
                    onClick={() => startCall(testConversationId, 'video', testTargetUserId)}
                    disabled={currentCall || !user}
                    style={{ margin: '5px', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                    📹 Test Video Call
                </button>
                
                <button 
                    onClick={() => startCall(testConversationId, 'screen', testTargetUserId)}
                    disabled={currentCall || !user}
                    style={{ margin: '5px', padding: '10px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                    🖥️ Test Screen Share
                </button>
                
                <button 
                    onClick={endCall}
                    disabled={!currentCall}
                    style={{ margin: '5px', padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                    📞 End Call
                </button>
            </div>

            {incomingCall && (
                <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #dee2e6' }}>
                    <h3>📞 Incoming Call</h3>
                    <p>From: {incomingCall.callerName} ({incomingCall.callerId})</p>
                    <p>Type: {incomingCall.type}</p>
                    <p>Room: {incomingCall.roomId}</p>
                    <button 
                        onClick={answerCall}
                        style={{ margin: '5px', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        ✅ Answer
                    </button>
                    <button 
                        onClick={declineCall}
                        style={{ margin: '5px', padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        ❌ Decline
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                    <h3>📹 Local Stream</h3>
                    {localStream ? (
                        <video 
                            ref={(video) => {
                                if (video && localStream) {
                                    video.srcObject = localStream;
                                }
                            }}
                            autoPlay 
                            muted 
                            playsInline
                            style={{ width: '100%', maxWidth: '400px', backgroundColor: '#000', borderRadius: '8px' }}
                        />
                    ) : (
                        <div style={{ width: '100%', height: '200px', backgroundColor: '#6c757d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', borderRadius: '8px' }}>
                            No local stream
                        </div>
                    )}
                </div>
                
                <div style={{ flex: 1 }}>
                    <h3>📺 Remote Stream</h3>
                    {remoteStream ? (
                        <video 
                            ref={(video) => {
                                if (video && remoteStream) {
                                    video.srcObject = remoteStream;
                                }
                            }}
                            autoPlay 
                            playsInline
                            style={{ width: '100%', maxWidth: '400px', backgroundColor: '#000', borderRadius: '8px' }}
                        />
                    ) : (
                        <div style={{ width: '100%', height: '200px', backgroundColor: '#6c757d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', borderRadius: '8px' }}>
                            No remote stream
                        </div>
                    )}
                </div>
            </div>

            <div style={{ marginTop: '20px', fontSize: '12px', color: '#6c757d' }}>
                <p><strong>🔧 Debug Info:</strong></p>
                <p>• This uses the new simplified room-based WebRTC approach</p>
                <p>• Based on working audio-call-app code</p>
                <p>• Uses conversation-based room IDs for reliable connections</p>
                <p>• Open browser console for detailed logs</p>
                <p>• Test with real user IDs for actual functionality</p>
            </div>
        </div>
    );
};

export default WebRTCTestSimple;