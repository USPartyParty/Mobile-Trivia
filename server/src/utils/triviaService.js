/**
 * Trivia Service
 * 
 * Manages trivia questions for the Taps Tokens Trivia application, including:
 * - Loading sample questions from built-in data
 * - Supporting different difficulty levels
 * - Randomizing and selecting questions
 * - Loading custom question pools from files
 * - Formatting questions for the game engine
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// In-memory cache of loaded questions
let questionCache = {
  timestamp: 0,
  questions: [],
  customQuestions: []
};

// Default categories
const CATEGORIES = [
  'General Knowledge',
  'Entertainment',
  'Science',
  'Geography',
  'History',
  'Sports',
  'Food & Drink',
  'Technology',
  'Music',
  'Movies'
];

// Sample questions (built-in default set)
const SAMPLE_QUESTIONS = [
  // General Knowledge
  {
    id: 'gk-001',
    category: 'General Knowledge',
    difficulty: 'easy',
    question: 'What is the capital of France?',
    choices: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctAnswerIndex: 2,
    explanation: 'Paris is the capital and most populous city of France.'
  },
  {
    id: 'gk-002',
    category: 'General Knowledge',
    difficulty: 'medium',
    question: 'Which planet is known as the Red Planet?',
    choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctAnswerIndex: 1,
    explanation: 'Mars is often called the Red Planet due to its reddish appearance.'
  },
  {
    id: 'gk-003',
    category: 'General Knowledge',
    difficulty: 'hard',
    question: 'What is the smallest bone in the human body?',
    choices: ['Stapes', 'Femur', 'Radius', 'Phalanges'],
    correctAnswerIndex: 0,
    explanation: 'The stapes, in the middle ear, is the smallest bone in the human body.'
  },
  
  // Entertainment
  {
    id: 'ent-001',
    category: 'Entertainment',
    difficulty: 'easy',
    question: 'Who played Iron Man in the Marvel Cinematic Universe?',
    choices: ['Chris Evans', 'Chris Hemsworth', 'Robert Downey Jr.', 'Mark Ruffalo'],
    correctAnswerIndex: 2,
    explanation: 'Robert Downey Jr. portrayed Tony Stark/Iron Man in the MCU.'
  },
  {
    id: 'ent-002',
    category: 'Entertainment',
    difficulty: 'medium',
    question: 'Which TV show features the character Walter White?',
    choices: ['The Walking Dead', 'Breaking Bad', 'Game of Thrones', 'The Sopranos'],
    correctAnswerIndex: 1,
    explanation: 'Walter White is the main character in Breaking Bad, portrayed by Bryan Cranston.'
  },
  {
    id: 'ent-003',
    category: 'Entertainment',
    difficulty: 'hard',
    question: 'Who directed the 1975 film "Jaws"?',
    choices: ['George Lucas', 'Francis Ford Coppola', 'Steven Spielberg', 'Martin Scorsese'],
    correctAnswerIndex: 2,
    explanation: 'Steven Spielberg directed "Jaws," which is considered one of the first summer blockbusters.'
  },
  
  // Science
  {
    id: 'sci-001',
    category: 'Science',
    difficulty: 'easy',
    question: 'What is the chemical symbol for water?',
    choices: ['O2', 'CO2', 'H2O', 'NaCl'],
    correctAnswerIndex: 2,
    explanation: 'H2O is the chemical formula for water, consisting of two hydrogen atoms and one oxygen atom.'
  },
  {
    id: 'sci-002',
    category: 'Science',
    difficulty: 'medium',
    question: 'What is the largest organ in the human body?',
    choices: ['Heart', 'Liver', 'Brain', 'Skin'],
    correctAnswerIndex: 3,
    explanation: 'The skin is the largest organ of the human body, covering about 20 square feet in adults.'
  },
  {
    id: 'sci-003',
    category: 'Science',
    difficulty: 'hard',
    question: 'What particle is exchanged in the electromagnetic force?',
    choices: ['Photon', 'Gluon', 'W Boson', 'Graviton'],
    correctAnswerIndex: 0,
    explanation: 'The photon is the force carrier for the electromagnetic force.'
  },
  
  // Geography
  {
    id: 'geo-001',
    category: 'Geography',
    difficulty: 'easy',
    question: 'What is the largest ocean on Earth?',
    choices: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean'],
    correctAnswerIndex: 3,
    explanation: 'The Pacific Ocean is the largest and deepest ocean on Earth.'
  },
  {
    id: 'geo-002',
    category: 'Geography',
    difficulty: 'medium',
    question: 'Which country has the most natural lakes?',
    choices: ['United States', 'Russia', 'Canada', 'Finland'],
    correctAnswerIndex: 2,
    explanation: 'Canada has more lakes than any other country, with over 2 million lakes.'
  },
  {
    id: 'geo-003',
    category: 'Geography',
    difficulty: 'hard',
    question: 'Which of these cities is not located on the Mediterranean Sea?',
    choices: ['Barcelona', 'Lisbon', 'Naples', 'Marseille'],
    correctAnswerIndex: 1,
    explanation: 'Lisbon is located on the Atlantic Ocean, not the Mediterranean Sea.'
  },
  
  // History
  {
    id: 'his-001',
    category: 'History',
    difficulty: 'easy',
    question: 'In what year did World War II end?',
    choices: ['1943', '1945', '1947', '1950'],
    correctAnswerIndex: 1,
    explanation: 'World War II ended in 1945 with the surrender of Germany in May and Japan in September.'
  },
  {
    id: 'his-002',
    category: 'History',
    difficulty: 'medium',
    question: 'Who was the first woman to win a Nobel Prize?',
    choices: ['Marie Curie', 'Rosalind Franklin', 'Ada Lovelace', 'Dorothy Hodgkin'],
    correctAnswerIndex: 0,
    explanation: 'Marie Curie was the first woman to win a Nobel Prize, winning the Physics Prize in 1903.'
  },
  {
    id: 'his-003',
    category: 'History',
    difficulty: 'hard',
    question: 'The ancient city of Byzantium later became known as what city?',
    choices: ['Athens', 'Rome', 'Constantinople', 'Alexandria'],
    correctAnswerIndex: 2,
    explanation: 'Byzantium was renamed Constantinople by Emperor Constantine, and is now Istanbul.'
  },
  
  // Sports
  {
    id: 'spo-001',
    category: 'Sports',
    difficulty: 'easy',
    question: 'In which sport would you perform a slam dunk?',
    choices: ['Soccer', 'Basketball', 'Tennis', 'Golf'],
    correctAnswerIndex: 1,
    explanation: 'A slam dunk is a basketball move where a player jumps and forcefully puts the ball through the hoop.'
  },
  {
    id: 'spo-002',
    category: 'Sports',
    difficulty: 'medium',
    question: 'How many players are there in a standard volleyball team?',
    choices: ['5', '6', '7', '8'],
    correctAnswerIndex: 1,
    explanation: 'A standard volleyball team has 6 players on the court at one time.'
  },
  {
    id: 'spo-003',
    category: 'Sports',
    difficulty: 'hard',
    question: 'Which country won the first FIFA World Cup in 1930?',
    choices: ['Brazil', 'Italy', 'Uruguay', 'Argentina'],
    correctAnswerIndex: 2,
    explanation: 'Uruguay hosted and won the first FIFA World Cup in 1930, defeating Argentina 4-2 in the final.'
  },
  
  // Food & Drink
  {
    id: 'food-001',
    category: 'Food & Drink',
    difficulty: 'easy',
    question: 'What is the main ingredient in guacamole?',
    choices: ['Tomato', 'Avocado', 'Onion', 'Lime'],
    correctAnswerIndex: 1,
    explanation: 'Avocado is the main ingredient in guacamole, a dish that originated in Mexico.'
  },
  {
    id: 'food-002',
    category: 'Food & Drink',
    difficulty: 'medium',
    question: 'Which country is the origin of the dish Paella?',
    choices: ['Italy', 'France', 'Spain', 'Portugal'],
    correctAnswerIndex: 2,
    explanation: 'Paella originated in Valencia, Spain. It traditionally contains rice, saffron, vegetables, and meat or seafood.'
  },
  {
    id: 'food-003',
    category: 'Food & Drink',
    difficulty: 'hard',
    question: 'What is the main flavoring ingredient in Aioli?',
    choices: ['Lemon', 'Garlic', 'Olive Oil', 'Egg'],
    correctAnswerIndex: 1,
    explanation: 'Garlic is the main flavoring ingredient in traditional aioli, which is a Mediterranean sauce.'
  },
  
  // Technology
  {
    id: 'tech-001',
    category: 'Technology',
    difficulty: 'easy',
    question: 'What does "HTTP" stand for?',
    choices: ['HyperText Transfer Protocol', 'High Tech Transfer Protocol', 'Hyperlink Text Transfer Protocol', 'Home Tool Transfer Protocol'],
    correctAnswerIndex: 0,
    explanation: 'HTTP stands for HyperText Transfer Protocol, the foundation of data communication for the World Wide Web.'
  },
  {
    id: 'tech-002',
    category: 'Technology',
    difficulty: 'medium',
    question: 'Who is considered the founder of Microsoft?',
    choices: ['Steve Jobs', 'Bill Gates', 'Mark Zuckerberg', 'Elon Musk'],
    correctAnswerIndex: 1,
    explanation: 'Bill Gates co-founded Microsoft with Paul Allen in 1975.'
  },
  {
    id: 'tech-003',
    category: 'Technology',
    difficulty: 'hard',
    question: 'What was the name of the first general-purpose electronic computer?',
    choices: ['UNIVAC', 'ENIAC', 'EDVAC', 'Colossus'],
    correctAnswerIndex: 1,
    explanation: 'ENIAC (Electronic Numerical Integrator and Computer) was the first programmable, electronic, general-purpose digital computer, completed in 1945.'
  },
  
  // Music
  {
    id: 'music-001',
    category: 'Music',
    difficulty: 'easy',
    question: 'Which instrument does a pianist play?',
    choices: ['Guitar', 'Drums', 'Piano', 'Violin'],
    correctAnswerIndex: 2,
    explanation: 'A pianist is someone who plays the piano.'
  },
  {
    id: 'music-002',
    category: 'Music',
    difficulty: 'medium',
    question: 'Which band released the album "Dark Side of the Moon"?',
    choices: ['The Beatles', 'Led Zeppelin', 'Pink Floyd', 'The Rolling Stones'],
    correctAnswerIndex: 2,
    explanation: 'Pink Floyd released "The Dark Side of the Moon" in 1973, one of the best-selling albums of all time.'
  },
  {
    id: 'music-003',
    category: 'Music',
    difficulty: 'hard',
    question: 'In what year was Beethoven\'s 9th Symphony first performed?',
    choices: ['1800', '1824', '1851', '1876'],
    correctAnswerIndex: 1,
    explanation: 'Beethoven\'s 9th Symphony was first performed in Vienna on May 7, 1824.'
  },
  
  // Movies
  {
    id: 'movie-001',
    category: 'Movies',
    difficulty: 'easy',
    question: 'What was the first feature-length animated movie ever released?',
    choices: ['Pinocchio', 'Snow White and the Seven Dwarfs', 'Fantasia', 'Bambi'],
    correctAnswerIndex: 1,
    explanation: 'Snow White and the Seven Dwarfs, released in 1937 by Disney, was the first full-length traditionally animated feature film.'
  },
  {
    id: 'movie-002',
    category: 'Movies',
    difficulty: 'medium',
    question: 'Who directed the movie "Pulp Fiction"?',
    choices: ['Martin Scorsese', 'Steven Spielberg', 'Quentin Tarantino', 'Christopher Nolan'],
    correctAnswerIndex: 2,
    explanation: 'Quentin Tarantino directed "Pulp Fiction," which was released in 1994.'
  },
  {
    id: 'movie-003',
    category: 'Movies',
    difficulty: 'hard',
    question: 'Which film won the first Academy Award for Best Picture?',
    choices: ['Wings', 'Gone with the Wind', 'Casablanca', 'All Quiet on the Western Front'],
    correctAnswerIndex: 0,
    explanation: '"Wings," a silent film released in 1927, won the first Academy Award for Best Picture (then called "Outstanding Picture") at the 1st Academy Awards in 1929.'
  }
];

/**
 * Get trivia questions based on specified criteria
 * 
 * @param {number} count - Number of questions to retrieve
 * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard', 'mixed')
 * @param {string[]} categories - Array of categories to include (empty for all)
 * @returns {Promise<Array>} - Array of formatted question objects
 */
