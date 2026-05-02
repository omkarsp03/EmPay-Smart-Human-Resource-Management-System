const router = require('express').Router();
const { askChatbot } = require('../controllers/chatbotController');
const { auth } = require('../middleware/auth');

router.post('/ask', auth, askChatbot);

module.exports = router;
