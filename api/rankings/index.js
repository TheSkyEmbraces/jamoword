import { VercelRequest, VercelResponse } from '@vercel/node';
const { connectToDatabase } = require("../db");
const Cors = require('cors');

const cors = Cors({
  methods: ['GET', 'HEAD'],
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

async function handler(req, res) {
  await runMiddleware(req, res, cors);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, size, period } = req.query;

    const { db } = await connectToDatabase();
    const collection = db.collection('scores');

    const query = {};

    if (type) {
      query.type = type;
    }

    if (size) {
      query.size = parseInt(size, 10);
    }

    if (period === 'daily') {
      query.timestamp = {
        $gt: Date.now() - 24 * 60 * 60 * 1000,
      };
    } else if (period === 'weekly') {
      query.timestamp = {
        $gt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      };
    }

    const rankings = await collection
      .find(query)
      .sort({ score: -1, timestamp: 1 })
      .limit(10)
      .toArray();

    return res.status(200).json(rankings);
  } catch (error) {
    console.error('Error fetching rankings:', error);

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}

module.exports = handler;
