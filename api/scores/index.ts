import { VercelRequest, VercelResponse } from '@vercel/node';
const { connectToDatabase } = require("../db");
import Cors from 'cors';

const cors = Cors({
  methods: ['POST', 'HEAD'],
});

function runMiddleware(req: VercelRequest, res: VercelResponse, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await runMiddleware(req, res, cors);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nickname, score, type, size } = req.body;
    
    if (!nickname || score === undefined || !type || !size) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { db } = await connectToDatabase();
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
}
