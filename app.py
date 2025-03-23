import streamlit as st
import requests
import json
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Configuration
API_PORT = os.getenv('PORT', '5050')
API_URL = f"http://localhost:{API_PORT}/api/query"

# Set page configuration
st.set_page_config(
    page_title="AACE Compass",
    page_icon="🧭",
    layout="wide"
)

# Function to query the backend API
def query_rag_system(user_query):
    try:
        response = requests.post(
            API_URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps({"query": user_query})
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            st.error(f"Error: {response.status_code} - {response.text}")
            return {"answer": "Sorry, I encountered an error processing your request."}
    
    except Exception as e:
        st.error(f"Exception: {str(e)}")
        return {"answer": "Sorry, I couldn't connect to the backend service."}

# Main title 
st.markdown("<h1 style='text-align: center; color: #4F8FC0;'>AACE Compass</h1>", unsafe_allow_html=True)
st.markdown("<h3 style='text-align: center; color: #666666;'>Powered by Movar</h3>", unsafe_allow_html=True)
st.markdown("<hr>", unsafe_allow_html=True)

# Server status indicator
server_status = st.empty()
try:
    health_response = requests.get(f"http://localhost:{API_PORT}/health", timeout=2)
    if health_response.status_code == 200:
        server_status.success(f"✅ Connected to server on port {API_PORT}")
    else:
        server_status.error(f"❌ Server returned status code {health_response.status_code}")
except Exception as e:
    server_status.error(f"❌ Could not connect to server: {str(e)}")
    st.info(f"Make sure the server is running on port {API_PORT}. You can start it with 'npm start'")

# Initialize session state for chat history if it doesn't exist
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat messages from history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if message["role"] == "assistant" and "sources" in message:
            with st.expander("View Sources"):
                for i, source in enumerate(message["sources"]):
                    st.markdown(f"**Source {i+1}** (Score: {source['score']:.4f})")
                    st.markdown(source["text"])
                    st.markdown("---")

# User input
user_query = st.chat_input("Ask a question about AACE...")

# Handle user input
if user_query:
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": user_query})
    
    # Display user message in chat container
    with st.chat_message("user"):
        st.markdown(user_query)
    
    # Show a spinner while processing
    with st.spinner("Thinking..."):
        # Get response from backend
        response = query_rag_system(user_query)
    
    # Display assistant response in chat
    with st.chat_message("assistant"):
        st.markdown(response["answer"])
        
        # Add sources if available
        if "sources" in response:
            with st.expander("View Sources"):
                for i, source in enumerate(response["sources"]):
                    st.markdown(f"**Source {i+1}** (Score: {source['score']:.4f})")
                    st.markdown(source["text"])
                    st.markdown("---")
    
    # Add assistant response to chat history
    st.session_state.messages.append({
        "role": "assistant", 
        "content": response["answer"],
        "sources": response.get("sources", [])
    })

# Clear chat button
if st.button("Clear Chat History"):
    st.session_state.messages = []
    st.rerun()

# Sidebar with app information
with st.sidebar:
    st.title("About")
    st.info(
        """
        AACE Compass is a knowledge assistant powered by Movar technology.
        
        This system helps you navigate AACE resources including:
        - Recommended Practices
        - Journal articles
        - Technical documents
        - TCM Framework
        """
    )
    
    # Add helpful instructions
    st.markdown("### How to use")
    st.markdown(
        """
        1. Type your question in the chat input
        2. The system will search for relevant information
        3. View the AI's response based on the retrieved context
        4. Expand "View Sources" to see the retrieved documents
        """
    )
    
    # Add troubleshooting information
    with st.expander("Troubleshooting"):
        st.markdown(
            """
            If you're having issues:
            
            1. Check that the backend server is running:
               ```
               npm start
               ```
            
            2. Verify connection to Pinecone:
               ```
               node pinecone-debug.js
               ```
            
            3. Try the direct test tool:
               ```
               node test-rag.js
               ```
            
            4. Check backend logs for detailed error information
            """
        )
    
    # Footer
    st.markdown("---")
    st.markdown("<p style='text-align: center; color: #666666;'>© 2025 AACE Compass - Powered by Movar</p>", unsafe_allow_html=True)