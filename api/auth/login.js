const { connectToDatabase } = require("../db");
const bcrypt = require('bcryptjs');
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
    const { nickname, password } = req.body;

    if (!nickname || !password) {
      return res.status(400).json({ error: 'Missing nickname or password' });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('users');

    const user = await collection.findOne({ nickname });
    if (!user) {
      return res.status(401).json({ error: 'Invalid nickname or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid nickname or password' });
    }

    return res.status(200).json({
      message: 'Login successful',
      nickname: user.nickname,
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = handler;
