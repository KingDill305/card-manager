
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));

app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);
const db = client.db('cardmanager');
const usersCollection = db.collection('users');
const cardsCollection = db.collection('cards');

app.get('/', (req, res) => {
  res.send('Card Manager Backend is Running!');
});

app.get('/api/ping', (req, res) => {
  res.json({
    message: 'Card Manager backend is working!'
  });
});

app.get('/api/db-test', async (req, res) => {
  try {
    const result = await client.db('admin')
      .command({ ping: 1 });

    res.json({
      message: 'MongoDB connected successfully!',
      result: result.ok
    });
  } catch (error) {
    console.error('Database test failed:', error.message);
    res.status(500).json({
      error: 'MongoDB connection failed'
    });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate user input
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.trim().length < 3 ||
      password.length < 8
    ) {
      return res.status(400).json({
        error: 'Username must be at least 3 characters and password at least 8 characters.'
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check for existing account
    const existingUser = await usersCollection.findOne({
      username: cleanUsername
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Username already exists.'
      });
    }

    // Securely hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Save user in MongoDB
    await usersCollection.insertOne({
      username: cleanUsername,
      passwordHash,
      createdAt: new Date()
    });

    res.status(201).json({
      message: 'User registered successfully!'
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Username already exists.'
      });
    }

    console.error('Registration error:', error.message);

    res.status(500).json({
      error: 'Registration failed.'
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: 'Username and password are required.'
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    const user = await usersCollection.findOne({
      username: cleanUsername
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid username or password.'
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Invalid username or password.'
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.json({
      message: 'Login successful!',
      token,
      username: user.username
    });

  } catch (error) {
    console.error('Login error:', error.message);

    return res.status(500).json({
      error: 'Login failed.'
    });
  }

});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({
      error: 'Invalid or expired token.'
    });
  }
}

app.post('/api/cards', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > 100 ||
      (description !== undefined &&
        (typeof description !== 'string' ||
          description.length > 1000))
    ) {
      return res.status(400).json({
        error: 'Card name is required (max 100 characters), and description must be at most 1000 characters.'
      });
    }

    const card = {
      userId: req.user.userId,
      name: name.trim(),
      description: description?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await cardsCollection.insertOne(card);

    return res.status(201).json({
      message: 'Card created successfully!',
      card: {
        ...card,
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error('Create card error:', error.message);

    return res.status(500).json({
      error: 'Failed to create card.'
    });
  }
});
 
app.get('/api/cards', authenticateToken, async (req, res) => {
  try {
    const search = req.query.search;

    if (
      search !== undefined &&
      (typeof search !== 'string' || search.length > 100)
    ) {
      return res.status(400).json({
        error: 'Search must be a string of at most 100 characters.'
      });
    }

    // Only return cards belonging to the logged-in user.
    const cards = await cardsCollection
      .find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .toArray();

    const searchText = (search || '').trim().toLowerCase();

    const matchingCards = searchText
      ? cards.filter(card =>
          card.name.toLowerCase().includes(searchText) ||
          (card.description || '').toLowerCase().includes(searchText)
        )
      : cards;

    return res.json({
      cards: matchingCards
    });

  } catch (error) {
    console.error('Search cards error:', error.message);

    return res.status(500).json({
      error: 'Failed to retrieve cards.'
    });
  }
});


const { ObjectId } = require('mongodb');

// EDIT CARD
app.put('/api/cards/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body || {};

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid card ID.' });
    }

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > 100 ||
      (description !== undefined &&
        (typeof description !== 'string' || description.length > 1000))
    ) {
      return res.status(400).json({
        error: 'Card name is required (max 100 characters). Description max 1000 characters.'
      });
    }

    const result = await cardsCollection.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        userId: req.user.userId
      },
      {
        $set: {
          name: name.trim(),
          description: (description || '').trim(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'Card not found.' });
    }

    return res.json({
      message: 'Card updated successfully!',
      card: result
    });
  } catch (error) {
    console.error('Update card error:', error.message);
    return res.status(500).json({ error: 'Failed to update card.' });
  }
});

// DELETE CARD
app.delete('/api/cards/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid card ID.' });
    }

    const result = await cardsCollection.deleteOne({
      _id: new ObjectId(id),
      userId: req.user.userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Card not found.' });
    }

    return res.json({ message: 'Card deleted successfully!' });
  } catch (error) {
    console.error('Delete card error:', error.message);
    return res.status(500).json({ error: 'Failed to delete card.' });
  }
});


async function startServer() {
  try {
    await client.connect();
    await usersCollection.createIndex(
  { username: 1 },
  { unique: true }
);
    console.log('Connected to MongoDB Atlas!');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
}

startServer();
