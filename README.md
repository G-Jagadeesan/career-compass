# Career Compass

An AI-powered career fit assessment app for users in India.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file and add your API credentials:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and replace `your_api_key_here` with your actual API key.

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser to `http://localhost:3000`

## Environment Variables

- `MIGI_API_KEY` - Your API key for the Migi AI gateway
- `MIGI_BASE_URL` - (Optional) Custom API base URL. Defaults to `https://ai.hyrenet-staging.in/v1`

## Usage

1. Fill out the context intake form with your education, experience, skills, and interests
2. Click "Generate Questions" to receive 8 personalized MCQs
3. Answer all 8 questions
4. Click "Submit Answers" to receive your career fit verdict
5. View your primary and secondary career matches with detailed reasoning

## Demo

Click "Try a demo profile" on the intake form to pre-fill with sample data and test the complete flow.

## Testing

Run the API smoke tests:
```bash
npm test
```

Run the end-to-end browser tests:
```bash
npm run test:ui
```

## Deployment

This app runs identically on AWS EC2 via `@hono/node-server` since there's no build step or database dependency. Simply:

1. Clone the repository
2. Run `npm install`
3. Set the `MIGI_API_KEY` environment variable (and optionally `MIGI_BASE_URL`)
4. Run `npm start`

The server will listen on port 3000 by default. Set the `PORT` environment variable to use a different port.

## Architecture

- **Server**: Hono framework running on Node.js with ESM
- **AI Integration**: OpenAI-compatible API gateway (Migi) with Claude Sonnet model
- **Frontend**: Vanilla HTML, CSS, JavaScript (no framework dependencies)
- **Persistence**: Flat JSON files for session trail (atomic writes)
- **No database required**
