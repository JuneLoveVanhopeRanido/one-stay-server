const express = require('express');
const router = express.Router();

const authRoutes = require('./modules/auth/auth-routes');
const userRoutes = require('./modules/user/user-routes');
const resortRoutes = require('./modules/resort/resort-route');
const roomRoutes = require('./modules/room/room-routes');
const amenityRoutes = require('./modules/amenity/amenity-routes');

const reservationRoutes = require('./modules/reservation/reservation-routes');
const chatRoutes = require('./modules/chat/chat-routes');
const feedbackRoutes = require('./modules/feedback/feedback-routes');
const statsRoutes = require('./modules/stats/stats-routes');
const favoriteRoutes = require('./modules/favorite/favorite-routes');



router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/resort', resortRoutes);
router.use('/room', roomRoutes);
router.use('/amenity', amenityRoutes);
router.use('/reservation', reservationRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/chat', chatRoutes);
router.use('/stats', statsRoutes);
router.use('/favorites', favoriteRoutes);

module.exports = router;