async function getTriviaQuestions(count = 10, difficulty = 'mixed', categories = []) {
  try {
    // Ensure we have questions loaded
    await loadQuestions();
    
    // Combine built-in and custom questions
    let allQuestions = [...questionCache.questions, ...questionCache.customQuestions];
    
    // Filter by category if specified
    if (categories && categories.length > 0) {
      allQuestions = allQuestions.filter(q => categories.includes(q.category));
    }
    
    // Filter by difficulty if not mixed
    if (difficulty !== 'mixed') {
      allQuestions = allQuestions.filter(q => q.difficulty === difficulty);
    }
    
    // If we don't have enough questions after filtering, fall back to all questions
    if (allQuestions.length < count) {
      console.warn(`Not enough questions matching criteria. Using all available questions.`);
      allQuestions = [...questionCache.questions, ...questionCache.customQuestions];
    }
    
    // Shuffle the questions
    const shuffledQuestions = shuffleArray(allQuestions);
    
    // Take the requested number of questions
    const selectedQuestions = shuffledQuestions.slice(0, count);
    
    // Format questions for the game engine
    return selectedQuestions.map(formatQuestionForGame);
  } catch (error) {
    console.error('Error getting trivia questions:', error);
    
    // Fallback to sample questions if there's an error
    console.warn('Falling back to built-in sample questions');
    const shuffledSamples = shuffleArray(SAMPLE_QUESTIONS);
    return shuffledSamples.slice(0, count).map(formatQuestionForGame);
  }
}

