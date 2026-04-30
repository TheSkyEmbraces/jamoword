import { VercelRequest, VercelResponse } from '@vercel/node';
const { connectToDatabase } = require("../db");
import Cors from 'cors';

const cors = Cors({
  methods: ['GET', 'HEAD'],
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nickname, type, size } = req.query;
    
    if (!nickname || !type || !size) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { db } = await connectToDatabase();
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
}
