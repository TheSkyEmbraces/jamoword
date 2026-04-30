import express from 'express';
import cors from 'cors';
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'jamoword';

app.use(cors());
app.use(express.json());

let db: Db;

async function connectToMongo() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(dbName);
    
    // Create indexes
    const collection = db.collection('scores');
    await collection.createIndex({ type: 1, size: 1, score: -1 });
    await collection.createIndex({ timestamp: 1 });
    await collection.createIndex({ nickname: 1, type: 1, size: 1 });
    
    console.log('Indexes created');
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }
}

// Routes
app.post('/api/scores', async (req, res) => {
  try {
    const { nickname, score, type, size } = req.body;
    
    if (!nickname || score === undefined || !type || !size) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const collection = db.collection('scores');
    const result = await collection.insertOne({
      nickname,
      score,
      type,
      size,
      timestamp: Date.now()
    });

    res.status(201).json({ message: 'Score saved', id: result.insertedId });
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/rankings', async (req, res) => {
  try {
    const { type, size, period } = req.query;
    
    const collection = db.collection('scores');
    const query: any = {};
    
    if (type) query.type = type;
    if (size) query.size = parseInt(size as string);
    
    if (period === 'daily') {
      query.timestamp = { $gt: Date.now() - 24 * 60 * 60 * 1000 };
    } else if (period === 'weekly') {
      query.timestamp = { $gt: Date.now() - 7 * 24 * 60 * 60 * 1000 };
    }

    const rankings = await collection
      .find(query)
      .sort({ score: -1, timestamp: 1 })
      .limit(10)
      .toArray();

    res.json(rankings);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/personal-best', async (req, res) => {
  try {
    const { nickname, type, size } = req.query;
    
    if (!nickname || !type || !size) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const collection = db.collection('scores');
    const query: any = { nickname, type, size: parseInt(size as string) };
    
    const best = await collection
      .find(query)
      .sort({ score: -1 })
      .limit(1)
      .toArray();

    res.json(best.length > 0 ? best[0].score : 0);
  } catch (error) {
    console.error('Error fetching personal best:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

connectToMongo().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});
