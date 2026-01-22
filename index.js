require('dotenv').config();
const express = require('express');
const { SessionsClient } = require('@google-cloud/dialogflow-cx');
const uuid = require('uuid');

const app = express();
app.use(express.json());

// 1. Configuration - Use Environment Variables for Cloud Run
const projectId = process.env.PROJECT_ID || 'prj-gdg-ai-meetup-20250717-1';
const location = process.env.LOCATION || 'global';
const agentId = process.env.AGENT_ID;
const languageCode = process.env.LANGUAGE_CODE || 'en';

console.log("-----------------------------------------");
console.log("DEBUG STARTUP:");
console.log("Project ID from Env:", projectId);
console.log("Location:", location);
console.log("Agent ID:", agentId);
console.log("-----------------------------------------");

// Validation Check
if (!projectId || !agentId) {
  console.error("ERROR: Missing PROJECT_ID or AGENT_ID in environment variables.");
  process.exit(1);
}

// 2. Initialize the CX Client
// NOTE: Regional endpoints are mandatory if your agent is not 'global'
const clientOptions = {
  apiEndpoint: location === 'global' ? undefined : `${location}-dialogflow.googleapis.com`
};
const sessionsClient = new SessionsClient(clientOptions);

/**
 * Endpoint to interact with Dialogflow CX
 * Request Body: { "text": "Check order 123", "sessionId": "optional-uuid" }
 */
app.post('/api/message', async (req, res) => {
  const { text, sessionId } = req.body;

  // Create a unique session ID if one isn't provided
  const activeSessionId = sessionId || uuid.v4();

  const sessionPath = sessionsClient.projectLocationAgentSessionPath(
    projectId,
    location,
    agentId,
    activeSessionId
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: { text },
      languageCode,
    },
  };

  try {
    // Call Dialogflow CX Detect Intent
    const [response] = await sessionsClient.detectIntent(request);
    const result = response.queryResult;

    // Based on your Webhook code, we want to extract the text messages 
    // that your webhook injected into 'fulfillmentResponse'
    const messages = result.responseMessages.map(msg => {
      if (msg.text) return msg.text.text[0];
      return null;
    }).filter(Boolean);

    // Prepare response for your frontend/client
    res.json({
      sessionId: activeSessionId,
      responses: messages,
      intent: result.match?.intent?.displayName,
      currentPage: result.currentPage?.displayName,
      // Returning parameters so you can see if the orderId was captured
      parameters: result.parameters 
    });

  } catch (error) {
    console.error('CX API Error:', error);
    res.status(500).json({ error: 'Failed to connect to Dialogflow CX', details: error.message });
  }
});

// Simple health check for Cloud Run
app.get('/', (req, res) => res.send('Client App is Running'));

// const PORT = process.env.PORT || 8081; // Client usually runs on a different port than webhook
// app.listen(PORT, () => {
//   console.log(`Client App listening on port ${PORT}`);
// });

// Use the PORT provided by Cloud Run, or default to 8080
const port = process.env.PORT || 8080;

app.listen(port, '0.0.0.0', () => {
  console.log(`Client app listening on port ${port}`);
});