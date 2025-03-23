const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');
const OpenAI = require('openai');

// Load environment variables
dotenv.config();

// Get configuration
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_HOST = process.env.PINECONE_HOST;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Validate required configuration
if (!PINECONE_API_KEY || !PINECONE_HOST || !OPENAI_API_KEY) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Function to generate embeddings
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
      dimensions: 3072
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`OpenAI embedding generation failed: ${error.message}`);
  }
}

// Function to perform vector search using direct API call
async function searchVectorDatabase(embedding, topK = 5) {
  try {
    console.log(`Querying Pinecone at ${PINECONE_HOST}/query with topK=${topK}`);
    
    const response = await axios({
      method: 'post',
      url: `${PINECONE_HOST}/query`,
      headers: {
        'Api-Key': PINECONE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: {
        vector: embedding,
        topK,
        includeMetadata: true
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`Pinecone query successful, received ${response.data.matches ? response.data.matches.length : 0} matches`);
    return response.data.matches || [];
  } catch (error) {
    console.error('Error querying Pinecone:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error(`Message: ${error.message}`);
    }
    throw new Error(`Pinecone query failed: ${error.message}`);
  }
}

// Root endpoint - display a simple welcome page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>AACE Compass API Server</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          line-height: 1.6;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          color: #333;
        }
        .card {
          background: #f9f9f9;
          border-left: 4px solid #007bff;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        code {
          background: #f0f0f0;
          padding: 2px 5px;
          border-radius: 3px;
          font-family: monospace;
        }
        .endpoints {
          margin-top: 20px;
        }
        .endpoint {
          margin-bottom: 10px;
          padding: 10px;
          background: #f0f0f0;
          border-radius: 4px;
        }
        .method {
          font-weight: bold;
          display: inline-block;
          width: 60px;
        }
        a {
          color: #007bff;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>AACE Compass API Server</h1>
        
        <div class="card">
          <p>The server is running correctly! This is the API server for the AACE Compass chatbot.</p>
          <p>To use the chatbot interface, you need to run the Streamlit app with:</p>
          <code>streamlit run app.py</code>
        </div>
        
        <div class="endpoints">
          <h2>Available Endpoints:</h2>
          
          <div class="endpoint">
            <span class="method">GET</span>
            <a href="/health">/health</a>
            <p>Check server status and configuration</p>
          </div>
          
          <div class="endpoint">
            <span class="method">POST</span>
            <code>/api/query</code>
            <p>Submit a question to the RAG system</p>
            <p>Example payload: <code>{"query": "What is AACE?"}</code></p>
          </div>
        </div>
        
        <h2>Next Steps:</h2>
        <ol>
          <li>Open a new terminal window</li>
          <li>Navigate to the AACE-Compass project folder</li>
          <li>Run <code>streamlit run app.py</code> to start the frontend</li>
          <li>The Streamlit interface will open in your browser automatically</li>
        </ol>
        
        <p><a href="http://localhost:8501">Click here</a> if you've already started the Streamlit server</p>
      </div>
    </body>
    </html>
  `);
});

// Route for querying the RAG system
app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`Received query: "${query}"`);
    
    // Generate embedding for the query
    console.log('Generating embedding...');
    const queryEmbedding = await generateEmbedding(query);
    console.log(`Generated embedding with ${queryEmbedding.length} dimensions`);
    
    // Search vector database
    console.log('Searching vector database...');
    const searchResults = await searchVectorDatabase(queryEmbedding);
    console.log(`Found ${searchResults.length} relevant documents`);
    
    if (searchResults.length === 0) {
      return res.json({
        answer: "I couldn't find any relevant information to answer your question.",
        sources: []
      });
    }
    
    // Extract context from search results
    const context = searchResults
      .map((match) => match.metadata.text)
      .join('\n\n');
    
    console.log('Generating response with OpenAI...');
    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions based on the provided context. 
          If the answer cannot be found in the context, acknowledge that you don't know rather than making up an answer.`
        },
        {
          role: 'user',
          content: `Context: ${context}\n\nQuestion: ${query}`
        }
      ],
      temperature: 0.3,
    });
    
    const answer = completion.choices[0].message.content;
    console.log('Response generated successfully');
    
    // Return response
    res.json({
      answer,
      sources: searchResults.map((match) => ({
        text: match.metadata.text,
        score: match.score,
        id: match.id,
        source: match.metadata.source || 'Unknown source'
      }))
    });
  } catch (error) {
    console.error('Error processing query:', error);
    res.status(500).json({ 
      error: 'An error occurred while processing your request', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    config: {
      pineconeHost: PINECONE_HOST,
      pineconeIndex: PINECONE_INDEX_NAME,
      pineconeApiKeyProvided: !!PINECONE_API_KEY,
      openaiApiKeyProvided: !!OPENAI_API_KEY
    }
  });
});

// Get the port - try multiple ports if the main one is busy
const DEFAULT_PORT = process.env.PORT || 5050;
let currentPort = DEFAULT_PORT;
const MAX_PORT_ATTEMPTS = 10;

// Function to start the server
function startServer(port, attempt = 1) {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Using Pinecone host: ${PINECONE_HOST}`);
    console.log(`API available at: http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`\nTo use the chatbot interface, run in a new terminal:`);
    console.log(`streamlit run app.py`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      server.close();
      startServer(port + 1, attempt + 1);
    } else {
      console.error(`Could not start server: ${err.message}`);
      if (err.code === 'EADDRINUSE') {
        console.error(`
-----------------------------------------
Port ${port} is already in use.
To fix this, you can either:
1. Kill the process using port ${port} with:
   - On macOS/Linux: lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill -9
   - On Windows: netstat -ano | findstr :${port} and then taskkill /PID <PID> /F
2. Change the PORT in your .env file
-----------------------------------------
`);
      }
      process.exit(1);
    }
  });
}

// Start the server with port retry logic
startServer(currentPort);