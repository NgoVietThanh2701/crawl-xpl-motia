import { Pool, PoolClient } from "pg";

// Database connection pool
let pool: Pool | null = null;

export interface OrderBook {
  id?: number;
  uid: string;
  side: string; // buy hoặc sell
  username: string; // Tên người dùng
  price: number;
  quantity: number;
  funds: number;
  status: "open" | "close";
  created_at?: Date;
  updated_at?: Date;
}

export function getPool(): Pool {
  if (!pool) {
    // Use individual environment variables or DATABASE_URL
    const connectionConfig = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.DB_HOST || "localhost",
          port: parseInt(process.env.DB_PORT || "5432"),
          database: process.env.DB_NAME || "crawl_xpl",
          user: process.env.DB_USER || "postgres",
          password: process.env.DB_PASSWORD || "",
        };

    pool = new Pool({
      ...connectionConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

export async function query(text: string, params?: any[]): Promise<any> {
  const client = await getClient();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function createOrderBooksTable(): Promise<void> {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS order_books (
      id SERIAL PRIMARY KEY,
      uid VARCHAR(255) NOT NULL UNIQUE,
      side VARCHAR(10) NOT NULL,
      username VARCHAR(255) NOT NULL,
      price DECIMAL(20, 8) NOT NULL,
      quantity DECIMAL(20, 8) NOT NULL,
      funds DECIMAL(20, 8) NOT NULL,
      status VARCHAR(10) NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_order_books_uid ON order_books(uid);
    CREATE INDEX IF NOT EXISTS idx_order_books_side ON order_books(side);
    CREATE INDEX IF NOT EXISTS idx_order_books_status ON order_books(status);
    CREATE INDEX IF NOT EXISTS idx_order_books_created_at ON order_books(created_at);
  `;

  await query(createTableQuery);
}

export async function insertOrderBook(
  order: Omit<OrderBook, "id" | "created_at" | "updated_at">
): Promise<void> {
  const insertQuery = `
    INSERT INTO order_books (uid, side, username, price, quantity, funds, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (uid) 
    DO UPDATE SET 
      side = EXCLUDED.side,
      username = EXCLUDED.username,
      price = EXCLUDED.price,
      quantity = EXCLUDED.quantity,
      funds = EXCLUDED.funds,
      status = EXCLUDED.status,
      updated_at = CURRENT_TIMESTAMP
  `;

  await query(insertQuery, [
    order.uid,
    order.side,
    order.username,
    order.price,
    order.quantity,
    order.funds,
    order.status,
  ]);
}

export async function updateOrderStatus(
  uid: string,
  status: "open" | "close"
): Promise<void> {
  const updateQuery = `
    UPDATE order_books 
    SET status = $1, updated_at = CURRENT_TIMESTAMP 
    WHERE uid = $2
  `;

  await query(updateQuery, [status, uid]);
}

export async function getAllOrderBooks(): Promise<OrderBook[]> {
  const selectQuery = `
    SELECT id, uid, side, username, price, quantity, funds, status, created_at, updated_at
    FROM order_books
    ORDER BY created_at ASC
  `;

  const result = await query(selectQuery);
  return result.rows;
}

export async function getOrderBooksByStatus(
  status: "open" | "close"
): Promise<OrderBook[]> {
  const selectQuery = `
    SELECT id, uid, side, username, price, quantity, funds, status, created_at, updated_at
    FROM order_books
    WHERE status = $1
    ORDER BY created_at ASC
  `;

  const result = await query(selectQuery, [status]);
  return result.rows;
}

export async function close(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
