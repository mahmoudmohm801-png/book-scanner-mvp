require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/v1/search', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is working!',
  });
});

app.listen(PORT, () => {
  console.log(`
✅ Server running on http://localhost:${PORT}
Ready to accept requests! 🚀
  `);
});