/**
 * Load questions from files and cache them
 * 
 * @returns {Promise<void>}
 */
async function loadQuestions() {
  try {
    // Check if cache is fresh (less than 5 minutes old)
    const now = Date.now();
    if (questionCache.questions.length > 0 && (now - questionCache.timestamp) < 5 * 60 * 1000) {
      return; // Use cached questions
    }
    
    // Reset cache
    questionCache.questions = [...SAMPLE_QUESTIONS]; // Start with built-in questions
    questionCache.customQuestions = [];
    questionCache.timestamp = now;
    
    // Check for custom questions directory
    const customDir = path.join(__dirname, '..', '..', 'data', 'questions');
    
    try {
      // Ensure the directory exists
      await fs.mkdir(customDir, { recursive: true });
      
      // Read all JSON files in the directory
      const files = await fs.readdir(customDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      // Load each JSON file
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(customDir, file);
          const fileContent = await fs.readFile(filePath, 'utf8');
          const questions = JSON.parse(fileContent);
          
          // Validate questions
          const validQuestions = questions.filter(q => isValidQuestion(q));
          
          if (validQuestions.length !== questions.length) {
            console.warn(`File ${file} contained ${questions.length - validQuestions.length} invalid questions that were skipped.`);
          }
          
          // Add to custom questions
          questionCache.customQuestions.push(...validQuestions);
          
          console.info(`Loaded ${validQuestions.length} questions from ${file}`);
        } catch (fileError) {
          console.error(`Error loading questions from ${file}:`, fileError);
          // Continue with other files
        }
      }
      
      console.info(`Loaded ${questionCache.customQuestions.length} custom questions and ${questionCache.questions.length} built-in questions.`);
    } catch (dirError) {
      console.warn('Custom questions directory not found or inaccessible:', dirError);
      // Continue with built-in questions only
    }
  } catch (error) {
    console.error('Error loading questions:', error);
    // Fallback to sample questions
    questionCache.questions = [...SAMPLE_QUESTIONS];
    questionCache.timestamp = now;
  }
}

