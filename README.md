# 🤖 EAP AI Service

> Unified AI-powered service for database schema generation and ERD evaluation using natural language.

[![Mastra](https://img.shields.io/badge/Mastra-0.10.10-blue)](https://mastra.ai)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-orange)](https://ai.google.dev)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-green)](https://openai.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

## 📋 Overview

This unified service combines two powerful AI capabilities:

1. **Database Generation** - Conversational chatbot that creates and modifies database schemas through natural language
2. **ERD Evaluation** - Automated evaluation and extraction of Entity-Relationship Diagrams from images

## ✨ Features

### Database Generation

- 🎯 **Natural Language Interface** - Describe your database in plain English
- 💬 **Multi-Turn Conversations** - Refine schemas through dialogue
- 🧠 **Intelligent CREATE/MODIFY Detection** - Agent automatically understands context
- 🔄 **Backend Memory Management** - Persistent conversation history
- 📝 **Automatic DDL Generation** - Ready-to-use SQL scripts

### ERD Evaluation

- 📸 **Image Analysis** - Extract database schemas from ERD images
- 🔍 **Comprehensive Extraction** - Entities, attributes, relationships, and constraints
- ✅ **Automated Evaluation** - Quality assessment of ERD designs
- 🌐 **Translation Support** - Multi-language ERD processing
- 📊 **Multiple Output Formats** - JSON, DDL scripts, and Mermaid diagrams

## 🏗️ Architecture

```
eap-ai-service/
├── src/
│   ├── api/                    # Custom API routes
│   │   └── api-routes.ts       # Database generation endpoints
│   ├── mastra/
│   │   ├── agents/
│   │   │   ├── db-generation/  # Database schema agents
│   │   │   │   ├── conversational-schema-agent.ts
│   │   │   │   ├── ddl-script-generation-agent.ts
│   │   │   │   └── prompts/
│   │   │   └── evaluation/     # ERD evaluation agents
│   │   │       ├── erd-evaluation.agent.ts
│   │   │       ├── erd-information-extract.agent.ts
│   │   │       ├── translator.agent.ts
│   │   │       └── prompts/
│   │   ├── workflows/
│   │   │   ├── db-generation/  # Conversational DB design workflow
│   │   │   ├── evaluation/     # ERD evaluation workflows
│   │   │   └── translation/    # Translation workflow
│   │   ├── models/             # AI model configurations
│   │   ├── utils/              # Helper utilities
│   │   ├── index.ts            # Main Mastra configuration
│   │   └── memory.ts           # Conversation memory
│   └── schemas/                # Zod validation schemas
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.9.0
- pnpm >= 9.14.4
- Google AI API Key (Gemini)
- OpenAI API Key (optional, for evaluation features)

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
# Required: GOOGLE_GENERATIVE_AI_API_KEY
# Optional: OPENAI_API_KEY (for ERD evaluation)
```

### Configuration

Edit `.env` file:

```bash
# Required: Google AI for both features
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# Optional: OpenAI for ERD evaluation
OPENAI_API_KEY=your_openai_api_key_here

# Server configuration
PORT=4111
NODE_ENV=development

# CORS origins (comma-separated)
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Logging
MASTRA_LOG_LEVEL=info
```

### Running the Service

```bash
# Development mode with hot reload
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start
```

The server will start on `http://localhost:4111`

## 📡 API Endpoints

### Database Generation Endpoints

#### Chat Endpoint

```http
POST /chat
Content-Type: application/json

{
  "conversationId": "unique-session-id",
  "message": "Create a blog with User and Post tables"
}

Response:
{
  "success": true,
  "conversationId": "unique-session-id",
  "response": "I've created a blog schema...",
  "schema": {
    "entities": [...]
  },
  "ddl": "CREATE TABLE users (...)"
}
```

#### Get Conversation History

```http
GET /conversation/:conversationId

Response:
{
  "success": true,
  "conversationId": "unique-session-id",
  "messages": [...]
}
```

#### Reset Conversation

```http
DELETE /conversation/:conversationId

Response:
{
  "success": true,
  "message": "Conversation reset"
}
```

#### Health Check

```http
GET /health

Response:
{
  "status": "ok",
  "service": "EAP AI Service"
}
```

### ERD Evaluation Workflows

#### Run Evaluation Workflow

```http
POST /workflows/evaluationWorkflow/run
Content-Type: application/json

{
  "erdImage": "https://example.com/erd-diagram.png",
  "userToken": "optional-auth-token"
}

Response:
{
  "entities": [...],
  "ddlScript": "CREATE TABLE ...",
  "mermaidDiagram": "erDiagram ...",
  "evaluation": "The ERD is well-designed..."
}
```

#### Run Translation Workflow

```http
POST /workflows/translationWorkflow/run
Content-Type: application/json

{
  "erdImage": "https://example.com/erd-diagram.png",
  "userToken": "optional-auth-token"
}
```

### Mastra Default Endpoints

```http
GET /workflows           # List all workflows
GET /agents              # List all agents
GET /api/logs            # View logs (if enabled)
```

## 💡 Usage Examples

### Example 1: Create Database Schema

```bash
# Initial schema creation
curl -X POST http://localhost:4111/chat \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "blog-project",
    "message": "Create a blog with users, posts, and comments"
  }'

# Refine the schema
curl -X POST http://localhost:4111/chat \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "blog-project",
    "message": "Add timestamps and soft delete to all tables"
  }'

# Generate final DDL
curl -X POST http://localhost:4111/chat \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "blog-project",
    "message": "Show me the complete SQL script"
  }'
```

### Example 2: Evaluate ERD Image

```bash
curl -X POST http://localhost:4111/workflows/evaluationWorkflow/run \
  -H "Content-Type: application/json" \
  -d '{
    "erdImage": "https://storage.example.com/erds/my-diagram.png"
  }'
```

### Example 3: Multi-turn Conversation

```javascript
// JavaScript/TypeScript example
const conversationId = crypto.randomUUID();

// Step 1: Create initial schema
await fetch("http://localhost:4111/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    conversationId,
    message: "Create an e-commerce database",
  }),
});

// Step 2: Add specific tables
await fetch("http://localhost:4111/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    conversationId,
    message: "Add Product, Category, and Order tables",
  }),
});

// Step 3: Add relationships
await fetch("http://localhost:4111/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    conversationId,
    message: "Add many-to-many relationship between Products and Categories",
  }),
});
```

## 🎯 Key Components

### Agents

#### Database Generation

- **conversationalSchemaAgent** - Handles natural language to schema conversion
- **ddlScriptGenerationAgent** - Generates SQL DDL scripts from schemas

#### ERD Evaluation

- **erdInformationExtractAgent** - Extracts structured data from ERD images
- **erdEvaluationAgent** - Evaluates ERD quality and design
- **translatorAgent** - Translates non-English ERDs

### Workflows

1. **dbGenerationWorkflow** - Multi-step conversational database design
2. **evaluationWorkflow** - Complete ERD evaluation pipeline
3. **evaluationSyncWorkflow** - Synchronous ERD evaluation
4. **translationWorkflow** - ERD translation pipeline

## 🔧 Configuration

### Environment Variables

| Variable                       | Required | Default     | Description                   |
| ------------------------------ | -------- | ----------- | ----------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes      | -           | Google Gemini API key         |
| `OPENAI_API_KEY`               | No       | -           | OpenAI API key for evaluation |
| `PORT`                         | No       | 4111        | Server port                   |
| `NODE_ENV`                     | No       | development | Environment mode              |
| `CORS_ORIGIN`                  | No       | localhost   | Allowed CORS origins          |
| `MASTRA_LOG_LEVEL`             | No       | info        | Logging level                 |

### AI Models Used

- **Google Gemini 2.5 Flash** - Primary model for both features
- **Google Gemini 2.5 Flash Lite** - Lightweight operations
- **OpenAI GPT-4** - Optional, for ERD evaluation

## 🧪 Development

### Project Structure

```
src/
├── api/                    # REST API routes
├── mastra/
│   ├── agents/            # AI agents (organized by domain)
│   ├── workflows/         # Workflow definitions
│   ├── models/            # Model configurations
│   ├── utils/             # Utilities
│   └── index.ts           # Main entry point
└── schemas/               # Data validation schemas
```

### Adding New Features

1. **New Agent**: Add to `src/mastra/agents/[domain]/`
2. **New Workflow**: Add to `src/mastra/workflows/[domain]/`
3. **New API Route**: Add to `src/api/api-routes.ts`
4. **Register in index.ts**: Add to `src/mastra/index.ts`

### Testing

```bash
# Type checking
npx tsc --noEmit

# Build
pnpm build

# Run development server
pnpm dev
```

## 📊 Monitoring & Logging

The service includes:

- **Structured logging** via Pino logger
- **Telemetry** via LangSmith integration
- **Request/Response logging** for debugging
- **Error tracking** with detailed stack traces

Configure logging level in `.env`:

```bash
MASTRA_LOG_LEVEL=trace|debug|info|warn|error|fatal
```

## 🚢 Deployment

### Docker Support

A Dockerfile is included for containerized deployment:

```bash
# Build image
docker build -t eap-ai-service .

# Run container
docker run -p 4111:4111 \
  -e GOOGLE_GENERATIVE_AI_API_KEY=your_key \
  -e OPENAI_API_KEY=your_key \
  eap-ai-service
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure proper `CORS_ORIGIN`
- [ ] Set up environment variables securely
- [ ] Enable logging with appropriate level
- [ ] Set up monitoring and alerts
- [ ] Configure reverse proxy (nginx/Caddy)
- [ ] Set up SSL/TLS certificates

## 🤝 Contributing

This is a merged service combining:

- **eap-db-generation-service** - Database generation features
- **eap-evaluation-service** - ERD evaluation features

## 📝 License

ISC

## 🙏 Acknowledgments

- [Mastra](https://mastra.ai) - AI workflow orchestration framework
- [Google Gemini](https://ai.google.dev) - Primary AI model
- [OpenAI](https://openai.com) - Optional AI model
- [LangSmith](https://smith.langchain.com) - Telemetry and monitoring

## 📞 Support

For issues and questions:

- Check the logs: Set `MASTRA_LOG_LEVEL=debug`
- Verify API keys are correctly set
- Ensure CORS origins include your frontend URL
- Check that port 4111 is available

---

**Built with ❤️ using Mastra AI Framework**
