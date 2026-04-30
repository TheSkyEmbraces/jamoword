import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = 'jamoword';

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  // Create indexes if they don't exist
  const collection = db.collection('scores');
  await collection.createIndex({ type: 1, size: 1, score: -1 });
  await collection.createIndex({ timestamp: 1 });
  await collection.createIndex({ nickname: 1, type: 1, size: 1 });

  return { client, db };
}
