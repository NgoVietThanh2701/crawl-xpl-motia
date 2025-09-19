# Crawl XPL Motia

XPL token order book crawler built with Motia framework. This application fetches real-time order book data from KuCoin's XPL pre-market and provides intelligent order status management and tracking capabilities.

## 🚀 Overview

This project provides a comprehensive solution for:

- **Real-time XPL order book data fetching** from KuCoin pre-market
- **Intelligent order status management** (open/close tracking)
- **Historical order tracking** with database persistence
- **RESTful API** for data access and management
- **Automated cron job** for continuous data collection
- **TypeScript workflow** with modern Node.js features

## 📁 Project Structure

```
crawl-xpl-motia/
├── steps/                          # Core Motia workflow steps
│   ├── xpl/                        # XPL Orders Domain
│   │   ├── fetch-xpl.step.ts       # API: Manual data fetching
│   │   ├── fetch-xpl-cron.step.ts  # Cron: Automated data collection
│   │   ├── get-xpl-orders.step.ts  # API: Retrieve order data
│   │   └── process-xpl-data.step.ts # Event: Core data processing logic
│   ├── database/                   # Database Domain
│   │   └── init-database.step.ts   # API: Database initialization
│   └── utils/                      # Shared utilities
│       └── database.ts             # Database operations and queries
├── types.d.ts                     # TypeScript type definitions
├── motia-workbench.json          # Motia workbench configuration
├── package.json                   # Node.js dependencies
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # This file
```

## 🛠️ Installation & Setup

### Prerequisites

- **Node.js** (v18 or higher)
- **PostgreSQL** (v12 or higher)

### 1. Install Dependencies

```bash
# Install required dependencies
npm install @types/pg pg dotenv

# Or install all dependencies from package.json
npm install
```

### Required Dependencies

- **`@types/pg`** - TypeScript types for PostgreSQL
- **`pg`** - PostgreSQL client for Node.js
- **`dotenv`** - Environment variables management
- **`motia`** - Motia framework core
- **`zod`** - Schema validation

### 2. Database Setup

#### PostgreSQL Configuration

Create a PostgreSQL database and configure connection:

````sql
-- Create database
CREATE DATABASE xpl_orders;

#### Initialize Database

The application will automatically create the required tables on first run, or you can manually initialize:

```bash
# Call the init-database API endpoint
curl -X POST http://localhost:3000/init-database
````

### 3. Environment Variables

Create a `.env` file in the project root:

````env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=xpl_orders
DB_USER=your_username
DB_PASSWORD=your_password

### 4. Start Development Server

```bash
# Start with workbench UI
npm run dev

The server will start on `http://localhost:3000`

## 🔧 API Endpoints

### Core Endpoints

| Method | Endpoint         | Description                           |
| ------ | ---------------- | ------------------------------------- |
| `GET`  | `/fetch-xpl`     | Fetch XPL order book data manually    |
| `GET`  | `/order-books`   | Retrieve all order data from database |
| `POST` | `/init-database` | Initialize database tables            |

### API Response Format

All endpoints return JSON responses with the following structure:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ }
}
```

## ⏰ Cron Job System

### Automated Data Collection

The application includes a cron job that automatically fetches XPL data every minute:

- **Schedule**: `*/1 * * * *` (every minute)
- **Job Name**: `FetchXplCron`
- **Flow**: `xpl-management`
- **Location**: `steps/xpl/fetch-xpl-cron.step.ts`

### Event-Driven Architecture

The cron job uses an event-driven approach:

1. **Cron Job** (`fetch-xpl-cron.step.ts`) emits `xpl.fetch.requested` event
2. **Event Handler** (`process-xpl-data.step.ts`) processes the event
3. **Data Processing** fetches from KuCoin and saves to database

### Cron Job Configuration

```typescript
export const config: CronConfig = {
  type: "cron",
  name: "FetchXplCron",
  description: "Cron job to automatically fetch XPL data every minute",
  cron: "*/1 * * * *", // Every minute
  emits: ["xpl.fetch.requested"],
  flows: ["xpl-management"],
};
````

## 🗄️ Database Schema

### Order Books Table

```sql
CREATE TABLE order_books (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(255) UNIQUE NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  username VARCHAR(255),
  price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  funds DECIMAL(20, 8) NOT NULL,
  status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'close')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Order Status Management

- **`open`**: Order is currently active and available
- **`close`**: Order is no longer available (removed from market)
- **Automatic tracking**: System automatically updates status when orders disappear

## 🔄 Workflow Architecture

### Motia Flows

1. **`api-endpoints`**: Contains API endpoints for manual operations
2. **`xpl-management`**: Contains cron jobs and order management
3. **`xpl-processing`**: Contains event-driven data processing
4. **`database-management`**: Contains database initialization

### Step Types

- **API Steps**: HTTP endpoints for external access
- **Cron Steps**: Scheduled tasks for automation
- **Event Steps**: Event-driven processing for core business logic

### Event-Driven Processing Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Cron Job      │    │   API Endpoint   │    │   Event Handler     │
│                 │    │                  │    │                     │
│ fetch-xpl-cron  │    │   fetch-xpl      │    │ process-xpl-data    │
│                 │    │                  │    │                     │
│ Emits:          │    │ Emits:           │    │ Subscribes:         │
│ xpl.fetch.      │    │ xpl.fetch.       │    │ xpl.fetch.          │
│ requested       │    │ requested        │    │ requested           │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────┐
                    │   Data Processing   │
                    │                     │
                    │ • Fetch from KuCoin │
                    │ • Compare orders    │
                    │ • Update database   │
                    │ • Track status      │
                    └─────────────────────┘
```

## 🚀 Production Deployment

### Environment Setup

1. **Database**: Ensure PostgreSQL is running and accessible
2. **Environment Variables**: Configure all required environment variables
3. **Dependencies**: Install all required packages
4. **Build**: Compile TypeScript to JavaScript (if needed)

### Deployment Steps

```bash
# Install dependencies
npm install

# Set environment variables
export DB_HOST=your_db_host
export DB_PORT=5432
export DB_NAME=xpl_orders
export DB_USER=your_username
export DB_PASSWORD=your_password

# Start the application
npm run dev
```

## 📊 Monitoring & Logging

### Log Levels

- **INFO**: General information and successful operations
- **ERROR**: Error conditions and failures
- **DEBUG**: Detailed debugging information

### Monitoring Endpoints

- **Health Check**: `GET /health` (if implemented)
- **Metrics**: Available through Motia workbench
- **Cron Status**: Visible in terminal logs

### Development

### Running the Application

```bash
# Start development server
npm run dev

# Start with workbench UI
npm run dev:workbench

# Build project
npm run build

# Run tests
npm test
```

### File Organization

The project follows a domain-driven structure:

- **`steps/xpl/`**: All XPL-related functionality
- **`steps/database/`**: Database management
- **`utils/`**: Shared utilities and helpers

### Key Features

- **Event-Driven Architecture**: Clean separation of concerns
- **TypeScript**: Full type safety and modern JavaScript features
- **PostgreSQL**: Reliable data persistence
- **Cron Jobs**: Automated data collection
- **RESTful APIs**: Easy integration with external systems

**Built with ❤️ using Motia Framework**
