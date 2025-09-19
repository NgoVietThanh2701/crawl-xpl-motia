# Crawl XPL Motia

XPL token order book crawler built with Motia framework. This application fetches real-time order book data from KuCoin's XPL pre-market and manages order status tracking.

## Overview

This project provides:

- Real-time XPL order book data fetching from KuCoin
- Order status management (open/close)
- Historical order tracking
- RESTful API for data access

## Features

- **Order Book Crawling**: Fetches buy/sell orders from KuCoin XPL pre-market
- **Status Management**: Automatically tracks order status changes
- **Data Persistence**: Saves order data to JSON file with timestamps
- **REST API**: Provides HTTP endpoints for data access
- **Real-time Updates**: Monitors order changes and updates status accordingly

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Start development server

```bash
npm run dev
```

3. Access the API

```bash
curl http://localhost:3000/fetch-xpl
```

## API Endpoints

- `GET /fetch-xpl` - Fetch XPL order book data and save to file

## Data Structure

The application saves data to `xpl-token.txt` with the following structure:

```json
{
  "timestamp": "09/19/2025, 08:26:12",
  "summary": {
    "totalBuyPages": 3,
    "totalSellPages": 6,
    "totalBuyOrders": 25,
    "totalSellOrders": 58
  },
  "buyOrders": [...],
  "sellOrders": [...]
}
```

## Order Status

- `"open"` - Order is currently active
- `"close"` - Order is no longer available

## License

MIT
