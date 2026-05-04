import { VercelRequest, VercelResponse } from '@vercel/node';
const { connectToDatabase } = require("../db");
const Cors = require('cors');

const cors = Cors({
  methods: ['POST', 'HEAD', 'OPTIONS'],
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nickname, score, type, size, isWin } = req.body;

    if (!nickname || score === undefined || !type || !size) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('scores');

    let updateDoc = {
      $set: { timestamp: Date.now() },
      $inc: { played: 1 }
    };

    if (type === 'normal') {
      if (isWin) {
        updateDoc.$inc.score = 1;
      }
    } else {
      updateDoc.$max = { score: score };
      // For Timeattack/Infinite, 'score' is solved words in that session.
      // We could also track total words solved across all time.
      if (!updateDoc.$inc) updateDoc.$inc = {};
      updateDoc.$inc.totalSolved = score;
    }

    const result = await collection.updateOne(
      { nickname, type, size },
      updateDoc,
      { upsert: true }
    );

    return res.status(200).json({
      message: 'Score updated',
      id: result.upsertedId || 'existing',
    });
  } catch (error) {
    console.error('Error updating score:', error);

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}

module.exports = handler;
