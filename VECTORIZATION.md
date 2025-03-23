# Document Vectorization Guide

This guide explains how to vectorize your documents and upload them to Pinecone for use with the AACE Compass chatbot.

## Overview

The vectorization process:
1. Reads documents from the `documents` folder
2. Parses PDFs and Excel files
3. Splits content into smaller chunks
4. Generates embeddings for each chunk using OpenAI
5. Uploads vectors to your Pinecone index

## Supported Document Types

- PDF files (`.pdf`)
- Excel files (`.xlsx`, `.xls`)

## Requirements

Before running the vectorization:

1. Ensure your `.env` file contains the correct API keys:
   ```
   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_INDEX_NAME=aace
   PINECONE_HOST=https://your-pinecone-host-url
   PINECONE_ENVIRONMENT=your_pinecone_environment
   OPENAI_API_KEY=your_openai_api_key
   ```

2. Make sure your Pinecone index exists and has the correct dimensions (3072)

3. Install the required dependencies:
   ```
   npm install  # For JavaScript version
   pip install -r requirements.txt  # For Python version
   ```

## Running the Vectorization

You have two options - JavaScript or Python:

### JavaScript Version

```bash
npm run vectorize
```

Or directly:

```bash
node vectorize-documents.js
```

### Python Version

```bash
python vectorize_documents.py
```

## Vectorization Process

The scripts will:
1. Verify connection to Pinecone
2. List all documents in the `documents` folder
3. Process each document:
   - Read the file contents
   - Split into chunks of ~1000 characters with 200-character overlap
   - Generate embeddings for each chunk
4. Upload vectors to Pinecone in batches of 100
5. Show progress and summary of vectorized documents

## Configuration Options

You can modify these values in the script if needed:

- `CHUNK_SIZE` (default: 1000) - Characters per chunk
- `CHUNK_OVERLAP` (default: 200) - Overlap between chunks
- `BATCH_SIZE` (default: 100) - Number of vectors per upload batch
- `MAX_RETRIES` (default: 3) - Retries for API calls

## Troubleshooting

### Common Issues

1. **OpenAI API Rate Limits**
   - If you hit rate limits, the script will retry with exponential backoff
   - If errors persist, you might need to reduce concurrency or use a different API key

2. **Pinecone Connection Issues**
   - Verify your API key, host URL, and index name
   - Check that your index is properly configured with 3072 dimensions
   - Run the `pinecone-debug.js` script first to verify connectivity

3. **Memory Issues**
   - If processing large files causes memory issues, try reducing the batch size
   - The scripts process one file at a time to minimize memory usage

### Checking Results

After vectorization, you can verify the vectors were uploaded by:

1. Checking the Pinecone dashboard for increased vector count
2. Running the debug tool:
   ```
   node pinecone-debug.js
   ```
3. Testing a query with the RAG chatbot

## Performance Notes

- Processing large PDFs can be time-consuming
- The vectorization process makes API calls to both OpenAI and Pinecone
- Cost depends on the amount of text in your documents (OpenAI embedding API charges per token)
- A typical document of 20 pages might generate 20-40 chunks/vectors

## Re-vectorizing Documents

If you need to update your vector database with new documents:
1. Add new documents to the `documents` folder
2. Run the vectorization script again
   - It will process and add all documents, including ones already processed
   - Pinecone will overwrite vectors with the same IDs

If you need to clear your database and start fresh:
1. Create a new Pinecone index
2. Update your `.env` file with the new index details
3. Run the vectorization process