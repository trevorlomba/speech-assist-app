import './App.css';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { BsFillRecordFill } from 'react-icons/bs';  // Record button
import { BsPauseFill } from 'react-icons/bs';        // Stop button
import { BiReset } from 'react-icons/bi';           // Reset button

import config from './config';

// Add this function before your component or in a utils file
const getPageColor = (pageNum) => {
  // Array of accessible, distinct colors
  const colors = [
    '#2196F3', // blue
    '#4CAF50', // green
    '#F44336', // red
    '#FF9800', // orange
    '#9C27B0', // purple
    '#00BCD4', // cyan
    '#795548', // brown
    '#607D8B', // blue grey
    '#E91E63', // pink
    '#3F51B5'  // indigo
  ];
  
  // Cycle through colors based on page number
  return colors[(pageNum - 1) % colors.length];
};

const getTextColor = (backgroundColor) => {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

function App() {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const [showPhrasesModal, setShowPhrasesModal] = useState(false);
  const [selectedWords, setSelectedWords] = useState([]);
  const [originalPhrase, setOriginalPhrase] = useState(""); // State to store the original phrase
  const [generatedResponse, setGeneratedResponse] = useState([]);
  const [selectedIntent, setSelectedIntent] = useState(""); // State to store the selected intent
  const [showTranscript, setShowTranscript] = useState(false); // Default is false (transcript hidden)
  const [currentInput, setCurrentInput] = useState("");
  const [currentPage, setCurrentPage] = useState(0); // State to track pagination
  const [lastPaginationTime, setLastPaginationTime] = useState(Date.now());
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoPaginate, setAutoPaginate] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const transcriptRef = useRef(null);

  const wordsPerPage = 40; // Number of word buttons per page

  const timerRef = useRef(null);

  const [showWordPages, setShowWordPages] = useState(true);

  const [intentions, setIntentions] = useState({
    question: false,
    statement: false,
    command: false,
    // Add any other intention types you need
  });

  const toggleIntention = (intentionType) => {
    setIntentions(prev => ({
      ...prev,
      [intentionType]: !prev[intentionType]
    }));
  };

  const handlePageChange = (direction) => {
    const totalPages = Math.ceil(transcript.split(' ').length / wordsPerPage);
    
    console.log('Direction received:', direction, 'Type:', typeof direction);
    
    // Set auto-pagination to false using the same pattern as the button
    if (autoPaginate) {
      setAutoPaginate(false);
    }

    // Handle number case
    if (typeof direction === 'number') {
      console.log('Setting page to:', direction);
      // Ensure the page number is within bounds
      const pageNum = Math.max(0, Math.min(direction, totalPages - 1));
      setCurrentPage(pageNum);
      return;
    }
    
    // Handle string cases
    switch (direction) {
      case 'up':
        if (currentPage < totalPages - 1) {
          setCurrentPage(prev => prev + 1);
        }
        break;
      case 'down':
        if (currentPage > 0) {
          setCurrentPage(prev => prev - 1);
        }
        break;
      case 'first':
        setCurrentPage(0);
        break;
      case 'last':
        setCurrentPage(totalPages - 1);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    console.log('Auto-paginate updated:', autoPaginate);
  }, [autoPaginate]);

  useEffect(() => {
    const words = transcript.split(' ').filter(word => word !== '');
    const totalPages = Math.ceil(words.length / wordsPerPage);
    const currentTime = Date.now();
    
    // Check if we should paginate based on time and word count
    if (autoPaginate && 
        words.length > wordsPerPage && 
        currentPage < totalPages - 1) {
      
      console.log('Auto-paginating', {
        currentPage,
        totalPages,
        wordCount: words.length
      });

      setCurrentPage(prev => {
        const nextPage = prev + 1;
        console.log(`Moving from page ${prev} to ${nextPage}`);
        return nextPage;
      });
      
      setLastPaginationTime(currentTime);
    }
  }, [transcript, currentPage, wordsPerPage, lastPaginationTime, autoPaginate]);

  // Add a toggle for auto-scroll if needed
  const toggleAutoScroll = () => {
    setAutoScroll(prev => !prev);
  };

  useEffect(() => {
    const transcriptDiv = transcriptRef.current;
    if (!transcriptDiv || !autoScroll) return;

    transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
  }, [transcript, autoScroll]);

  // Auto-pagination effect
  useEffect(() => {
    if (!autoPaginate) return;

    const timer = setInterval(() => {
      const totalPages = Math.ceil(transcript.split(' ').length / wordsPerPage);
      
      setCurrentPage(prev => {
        if (prev < totalPages - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [autoPaginate, transcript, wordsPerPage]);

  // Handle manual transcript scrolling
  const handleScroll = (e) => {
    if (!autoScroll) return;
    
    const transcriptDiv = e.target;
    const isAtBottom = transcriptDiv.scrollHeight - transcriptDiv.scrollTop <= transcriptDiv.clientHeight + 1;
    
    if (!isAtBottom) {
      setAutoScroll(false);
    }
  };

  // Modified scroll button handler
  const handleScrollButton = (direction) => {
    const transcriptDiv = transcriptRef.current;
    if (!transcriptDiv) return;

    const scrollAmount = 100;
    const currentScroll = transcriptDiv.scrollTop;
    const newScroll = direction === 'up' 
      ? currentScroll - scrollAmount 
      : currentScroll + scrollAmount;
    
    transcriptDiv.scrollTo({
      top: newScroll,
      behavior: 'smooth'
    });

    // If manually scrolling, disable auto-scroll
    setAutoScroll(false);
  };
  if (!browserSupportsSpeechRecognition) {
    return <span>Browser doesn't support speech recognition.</span>;
  }

  const startListening = () => {
    SpeechRecognition.startListening({ continuous: true });
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
    setOriginalPhrase(transcript); // Store the full transcript as the original context
  };


  const handleWordClick = (word) => {
    setSelectedWords((prevWords) => {
      if (prevWords.includes(word)) {
        // Deselect word if it's already selected
        return prevWords.filter((w) => w !== word);
      } else {
        // Select word if it's not already selected
        return [...prevWords, word];
      }
    });
  };

  const handleIntentClick = (intent) => {
    setSelectedIntent(intent);
  };



  const handleGenerateResponse = async () => {
    // Debug logging
    console.log('API Key exists:', !!config.apiKey);
    console.log('API Key length:', config.apiKey ? config.apiKey.length : 0);

    const messages = [
      {
        role: 'system',
        content: `You are an AI assistant designed to help generate communication responses for a user with limited verbal ability. The user selects words that are spoken in the room, and these selected words represent the basis of their intended response.

        Your task is to generate conversational replies that are concise, contextually appropriate, and easy to understand. Based on the selected words and the user's intent, generate responses that align with the intended meaning, which may be affirmative, negative, inquisitive, or casual.

        Guidelines:
        1. Clarity and Simplicity: Responses should be no longer than 1-2 sentences. Use clear, simple language to ensure the response is easy to understand and select.
        2. Provide Options: When possible, generate up to three variations of a response so the user can choose the most fitting one. These variations should differ in tone or content to provide meaningful options.
        3. Contextual Awareness: Use the provided words and original context to infer the user's intent and construct a natural response. Fill in gaps logically to create a conversational flow.
        4. Intent Handling:
           - If the intent is affirmative, generate positive, agreeing responses.
           - If the intent is negative, generate polite disagreement or refusal responses.
           - If the intent is inquisitive, form a question or request for more information.
           - If the intent is casual, generate light conversational responses suitable for general social interactions.

        Ensure all responses are respectful, appropriate for communication involving family, caregivers, or medical professionals, and align with the selected words.

        Respond in a friendly, supportive tone that encourages further interaction.
        
        Make sure to set the response as an array of strings, with each string being a separate phrase. This is critical. For Example: "content": "\`\`\`json\\n[\\n    \\"It's time for us to talk.\\",\\n    \\"Do you have time for us?\\",\\n    \\"Let's spend some time together.\\"\\n]\\n\`\`\`"`
      },
      {
        role: 'user',
        content: `Original phrase: "${originalPhrase}". Selected words: ${selectedWords.join(' ')}. User intent: ${selectedIntent}`
      }
    ];

    try {
      // Log the headers before making the request
      console.log('Headers being sent:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey?.substring(0, 5)}...` // Only log first 5 chars for security
      });

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',  // Note: Is this the correct model name?
          messages: messages,
          max_tokens: 100,
          temperature: 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
        }
      );

      const content = response.data.choices[0].message.content;
      const jsonStr = content.replace(/```json\n|\n```/g, '');
      const phrases = JSON.parse(jsonStr);
      
      setGeneratedResponse(phrases);
      setShowPhrasesModal(true);
    } catch (error) {
      // Enhanced error logging
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setGeneratedResponse([]);
    }
  };


  const getPaginatedWords = () => {
    const words = transcript.split(' ');
    const startIndex = currentPage * wordsPerPage;
    return words.slice(startIndex, startIndex + wordsPerPage);
  };

  const renderTranscriptWithPageNumbers = (text) => {
    if (!text) return null;
    
    const words = text.split(' ');
    let result = [];
    
    for (let pageNum = 1; pageNum <= Math.ceil(words.length / wordsPerPage); pageNum++) {
      const startIndex = (pageNum - 1) * wordsPerPage;
      const endIndex = Math.min(startIndex + wordsPerPage, words.length);
      const pageWords = words.slice(startIndex, endIndex);
      
      result.push(
        <div 
          key={`page-${pageNum}`} 
          className="page-phrase-container"
          onClick={() => {
            setCurrentPage(pageNum - 1);
            setAutoPaginate(false);
          }}
        >
          <span 
            className="page-indicator"
            style={{ backgroundColor: getPageColor(pageNum) }}
          >
            {pageNum}
          </span>
          {' ' + pageWords.join(' ') + ' '}
        </div>
      );
    }
    
    return result;
  };

  const handlePhraseKeyPress = (e, pageNum) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setCurrentPage(pageNum - 1);
      setAutoScroll(false);
    }
  };

  const renderPageButtons = () => {
    const totalPages = Math.ceil(transcript.split(' ').length / wordsPerPage);
    const currentPageNum = currentPage + 1;
    
    return (
      <div className="page-navigation">
        <button onClick={() => handlePageChange('first')} disabled={currentPage === 0}>
          First
        </button>
        
        {/* First 3 pages */}
        {[1, 2, 3].map(num => (
          num <= totalPages && (
            <button 
              key={`page-${num}`}
              onClick={() => handlePageChange(num - 1)}
              className={currentPageNum === num ? 'active' : ''}
              style={{
                backgroundColor: getPageColor(num),
                color: getTextColor(getPageColor(num))
              }}
            >
              {num}
            </button>
          )
        ))}
        
        {/* ... ellipsis if needed ... */}
        
        {/* Last 3 pages */}
        {[totalPages - 2, totalPages - 1, totalPages].map(num => (
          num > 3 && (
            <button 
              key={`page-${num}`}
              onClick={() => handlePageChange(num - 1)}
              className={currentPageNum === num ? 'active' : ''}
            >
              {num}
            </button>
          )
        ))}
        
        <button onClick={() => handlePageChange('last')} disabled={currentPage === totalPages - 1}>
          Last
        </button>
        
      </div>
      
    );
  };

  // Add speech synthesis function
  const handlePhraseSpeak = (phrase) => {
    const utterance = new SpeechSynthesisUtterance(phrase);
    window.speechSynthesis.speak(utterance);
  };

  const totalPages = Math.ceil(transcript.split(' ').length / wordsPerPage);

  return (
    <div className="main-container">
      {/* Control buttons section */}
      <div className="control-buttons-container">
        <button 
          onClick={startListening}
          disabled={listening}
          title="Start Listening"
          aria-label="Start Listening"
          className="control-button"
        >
          <BsFillRecordFill size={32} color="#ff4444" />
          <span className="button-label">Record</span>
        </button>
        
        <button 
          onClick={stopListening}
          disabled={!listening}
          title="Pause Listening"
          aria-label="Pause Listening"
          className="control-button"
        >
          <BsPauseFill size={32} color="#333" />
          <span className="button-label">Pause</span>
        </button>
        
        <button 
          onClick={resetTranscript}
          title="Clear Transcript"
          aria-label="Clear Transcript"
          className="control-button"
        >
          <BiReset size={32} color="#666" />
          <span className="button-label">Clear</span>
        </button>
      </div>
      {/* <div className="toggle-buttons-container">
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className={`toggle-button ${showTranscript ? 'active' : ''}`}
        >
          {showTranscript ? 'Hide' : 'Show'} Transcript
        </button>
        
        <button
          onClick={() => setShowWordPages(!showWordPages)}
          className={`toggle-button ${showWordPages ? 'active' : ''}`}
        >
          {showWordPages ? 'Hide' : 'Show'} Word Pages
        </button>
      </div> */}

      {/* Grid layout for main sections */}
      <div className={`app-container ${!showTranscript ? 'hide-transcript' : ''} ${!showWordPages ? 'hide-word-pages' : ''}`}>
        {showTranscript && (
          <div className="transcript-section">
            <div className="controls-section">
              <div className="transcript-controls">
                <button onClick={() => resetTranscript()}>
                  Clear Transcript
                </button>
                <button 
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={autoScroll ? 'active' : ''}
                >
                  {/* {autoScroll ? 'Disable' : 'Enable'} */}
                  Transcript Auto-scroll
                </button>
              </div>
            </div>

            <div 
              ref={transcriptRef}
              className="transcript-text"
              role="region"
              aria-label="Transcript text"
              tabIndex="0"
              onScroll={handleScroll}
            >
              {renderTranscriptWithPageNumbers(transcript)}
            </div>
          </div>
        )}
        
        {showWordPages && (
          <div className="word-pages-section">
         

            <div className="word-buttons-container">
              <span
                className="page-indicator"
                style={{ backgroundColor: getPageColor(currentPage + 1) }}
              >
                {currentPage + 1}
              </span>
              {getPaginatedWords().map((word, index) => (
                <button
                  key={index}
                  className={`word-button ${selectedWords.includes(word) ? 'selected' : ''}`}
                  onClick={() => handleWordClick(word)}
                >
                  {word}
                </button>
              ))}
            </div>
               <div className="page-controls-container">
              <div className="page-navigation">
                <button
                  onClick={() => setAutoPaginate(!autoPaginate)}
                  className={`toggle-button ${autoPaginate ? 'active' : ''}`}
                >
                  {/* {autoPaginate ? 'Disable' : 'Enable'}  */}
                  Auto-advance
                </button>
                <button onClick={() => handlePageChange('first')} disabled={currentPage === 0}>
                  First
                </button>
                {/* First 3 pages */}
                {[1, 2, 3].map(num => (
                  num <= totalPages && (
                    <button 
                      key={`page-${num}`}
                      onClick={() => handlePageChange(num - 1)}
                      className={currentPage + 1 === num ? 'active' : ''}
                      style={{ backgroundColor: getPageColor(num) }}
                    >
                      {num}
                    </button>
                  )
                ))}
                {totalPages > 6 && <span>...</span>}
                {/* Last 3 pages */}
                {[totalPages - 2, totalPages - 1, totalPages].map(num => (
                  num > 3 && num > 0 && (
                    <button 
                      key={`page-${num}`}
                      onClick={() => handlePageChange(num - 1)}
                      className={currentPage + 1 === num ? 'active' : ''}
                      style={{ backgroundColor: getPageColor(num) }}
                    >
                      {num}
                    </button>
                  )
                ))}
                <button onClick={() => handlePageChange('last')} disabled={currentPage === totalPages - 1}>
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="phrase-generation-section">
          {/* Selected Words Display */}
          <div className="selected-words-container">
            <div className="selected-words-display">
              <span>Selected Words: </span>
              {selectedWords.map((word, index) => (
                <button
                  key={index}
                  className={`word-button ${selectedWords.includes(word) ? 'selected' : ''}`}
                  onClick={() => handleWordClick(word)}
                >
                  {word} ×
                </button>
              ))}
              <button 
                className="word-button add-word-button"
                onClick={() => setShowKeyboard(true)}
                aria-label="Open keyboard"
              >
                +
              </button>
            </div>
          </div>

          {/* Controls Row */}
          <div className="phrase-controls-row">
            {/* Intention Buttons */}
            <div className="intentions-row">
              <button 
                className={`intention-button ${intentions.question ? 'active' : ''}`}
                onClick={() => toggleIntention('question')}
              >
                Question
              </button>
              <button 
                className={`intention-button ${intentions.statement ? 'active' : ''}`}
                onClick={() => toggleIntention('statement')}
              >
                Statement
              </button>
              <button 
                className={`intention-button ${intentions.command ? 'active' : ''}`}
                onClick={() => toggleIntention('command')}
              >
                Command
              </button>

            {/* Generate Button */}
            <button 
              className="generate-button"
              onClick={handleGenerateResponse}
              disabled={!selectedWords.length}
              >
              Generate Phrases
            </button>
              </div>
          </div>

          {showPhrasesModal && generatedResponse.length > 0 && (
            <div className="phrases-overlay" onClick={() => setShowPhrasesModal(false)}>
              <div className="phrases-modal" onClick={e => e.stopPropagation()}>
                <button 
                  className="close-button" 
                  onClick={() => setShowPhrasesModal(false)}
                >
                  ×
                </button>

                {/* Selected Words Section */}
                <div className="modal-selected-words">
                  <h3>Selected Words</h3>
                  <div className="selected-words-display">
                    {selectedWords.map((word, index) => (
                      <button
                        key={index}
                        className={`word-button ${selectedWords.includes(word) ? 'selected' : ''}`}
                        onClick={() => handleWordClick(word)}
                      >
                        {word} ×
                      </button>
                    ))}
                    <button 
                      className="word-button add-word-button"
                      onClick={() => setShowKeyboard(true)}
                      aria-label="Open keyboard"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Intent Buttons */}
                <div className="modal-intentions">
                  <div className="intentions-row">
                    <button 
                      className={`intention-button ${intentions.question ? 'active' : ''}`}
                      onClick={() => toggleIntention('question')}
                    >
                      Question
                    </button>
                    <button 
                      className={`intention-button ${intentions.statement ? 'active' : ''}`}
                      onClick={() => toggleIntention('statement')}
                    >
                      Statement
                    </button>
                    <button 
                      className={`intention-button ${intentions.command ? 'active' : ''}`}
                      onClick={() => toggleIntention('command')}
                    >
                      Command
                    </button>
                  </div>
                </div>

                {/* Generated Phrases with Regenerate Button */}
                <div className="modal-phrases-section">
                  <div className="modal-header">
                    <h3>Generated Phrases</h3>
                    <button 
                      className="regenerate-button"
                      onClick={handleGenerateResponse}
                    >
                      Regenerate Phrases
                    </button>
                  </div>
                  <div className="generated-phrases">
                    {generatedResponse.map((phrase, index) => (
                      <button
                        key={index}
                        className="phrase-button"
                        onClick={() => {
                          handlePhraseSpeak(phrase);
                          setShowPhrasesModal(false);
                        }}
                      >
                        {phrase}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showKeyboard && (
        <div className="keyboard-overlay" onClick={() => setShowKeyboard(false)}>
          <div className="keyboard-modal" onClick={e => e.stopPropagation()}>
            <button
              className="close-button"
              onClick={() => setShowKeyboard(false)}
            >
              ×
            </button>

            <div className="keyboard-input">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                placeholder="Type your word..."
              />
              <button
                className="add-input-button"
                onClick={() => {
                  if (currentInput.trim()) {
                    setSelectedWords(prev => [...prev, currentInput.trim()]);
                    setCurrentInput('');
                    setShowKeyboard(false);
                  }
                }}
              >
                Add Word
              </button>
            </div>

            <div className="keyboard-layout">
              {[
                ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
                ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
                [' ']
              ].map((row, i) => (
                <div key={i} className="keyboard-row">
                  {row.map(key => (
                    <button
                      key={key}
                      className="keyboard-key"
                      onClick={() => setCurrentInput(prev => prev + key)}
                    >
                      {key === ' ' ? 'SPACE' : key}
                    </button>
                  ))}
                </div>
              ))}
              <div className="keyboard-row">
                <button
                  className="keyboard-key wide"
                  onClick={() => setCurrentInput(prev => prev.slice(0, -1))}
                >
                  Backspace
                </button>
                <button
                  className="keyboard-key wide"
                  onClick={() => setCurrentInput('')}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
