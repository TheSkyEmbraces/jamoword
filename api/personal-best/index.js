import { VercelRequest, VercelResponse } from '@vercel/node';
const { connectToDatabase } = require("../db");
const Cors = require('cors');

const cors = Cors({
  methods: ['GET', 'HEAD', 'OPTIONS'],
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
    const { nickname, type, size } = req.query;

    if (!nickname || !type || !size) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('scores');

    const query = {
      nickname,
      type,
      size: parseInt(size, 10),
    };

    const stats = await collection.findOne(query);

    return res.status(200).json(stats || { score: 0, played: 0 });
  } catch (error) {
    console.error('Error fetching personal best:', error);

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}

module.exports = handler;
