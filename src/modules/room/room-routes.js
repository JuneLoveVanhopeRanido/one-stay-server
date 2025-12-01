const express = require('express');
const router = express.Router();
const roomController = require('./room-controller');
const { authMiddleware, ownerOnly } = require('../../middleware/auth');
const { uploadSingle, handleMulterError } = require('../../middleware/upload');

// Public routes - Anyone can view rooms
router.get('/', roomController.getAllRooms);
router.get('/resort/:resortId', roomController.getRoomsByResort);
router.get('/resort/available-rooms/:resortId/:startDate/:endDate', roomController.getAvailableRooms); 


router.get('/:id', roomController.getRoomById);
// Protected routes - Require authentication (for owners)
router.use(authMiddleware);

router.post('/', authMiddleware, ownerOnly, uploadSingle, handleMulterError, roomController.createRoom);
router.put('/:id', authMiddleware, ownerOnly, uploadSingle, handleMulterError, roomController.updateRoom);
// router.put('/:id', roomController.updateRoom);
router.delete('/:id', roomController.deleteRoom);

module.exports = router;
