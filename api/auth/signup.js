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

    if (nickname.length < 2) {
      return res.status(400).json({ error: 'Nickname must be at least 2 characters' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('users');

    const existingUser = await collection.findOne({ nickname });
    if (existingUser) {
      return res.status(409).json({ error: 'Nickname already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await collection.insertOne({
      nickname,
      password: hashedPassword,
      createdAt: Date.now(),
    });

    return res.status(201).json({
      message: 'User registered successfully',
      nickname,
    });
  } catch (error) {
    console.error('Error during signup:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = handler;
