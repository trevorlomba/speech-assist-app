import './App.css';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { BsFillRecordFill } from 'react-icons/bs';  // Record button
import { BsPauseFill } from 'react-icons/bs';        // Stop button
import { BiReset } from 'react-icons/bi';           // Reset button

import config from './config';

import nlp from 'compromise';



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
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
  const [detectedPhrases, setDetectedPhrases] = useState([]);

  const transcriptRef = useRef(null);

  const wordsPerPage = 30; // Number of word buttons per page

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

  const getPhrasesFromTranscript = (transcript) => {
    const doc = nlp(transcript);
    let sentences = new Set();

    // Get complete sentences
    const completeSentences = doc.sentences().out('array');
    completeSentences.forEach(sentence => sentences.add(sentence));

    // Get sentence-like patterns
    const patterns = [
      // Subject + Verb patterns
      doc.match('(#Pronoun|#Noun) #Verb+').out('array'),
      // Questions
      doc.match('(#QuestionWord|#Modal|#Verb) #Pronoun? #Verb? #Noun+').out('array'),
      // Commands/Imperatives
      doc.match('#Verb #Noun+').out('array'),
      // Statements with conjunctions
      doc.match('#Noun+ #Verb+ #Conjunction #Noun+ #Verb+').out('array')
    ];

    patterns.forEach(patternMatches => {
      patternMatches.forEach(match => sentences.add(match));
    });

    // Convert Set to array and filter
    return Array.from(sentences)
      .filter(sentence => {
        // Count actual words
        const wordCount = sentence.trim().split(/\s+/).filter(word => word.length > 0).length;
        
        // Remove if too short or too long
        if (wordCount <= 2 || wordCount > 15) {
          return false;
        }
        
        // Must contain at least one verb (action)
        if (!nlp(sentence).match('#Verb').found) {
          return false;
        }

        // Must make some grammatical sense
        if (!hasBasicGrammaticalStructure(sentence)) {
          return false;
        }

        return true;
      })
      .map(sentence => ({
        text: sentence.trim(),
        type: categorizeSentence(sentence),
        confidence: calculateConfidence(sentence)
      }))
      .sort((a, b) => b.confidence - a.confidence);
  };

  const hasBasicGrammaticalStructure = (sentence) => {
    const doc = nlp(sentence);
    
    // Check for basic sentence patterns
    return (
      // Subject + Verb
      doc.match('(#Pronoun|#Noun) #Verb').found ||
      // Question
      doc.match('^(#QuestionWord|#Modal|#Verb)').found ||
      // Command
      doc.match('^#Verb').found
    );
  };

  const categorizeSentence = (sentence) => {
    const doc = nlp(sentence);
    
    if (doc.questions().found) {
      return 'question';
    }
    if (doc.match('^#Verb').found) {
      return 'command';
    }
    if (doc.match('(no|not|never|none)').found) {
      return 'negative';
    }
    return 'statement';
  };

  const calculateConfidence = (sentence) => {
    let score = 0.5; // base score
    const doc = nlp(sentence);

    // Higher confidence for complete grammatical structures
    if (doc.match('(#Pronoun|#Noun) #Verb #Noun?').found) score += 0.2;
    
    // Higher confidence for questions with question words
    if (doc.match('^#QuestionWord').found) score += 0.2;
    
    // Higher confidence for imperative commands
    if (doc.match('^#Verb').found) score += 0.1;
    
    // Lower confidence for very short or long sentences
    const wordCount = sentence.trim().split(/\s+/).length;
    if (wordCount < 3) score -= 0.2;
    if (wordCount > 10) score -= 0.1;
    
    return Math.min(Math.max(score, 0), 1); // Keep between 0 and 1
  };

  const handleTranscriptUpdate = (transcript) => {
    const fragments = getPhrasesFromTranscript(transcript);
    setDetectedPhrases(fragments.map((fragment) => {
      const transcriptWords = transcript.split(/\s+/);
      const fragmentWords = fragment.split(/\s+/);
      const { startIndex, endIndex } = findFragmentWordIndices(transcriptWords, fragmentWords);

      if (startIndex === -1) {
        // Fragment not found in transcript
        return null;
      }

      return {
        text: fragment,
        startIndex,
        endIndex,
        type: 'ai-detected'
      };
    }).filter(phrase => phrase !== null)); // Filter out any null values
  };

  // useEffect(() => {
  //   handleTranscriptUpdate(transcript);
  // }, [handleTranscriptUpdate, transcript]);

  useEffect(() => {
    console.log('Auto-paginate updated:', autoPaginate);
  }, [autoPaginate]);


  useEffect(() => {
    console.log("Updated Generated Response:", generatedResponse);
  }, [generatedResponse]);

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

  const findFragmentWordIndices = (transcriptWords, fragmentWords) => {
    for (let i = 0; i <= transcriptWords.length - fragmentWords.length; i++) {
      let match = true;
      for (let j = 0; j < fragmentWords.length; j++) {
        if (transcriptWords[i + j].toLowerCase() !== fragmentWords[j].toLowerCase()) {
          match = false;
          break;
        }
      }
      if (match) {
        return { startIndex: i, endIndex: i + fragmentWords.length - 1 };
      }
    }
    // If not found, return -1
    return { startIndex: -1, endIndex: -1 };
  };



  const handleWordClick = (word) => {
    setSelectedWords((prevWords) => {
      const isWordSelected = prevWords.some((sw) => sw.word === word);

      // If the word is already selected, remove it
      if (isWordSelected) {
        return prevWords.filter((sw) => sw.word !== word);
      }

      // Otherwise, add it
      const transcriptWords = transcript.split(' ');
      const wordIndex = transcriptWords.findIndex(
        (w, index) => w === word && !prevWords.some((sw) => sw.index === index)
      );

      if (wordIndex === -1) return prevWords; // Skip if the word isn't found

      return [...prevWords, { word, index: wordIndex }];
    });
  };


  const handleIntentClick = (intent) => {
    setSelectedIntent(intent);
  };



  const handleGenerateResponse = async () => {
    const selectedWordsTexts = selectedWords.map((sw) => sw.word);
    try {    // Extract only the 'word' property from selectedWords

      const response = await axios.post(`${config.apiUrl}/api/chat`, {
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant designed to help generate communication responses for a user with limited verbal ability. The user has selected words or phrases that were spoken to them, and these selections represent what they want to respond to.

Your task is to generate appropriate and concise replies to what was said to the user, based on the selected words or phrases, considering the user's intent (affirmative, negative, inquisitive, casual). Do not include the selected words or phrases in the responses unless necessary. Instead, use them to understand the context and craft a suitable reply that is a natural response to the original speaker.

Guidelines:

    Contextual Understanding: Interpret the selected words or phrases to grasp what was said to the user and generate a relevant response to those words.

    Avoid Repetition: Do not repeat or include the selected words in the response unless it aids clarity or is essential for a natural reply.

    Conciseness: Keep responses to 1-2 sentences, ensuring they are easy to understand.

    Variation: Provide up to three different response options that vary in tone or wording.

    Intent Alignment: Tailor the responses according to the user's intent:
        Affirmative: Express agreement or acceptance.
        Negative: Politely decline or express disagreement.
        Inquisitive: Ask for more information or clarification.
        Casual: Engage in light, friendly conversation.

    Tone: Use a friendly and supportive tone appropriate for communication with family, caregivers, or medical professionals.

    Response Format: Return only the array of response strings in JSON format without any additional text.

Example:

    Selected Words or Phrases: "Are you feeling better today", "Let me know if you need anything"
    User Intent: Affirmative

Example Response Format:

["Yes, I'm feeling much better now.", "Thank you, I appreciate your concern.", "I'm doing well today, thanks for asking."]
`
          },
          {
            role: 'user',
            content: `Selected words: ${selectedWordsTexts.join(', ')}. User intent: ${selectedIntent}`
          }
        ]
      });

      // Parse the response content
      const content = response.data.content;
      let phrases;

      try {
        phrases = JSON.parse(content); // Attempt to parse as JSON
      } catch (err) {
        console.error("Error parsing response content as JSON:", err);
        phrases = [];
      }

      // Ensure phrases is an array of strings
      if (!Array.isArray(phrases) || !phrases.every((p) => typeof p === "string")) {
        console.error("Invalid response format:", phrases);
        phrases = [];
      }

      console.log("Parsed Phrases:", phrases); // Log parsed phrases
      if (!Array.isArray(phrases) || phrases.some((p) => typeof p !== "string")) {
        console.error("Invalid phrases:", phrases);
        return; // Exit if phrases is not valid
      }


      console.log("Updating Generated Response with:", phrases);
      setGeneratedResponse([...phrases]);
      setShowPhrasesModal(true);
console.log(generatedResponse) 
    } catch (error) {
      console.error('Error generating response:', error);

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

  const handlePhraseClick = (phrase) => {
    setSelectedWords((prevWords) => {
      const isPhraseSelected = prevWords.some((sw) => sw.word === phrase.word);

      // If the phrase is already selected, deselect it and add individual words
      if (isPhraseSelected) {
        const words = phrase.word.split(' ');
        return [
          ...prevWords.filter((sw) => sw.word !== phrase.word),
          ...words.map((word, i) => ({
            word,
            index: phrase.index + i, // Calculate the correct index for each word
          })),
        ];
      }

      // Otherwise, select the phrase
      return [
        ...prevWords.filter(
          (sw) => sw.index < phrase.index || sw.index >= phrase.index + phrase.word.split(' ').length
        ),
        phrase,
      ];
    });
  };

  const renderWordButtons = () => {
    const words = transcript.split(' '); // All words from the transcript
    const totalPages = Math.ceil(words.length / wordsPerPage);
    const buttons = [];

    // Calculate pages to show (similar to the current logic)
    const pagesToShow = [];
    if (totalPages <= 3) {
      pagesToShow.push(...Array.from({ length: totalPages }, (_, i) => i));
    } else {
      if (currentPage === 0) {
        pagesToShow.push(0, 1, 2);
      } else if (currentPage === totalPages - 1) {
        pagesToShow.push(totalPages - 3, totalPages - 2, totalPages - 1);
      } else {
        pagesToShow.push(currentPage - 1, currentPage, currentPage + 1);
      }
    }

    // Render buttons for each visible page
    pagesToShow.forEach((pageNum) => {
      const startIdx = pageNum * wordsPerPage;
      const paginatedWords = words.slice(startIdx, startIdx + wordsPerPage);

      buttons.push(
        <div key={`page-${pageNum}`} className={`word-page ${pageNum === currentPage ? 'current-page' : ''}`}>
          <span
            className="page-indicator"
            style={{ backgroundColor: getPageColor(pageNum + 1) }}
          >
            {pageNum + 1}
          </span>
          <div className="word-buttons-container">
            {renderPageWords(paginatedWords, startIdx, pageNum)}
          </div>
        </div>
      );
    });

    return buttons;
  };


  // Helper function to render words for a single page
  const renderPageWords = (paginatedWords, startIdx) => {
    const buttons = [];

    for (let i = 0; i < paginatedWords.length; i++) {
      const absoluteIndex = startIdx + i;

      // Check if this word is part of a selected phrase or word
      const selectedEntry = selectedWords.find(
        (sw) =>
          sw.index === absoluteIndex ||
          (sw.index <= absoluteIndex &&
            absoluteIndex < sw.index + sw.word.split(' ').length)
      );

      if (selectedEntry && absoluteIndex === selectedEntry.index) {
        // Render the phrase as a single button
        buttons.push(
          <button
            key={`phrase-${absoluteIndex}`}
            className="word-button phrase-button"
            onClick={() => handlePhraseClick(selectedEntry)}
          >
            {selectedEntry.word}
          </button>
        );

        // Skip the rest of the words in this phrase
        i += selectedEntry.word.split(' ').length - 1;
      } else if (!selectedEntry) {
        // Render individual word
        buttons.push(
          <button
            key={`word-${absoluteIndex}`}
            className={`word-button ${selectedWords.some((sw) => sw.index === absoluteIndex) ? 'selected' : ''
              }`}
            onClick={() => handleWordClick(paginatedWords[i])}
          >
            {paginatedWords[i]}
          </button>
        );
      }
    }

    return buttons;
  };


  
  const handleSentenceAnalysis = async (transcript) => {
    if (!transcript.trim()) return;

    setIsAnalyzing(true);
    try {
      // Get current and next page's text
      const words = transcript.split(' ');
      const startIndex = currentPage * wordsPerPage;
      const endIndex = Math.min((currentPage + 2) * wordsPerPage, words.length);
      const relevantText = words.slice(startIndex, endIndex).join(' ');

      // Request for phrase detection from the API
      const messages = [
        {
          role: "system",
          content: `You are an AI assistant designed to extract all meaningful phrases from a transcribed speech.Your task is to analyze the provided transcript and return an array of up to 10 distinct, contextually significant phrases that represent complete thoughts or important fragments directly from the transcript.

            Guidelines:

          1. ** Coverage **: Extract the most relevant meaningful phrases from the transcript to ensure important content is captured.

2. ** Direct Extraction**: The phrases should be exact excerpts from the transcript without rephrasing or adding new words.

3. ** Completeness **: Each phrase should represent a complete idea or significant fragment that can stand on its own within the context.

4. ** Relevance **: Focus on phrases that are important for communication or could be useful for generating responses.

5. ** No Overlaps **: Avoid overlapping phrases; each phrase should be unique and not contain parts of other phrases.

6. ** Minimum Length **: Phrases should be at least three words long to ensure they carry sufficient meaning.

7. ** Limit:** Return no more than 10 phrases to keep the response concise.

8. ** Return Format **: ** Provide only the array of phrases in JSON format, without any additional text, explanations, or code blocks.**

** Example Response Format:**

        ["We will visit tomorrow", "Don't forget the appointment", "Meeting at 3 PM", "Bring your documents"]

`
        },
        {
          role: "user",
          content: transcript
        }
      ];

      const response = await axios.post(`${config.apiUrl}/api/chat`, { messages });
      const content = response.data.content || "[]";
      const fragments = JSON.parse(content);

      // Adjust indices to be relative to the full transcript
      setDetectedPhrases(fragments.map((fragment) => {
        const transcriptWords = relevantText.split(/\s+/);
        const fragmentWords = fragment.split(/\s+/);
        const { startIndex: relativeStart, endIndex: relativeEnd } = findFragmentWordIndices(transcriptWords, fragmentWords);

        if (relativeStart === -1) {
          return null;
        }

        // Adjust indices to be relative to the full transcript
        const absoluteStart = relativeStart + (currentPage * wordsPerPage);
        const absoluteEnd = relativeEnd + (currentPage * wordsPerPage);

        return {
          text: fragment,
          startIndex: absoluteStart,
          endIndex: absoluteEnd,
          type: 'ai-detected'
        };
      }).filter(phrase => phrase !== null));

    } catch (error) {
      console.error('Error analyzing sentences:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreatePhrase = () => {
    if (selectedWords.length < 2) {
      alert("Please select at least two words to create a phrase.");
      return;
    }

    // Get the two most recently selected words
    const lastSelected = selectedWords[selectedWords.length - 1];
    const secondLastSelected = selectedWords[selectedWords.length - 2];

    if (!lastSelected || !secondLastSelected) {
      alert("Selected words must be valid.");
      return;
    }

    // Ensure the words have valid indices
    const startIndex = Math.min(lastSelected.index, secondLastSelected.index);
    const endIndex = Math.max(lastSelected.index, secondLastSelected.index);

    const transcriptWords = transcript.split(' ');

    // Create the phrase from the transcript
    const newPhrase = transcriptWords.slice(startIndex, endIndex + 1).join(' ');

    // Update selectedWords
    setSelectedWords((prevWords) => {
      // Remove words that are part of the new phrase
      const filteredWords = prevWords.filter(
        (sw) => sw.index < startIndex || sw.index > endIndex
      );

      // Add the new phrase
      return [...filteredWords, { word: newPhrase, index: startIndex }];
    });

    console.log("New Phrase Created:", newPhrase); // Debugging output
  };




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
              {renderWordButtons()}
            </div>
            <div className="page-controls-container">
              <div className="page-navigation">
                {/* <button
                  className={`toggle-button ${isAnalyzing ? 'analyzing' : ''}`}
                  onClick={() => handleSentenceAnalysis(transcript)}
                  disabled={isAnalyzing || !transcript.trim()}
                >
                  {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
                </button> */}
                <button
                  className="create-phrase-button"
                  onClick={handleCreatePhrase}
                  disabled={selectedWords.length < 2} // Disable if fewer than 2 words are selected
                >
                  Create Phrase
                </button>
                <button
                  onClick={() => setAutoPaginate(!autoPaginate)}
                  className={`toggle-button ${autoPaginate ? 'active' : ''}`}
                >
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
              {selectedWords.map((sw, index) => (
                <button
                  key={index}
                  className={`word-button ${selectedWords.includes(sw) ? 'selected' : ''}`}
                  onClick={() => handleWordClick(sw.word)} // Pass only the word to deselect
                >
                  {sw.word} ×
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
                    {selectedWords.map((selectedWord, index) => (
                      <button
                        key={index}
                        className={`word-button ${selectedWords.some(sw => sw.word === selectedWord.word) ? 'selected' : ''}`}
                        onClick={() => handleWordClick(selectedWord.word)} // Pass only the word, not the whole object
                      >
                        {selectedWord.word} × {/* Render the `word` property */}
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
                    {generatedResponse && generatedResponse.length > 0 ? (
                      generatedResponse.map((phrase, index) => (
                        <button
                          key={index}
                          className="phrase-button"
                          onClick={() => {
                            handlePhraseSpeak(phrase);
                            // setShowPhrasesModal(false);
                          }}
                        >
                          {phrase}
                        </button>
                      ))
                    ) : (
                      <div className="phrase-item error">No responses generated.</div>
                    )}
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
                    let newWord = {word: currentInput.trim(), index: selectedWords.length};
                    setSelectedWords(prev => [...prev, newWord]);
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