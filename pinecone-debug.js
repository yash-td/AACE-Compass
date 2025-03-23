const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');

// Load environment variables
dotenv.config();

async function debugPineconeConnection() {
  const results = {
    connectionInfo: {},
    testResults: [],
    errors: []
  };
  
  try {
    console.log('--- PINECONE CONNECTION DEBUGGING ---');
    
    // Get and validate configuration
    const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
    const PINECONE_HOST = process.env.PINECONE_HOST;
    const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
    
    results.connectionInfo = {
      host: PINECONE_HOST || 'Not set',
      indexName: PINECONE_INDEX_NAME || 'Not set',
      apiKeyProvided: !!PINECONE_API_KEY
    };
    
    console.log('Connection Information:');
    console.log(`- Host: ${PINECONE_HOST || 'Not set'}`);
    console.log(`- Index Name: ${PINECONE_INDEX_NAME || 'Not set'}`);
    console.log(`- API Key Provided: ${!!PINECONE_API_KEY}`);
    
    if (!PINECONE_API_KEY) {
      throw new Error('Pinecone API key is missing from .env file');
    }
    
    if (!PINECONE_HOST) {
      throw new Error('Pinecone host URL is missing from .env file');
    }
    
    if (!PINECONE_INDEX_NAME) {
      throw new Error('Pinecone index name is missing from .env file');
    }
    
    // Validate host URL format
    if (!PINECONE_HOST.startsWith('https://')) {
      throw new Error(`Host URL must start with https:// - Current value: ${PINECONE_HOST}`);
    }
    
    // Test 1: Basic connectivity - Make a HEAD request to the host
    console.log('\nTest 1: Testing basic connectivity to Pinecone...');
    try {
      const headResponse = await axios({
        method: 'head',
        url: PINECONE_HOST,
        headers: {
          'Api-Key': PINECONE_API_KEY
        },
        validateStatus: () => true // Don't throw on any status code
      });
      
      const statusCode = headResponse.status;
      const success = statusCode >= 200 && statusCode < 500;
      
      results.testResults.push({
        name: 'Basic Connectivity',
        success,
        statusCode,
        message: success ? 'Successfully connected to Pinecone API' : `Failed with status code ${statusCode}`
      });
      
      console.log(`- Status code: ${statusCode}`);
      console.log(`- Result: ${success ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      results.testResults.push({
        name: 'Basic Connectivity',
        success: false,
        error: error.message
      });
      
      console.log(`- Error: ${error.message}`);
      console.log('- Result: FAIL');
    }
    
    // Test 2: Index stats
    console.log('\nTest 2: Fetching index stats...');
    try {
      const statsResponse = await axios({
        method: 'get',
        url: `${PINECONE_HOST}/describe_index_stats`,
        headers: {
          'Api-Key': PINECONE_API_KEY,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });
      
      const statusCode = statsResponse.status;
      const success = statusCode === 200;
      
      results.testResults.push({
        name: 'Index Stats',
        success,
        statusCode,
        data: success ? statsResponse.data : null,
        message: success ? 'Successfully retrieved index stats' : `Failed with status code ${statusCode}`
      });
      
      console.log(`- Status code: ${statusCode}`);
      if (success) {
        console.log(`- Total vector count: ${statsResponse.data.totalVectorCount || 'Not available'}`);
        console.log(`- Dimension: ${statsResponse.data.dimension || 'Not available'}`);
      } else {
        console.log(`- Response: ${JSON.stringify(statsResponse.data)}`);
      }
      console.log(`- Result: ${success ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      results.testResults.push({
        name: 'Index Stats',
        success: false,
        error: error.message
      });
      
      console.log(`- Error: ${error.message}`);
      console.log('- Result: FAIL');
    }
    
    // Test 3: Simple query with empty vector
    console.log('\nTest 3: Performing test query with dummy vector...');
    try {
      // Create a dummy vector of the right size (3072 dimensions)
      const dummyVector = Array(3072).fill(0).map((_, i) => i % 2 === 0 ? 0.1 : -0.1);
      
      const queryResponse = await axios({
        method: 'post',
        url: `${PINECONE_HOST}/query`,
        headers: {
          'Api-Key': PINECONE_API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          vector: dummyVector,
          topK: 1,
          includeMetadata: true
        },
        validateStatus: () => true
      });
      
      const statusCode = queryResponse.status;
      const success = statusCode === 200;
      
      results.testResults.push({
        name: 'Test Query',
        success,
        statusCode,
        hasMatches: success && queryResponse.data.matches && queryResponse.data.matches.length > 0,
        message: success ? 'Successfully executed query' : `Failed with status code ${statusCode}`
      });
      
      console.log(`- Status code: ${statusCode}`);
      if (success) {
        console.log(`- Matches returned: ${queryResponse.data.matches ? queryResponse.data.matches.length : 0}`);
        if (queryResponse.data.matches && queryResponse.data.matches.length > 0) {
          console.log(`- First match score: ${queryResponse.data.matches[0].score}`);
        }
      } else {
        console.log(`- Response: ${JSON.stringify(queryResponse.data)}`);
      }
      console.log(`- Result: ${success ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      results.testResults.push({
        name: 'Test Query',
        success: false,
        error: error.message
      });
      
      console.log(`- Error: ${error.message}`);
      console.log('- Result: FAIL');
    }
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFilename = `pinecone-debug-${timestamp}.json`;
    fs.writeFileSync(resultsFilename, JSON.stringify(results, null, 2));
    console.log(`\nDebug results saved to ${resultsFilename}`);
    
    // Print overall status
    const allPassed = results.testResults.every(test => test.success);
    console.log(`\nOverall status: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    // Print troubleshooting advice
    console.log('\n--- TROUBLESHOOTING ADVICE ---');
    
    if (!allPassed) {
      const failedTests = results.testResults.filter(test => !test.success);
      
      console.log('Based on the failed tests, here are some suggestions:');
      
      failedTests.forEach(test => {
        switch (test.name) {
          case 'Basic Connectivity':
            console.log('1. Check if your Pinecone API key is correct');
            console.log('2. Verify that the host URL is correct and accessible');
            console.log('3. Ensure your network allows outbound HTTPS connections');
            break;
          
          case 'Index Stats':
            console.log('1. Verify that the index name exists in your Pinecone account');
            console.log('2. Check that your API key has access to this index');
            console.log('3. Try accessing the Pinecone console to confirm the index is active');
            break;
          
          case 'Test Query':
            console.log('1. Ensure your index has the correct dimensions (should be 3072)');
            console.log('2. Check if your index has any vectors (empty index will return empty matches)');
            console.log('3. Verify the query endpoint in the host URL is correct');
            break;
        }
      });
    } else {
      console.log('All tests passed! Your Pinecone connection is working correctly.');
    }
    
  } catch (error) {
    console.error(`\nFatal error: ${error.message}`);
    results.errors.push(error.message);
    
    // Save results even if a fatal error occurred
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFilename = `pinecone-debug-${timestamp}.json`;
    fs.writeFileSync(resultsFilename, JSON.stringify(results, null, 2));
    console.log(`\nDebug results saved to ${resultsFilename}`);
  }
}

debugPineconeConnection();