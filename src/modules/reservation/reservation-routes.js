const express = require('express');
const router = express.Router();
const reservationController = require('./reservation-controller');
const { authMiddleware } = require('../../middleware/auth');
const { validateReservationDates, validateRoomId, validateReservationId } = require('../../middleware/reservationValidation');

// Public routes - Check availability and get booked dates
router.get('/availability/:roomId', validateRoomId, reservationController.checkAvailability);
router.get('/booked-dates/:roomId', validateRoomId, reservationController.getBookedDatesForRoom);

// Protected routes - Require authentication
router.use(authMiddleware);

// Customer routes
router.post('/', validateReservationDates, reservationController.createReservation);
router.get('/my-reservations', reservationController.getUserReservations);
router.delete('/:reservationId', validateReservationId, reservationController.cancelReservation);
router.post('/:reservationId', reservationController.cancelReservationWithReason);

// Owner routes
router.get('/owner-reservations', reservationController.getOwnerReservations);
router.put('/:reservationId/status', validateReservationId, reservationController.updateReservationStatus);
router.put('/:reservationId/complete', validateReservationId, reservationController.completeReservation);

// Admin/System routes
router.post('/auto-complete', reservationController.autoCompleteReservations);
router.get('/', reservationController.getAllReservations);
router.get('/:reservationId', validateReservationId, reservationController.getReservationById);

module.exports = router;
