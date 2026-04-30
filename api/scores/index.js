import { VercelRequest, VercelResponse } from '@vercel/node';
const { connectToDatabase } = require("../db");
const Cors = require('cors');

const cors = Cors({
  methods: ['POST', 'HEAD'],
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
      timestamp: Date.now(),
    });

    return res.status(201).json({
      message: 'Score saved',
      id: result.insertedId,
    });
  } catch (error) {
    console.error('Error saving score:', error);

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}

module.exports = handler;