/**
 * Save custom questions to a file
 * 
 * @param {Array} questions - Array of question objects to save
 * @param {string} filename - Name of the file to save to (without path)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function saveCustomQuestions(questions, filename = 'custom-questions.json') {
  try {
    // Validate questions
    const validQuestions = questions.filter(q => isValidQuestion(q));
    
    if (validQuestions.length !== questions.length) {
      console.warn(`${questions.length - validQuestions.length} invalid questions were skipped.`);
    }
    
    if (validQuestions.length === 0) {
      throw new Error('No valid questions to save');
    }
    
    // Ensure the directory exists
    const customDir = path.join(__dirname, '..', '..', 'data', 'questions');
    await fs.mkdir(customDir, { recursive: true });
    
    // Save to file
    const filePath = path.join(customDir, filename);
    await fs.writeFile(filePath, JSON.stringify(validQuestions, null, 2), 'utf8');
    
    // Update cache
    await loadQuestions(); // Reload all questions
    
    console.info(`Saved ${validQuestions.length} questions to ${filename}`);
    return true;
  } catch (error) {
    console.error('Error saving custom questions:', error);
    return false;
  }
}

/**
 * Get available categories
 * 
 * @returns {Promise<string[]>} - Array of category names
 */
async function getCategories() {
  try {
    // Ensure questions are loaded
    await loadQuestions();
    
    // Get all categories from questions
    const allQuestions = [...questionCache.questions, ...questionCache.customQuestions];
    const categories = new Set();
    
    // Add default categories
    CATEGORIES.forEach(cat => categories.add(cat));
    
    // Add categories from questions
    allQuestions.forEach(q => {
      if (q.category) {
        categories.add(q.category);
      }
    });
    
    return Array.from(categories).sort();
  } catch (error) {
    console.error('Error getting categories:', error);
    return CATEGORIES; // Fallback to default categories
  }
}

