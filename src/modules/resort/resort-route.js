const express = require('express');
const router = express.Router();
const resortController = require('./resort-controller');
const { authMiddleware, ownerOnly } = require('../../middleware/auth');
const { uploadSingle, handleMulterError } = require('../../middleware/upload');

// Public routes
router.get('/', resortController.getAllResorts);
router.get('/search', resortController.searchResorts);
router.get('/featured', resortController.getFeaturedResorts);
router.post('/available', resortController.getAvailableResorts);
router.get('/owner/:owner_id', resortController.getResortByOwnerId);
router.get('/:id', resortController.getResortById);

// Protected routes (require authentication)
router.get('/my/resort', authMiddleware, ownerOnly, resortController.getMyResort);
router.post('/', authMiddleware, ownerOnly, uploadSingle, handleMulterError, resortController.createResort);
router.put('/:id', authMiddleware, ownerOnly, uploadSingle, handleMulterError, resortController.updateResort);
router.put('/:id/image', authMiddleware, ownerOnly, uploadSingle, handleMulterError, resortController.uploadResortImage);
router.delete('/:id', authMiddleware, ownerOnly, resortController.deleteResort);

module.exports = router;
