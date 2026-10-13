const express = require('express');
const router = express.Router();
const userController = require('../controller/userController');
const { protect, restrictTo } = require('../middleware/auth.js');

router.get('/teachers', protect, restrictTo('ADMIN'), userController.getAllTeachers);

module.exports = router;