/**
 * Get question statistics
 * 
 * @returns {Promise<Object>} - Statistics about available questions
 */
async function getQuestionStats() {
  try {
    // Ensure questions are loaded
    await loadQuestions();
    
    const allQuestions = [...questionCache.questions, ...questionCache.customQuestions];
    
    // Count by category
    const categoryStats = {};
    
    // Count by difficulty
    const difficultyStats = {
      easy: 0,
      medium: 0,
      hard: 0,
      other: 0
    };
    
    // Process each question
    allQuestions.forEach(q => {
      // Category stats
      if (q.category) {
        categoryStats[q.category] = (categoryStats[q.category] || 0) + 1;
      }
      
      // Difficulty stats
      if (q.difficulty === 'easy' || q.difficulty === 'medium' || q.difficulty === 'hard') {
        difficultyStats[q.difficulty]++;
      } else {
        difficultyStats.other++;
      }
    });
    
    return {
      total: allQuestions.length,
      builtIn: questionCache.questions.length,
      custom: questionCache.customQuestions.length,
      byCategory: categoryStats,
      byDifficulty: difficultyStats
    };
  } catch (error) {
    console.error('Error getting question stats:', error);
    return {
      total: SAMPLE_QUESTIONS.length,
      builtIn: SAMPLE_QUESTIONS.length,
      custom: 0,
      byCategory: {},
      byDifficulty: {
        easy: 0,
        medium: 0,
        hard: 0,
        other: 0
      }
    };
  }
}

/**
 * Format a question for the game engine
 * 
 * @param {Object} question - Raw question object
 * @returns {Object} - Formatted question
 */
function formatQuestionForGame(question) {
  return {
    id: question.id || uuidv4(),
    category: question.category || 'General Knowledge',
    difficulty: question.difficulty || 'medium',
    question: question.question,
    choices: question.choices,
    correctAnswerIndex: question.correctAnswerIndex,
    explanation: question.explanation || null,
    points: getPointsForDifficulty(question.difficulty),
    timeLimit: getTimeLimitForDifficulty(question.difficulty)
  };
}

/**
 * Validate a question object
 * 
 * @param {Object} question - Question to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidQuestion(question) {
  return (
    question &&
    typeof question === 'object' &&
    typeof question.question === 'string' &&
    Array.isArray(question.choices) &&
    question.choices.length >= 2 &&
    typeof question.correctAnswerIndex === 'number' &&
    question.correctAnswerIndex >= 0 &&
    question.correctAnswerIndex < question.choices.length
  );
}

/**
 * Get points based on difficulty
 * 
 * @param {string} difficulty - Difficulty level
 * @returns {number} - Points for this difficulty
 */
function getPointsForDifficulty(difficulty) {
  switch (difficulty) {
    case 'easy':
      return 100;
    case 'medium':
      return 200;
    case 'hard':
      return 300;
    default:
      return 100;
  }
}

/**
 * Get time limit based on difficulty
 * 
 * @param {string} difficulty - Difficulty level
 * @returns {number} - Time limit in seconds
 */
function getTimeLimitForDifficulty(difficulty) {
  switch (difficulty) {
    case 'easy':
      return 30;
    case 'medium':
      return 25;
    case 'hard':
      return 20;
    default:
      return 30;
  }
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * 
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Export functions
module.exports = {
  getTriviaQuestions,
  loadQuestions,
  saveCustomQuestions,
  getCategories,
  getQuestionStats,
  CATEGORIES
};
