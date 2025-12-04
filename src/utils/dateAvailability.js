const Reservation = require('../models/reservation-model');

/**
 * Check if a room is available for the given date range
 * @param {string} roomId - The room ID to check
 * @param {Date} startDate - Check-in date
 * @param {Date} endDate - Check-out date
 * @param {string} excludeReservationId - Reservation ID to exclude (for updates)
 * @returns {Promise<boolean>} - True if available, false if not
 */
const isRoomAvailable = async (roomId, startDate, endDate, excludeReservationId = null) => {
  try {
    // Build query to find conflicting reservations
    const query = {
      room_id: roomId,
      deleted: false,
      status: { $in: ['approved', 'pending'] }, // Only consider approved or pending reservations
      $or: [
        // New reservation starts during existing reservation
        { start_date: { $lte: startDate }, end_date: { $gt: startDate } },
        // New reservation ends during existing reservation
        { start_date: { $lt: endDate }, end_date: { $gte: endDate } },
        // New reservation completely contains existing reservation
        { start_date: { $gte: startDate }, end_date: { $lte: endDate } },
        // Existing reservation completely contains new reservation
        { start_date: { $lte: startDate }, end_date: { $gte: endDate } }
      ]
    };

    // Exclude specific reservation if provided (for updates)
    if (excludeReservationId) {
      query._id = { $ne: excludeReservationId };
    }

    const conflictingReservations = await Reservation.find(query);
    return conflictingReservations.length === 0;
  } catch (error) {
    console.error('Error checking room availability:', error);
    throw error;
  }
};


/**
 * Get all booked dates for a room
 * @param {string} roomId - The room ID
 * @returns {Promise<Array>} - Array of booked date ranges
 */
const getBookedDates = async (roomId) => {
	try {
		console.log('=== getBookedDates utility function START ===');
		console.log('Fetching reservations for roomId:', roomId);
		
		const reservations = await Reservation.find({
			room_id: roomId,
			deleted: false,
			status: 'approved' // Only show approved reservations as booked on calendar
		}).select('start_date end_date status');

		console.log('Found reservations:', reservations.length);
		console.log('Reservations data:', reservations);

		const bookedRanges = reservations.map(reservation => ({
			start_date: reservation.start_date,
			end_date: reservation.end_date,
			status: reservation.status
		}));

		console.log('Mapped booked ranges:', bookedRanges);
		console.log('=== getBookedDates utility function END ===');

		return bookedRanges;
	} catch (error) {
		console.error('=== ERROR in getBookedDates utility ===');
		console.error('Error details:', error);
		console.error('Error message:', error.message);
		console.error('Error stack:', error.stack);
		throw error;
	}
};

/**
 * Convert date ranges to individual date strings for frontend calendar
 * @param {Array} dateRanges - Array of date range objects
 * @returns {Array} - Array of date strings in YYYY-MM-DD format
 */
const convertRangesToDateStrings = (dateRanges) => {
	try {
		console.log('=== convertRangesToDateStrings START ===');
		console.log('Input date ranges:', dateRanges);
		
		const dateStrings = [];
		
		dateRanges.forEach((range) => {
			const startDate = new Date(range.start_date);
			const endDate = new Date(range.end_date);
			
			console.log('Processing range:', {
				start: startDate.toISOString().split('T')[0],
				end: endDate.toISOString().split('T')[0]
			});
			
			// Include all dates from start_date to end_date (excluding checkout day)
			for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
				const dateString = date.toISOString().split('T')[0];
				dateStrings.push(dateString);
			}
		});
		
		// Remove duplicates
		const uniqueDateStrings = [...new Set(dateStrings)];
		console.log('Final date strings:', uniqueDateStrings);
		console.log('=== convertRangesToDateStrings END ===');
		
		return uniqueDateStrings;
	} catch (error) {
		console.error('Error converting ranges to date strings:', error);
		return [];
	}
};

/**
 * Calculate the number of nights between two dates
 * @param {Date} startDate - Check-in date
 * @param {Date} endDate - Check-out date
 * @returns {number} - Number of nights
 */
const calculateNights = (startDate, endDate) => {
	const start = new Date(startDate);
	const end = new Date(endDate);
	const diffTime = Math.abs(end - start);
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	return diffDays;
};

/**
 * Calculate total price for a reservation
 * @param {number} pricePerNight - Room price per night
 * @param {Date} startDate - Check-in date
 * @param {Date} endDate - Check-out date
 * @returns {number} - Total price
 */
const calculateTotalPrice = (pricePerNight, startDate, endDate) => {
	const nights = calculateNights(startDate, endDate);
	return pricePerNight * nights;
};

module.exports = {
	isRoomAvailable,
	getBookedDates,
	convertRangesToDateStrings,
	calculateNights,
	calculateTotalPrice
};