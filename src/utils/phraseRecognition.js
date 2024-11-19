import nlp from 'compromise';

export const getPhrasesFromTranscript = (transcript) => {
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

// Usage example:
// const phrases = getPhrasesFromTranscript("Your transcript text here");
// phrases will be an array of objects like:
// [
//   { text: "artificial intelligence", type: "general", confidence: 0.8 },
//   { text: "New York", type: "proper", confidence: 0.9 },
//   ...
// ] 