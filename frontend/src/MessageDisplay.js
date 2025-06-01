// frontend/src/MessageDisplay.js
import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';

function MessageDisplay({ currentMessage, db }) {
  const [newMessageText, setNewMessageText] = useState(currentMessage);
  const [postMessageError, setPostMessageError] = useState('');
  const [postMessageSuccess, setPostMessageSuccess] = useState('');

  // Update newMessageText when currentMessage changes (e.g., another admin updates it)
  useEffect(() => {
    setNewMessageText(currentMessage);
  }, [currentMessage]);

  const handlePostMessage = async () => {
    setPostMessageError('');
    setPostMessageSuccess('');
    if (newMessageText.trim() === '') {
      setPostMessageError('Message cannot be empty.');
      return;
    }
    try {
      const messageDocRef = doc(db, 'appSettings', 'messages');
      await setDoc(messageDocRef, { currentMessage: newMessageText.trim() }, { merge: true });
      setPostMessageSuccess('Message posted successfully!');
      setTimeout(() => setPostMessageSuccess(''), 3000); // Clear success message after 3 seconds
    } catch (error) {
      console.error("Error posting message:", error);
      setPostMessageError('Failed to post message. Please try again.');
    }
  };

  return (
    <div style={styles.messageEditorContainer}>
      <h3>Post Global Announcement (Owner Only)</h3>
      <textarea
        value={newMessageText}
        onChange={(e) => setNewMessageText(e.target.value)}
        placeholder="Write your announcement here..."
        style={styles.messageTextarea}
      />
      <button onClick={handlePostMessage} style={styles.postButton}>
        Post Message
      </button>
      {postMessageError && <p style={styles.errorText}>{postMessageError}</p>}
      {postMessageSuccess && <p style={styles.successText}>{postMessageSuccess}</p>}
    </div>
  );
}

const styles = {
  messageEditorContainer: {
    backgroundColor: '#e7f3ff',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '30px',
    border: '1px solid #b3d9ff',
  },
  messageTextarea: {
    width: '100%',
    minHeight: '80px',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    marginBottom: '10px',
    fontSize: '1em',
    boxSizing: 'border-box',
  },
  postButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '1em',
    transition: 'background-color 0.3s ease',
  },
  postButtonHover: {
    backgroundColor: '#0056b3',
  },
  errorText: {
    color: '#dc3545',
    marginTop: '10px',
  },
  successText: {
    color: '#28a745',
    marginTop: '10px',
  }
};

export default MessageDisplay;