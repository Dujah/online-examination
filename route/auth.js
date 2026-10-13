const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');
const { protect, restrictTo } = require('../middleware/auth.js');

router.post('/register', authController.register); // public, STUDENT only
router.post('/create-staff', protect, restrictTo('ADMIN'), authController.createStaff);
router.post('/login', authController.login);
router.get('/me', protect, authController.getMe);
router.post('/logout', authController.logout);

module.exports = router;
