const Reservation = require('../../models/reservation-model');
const Room = require('../../models/room-model');
const User = require('../../models/user-model');
const { isRoomAvailable, getBookedDates, convertRangesToDateStrings, calculateTotalPrice } = require('../../utils/dateAvailability');

/**
 * Check room availability for specific dates
 * GET /api/reservations/availability/:roomId?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
const checkAvailability = async (req, res) => {
	try {
		const { roomId } = req.params;
		const { start_date, end_date } = req.query;

		if (!start_date || !end_date) {
			return res.status(400).json({
				error: 'Start date and end date are required'
			});
		}

		const startDate = new Date(start_date);
		const endDate = new Date(end_date);

		// Validate room ID format
		if (!roomId || !roomId.match(/^[0-9a-fA-F]{24}$/)) {
			return res.status(400).json({
				error: 'Invalid room ID format',
				code: 'INVALID_ROOM_ID'
			});
		}

		// Check if room exists
		const room = await Room.findById(roomId).populate('resort_id');
		if (!room || room.deleted) {
			return res.status(404).json({
				error: 'Room not found or has been deleted',
				code: 'ROOM_NOT_FOUND',
				roomId: roomId
			});
		}

		// Check if resort still exists
		if (!room.resort_id) {
			return res.status(404).json({
				error: 'Room found but associated resort no longer exists',
				code: 'RESORT_NOT_FOUND',
				roomId: roomId
			});
		}

		// Check availability
		const available = await isRoomAvailable(roomId, startDate, endDate);
		
		// Calculate pricing
		const totalPrice = calculateTotalPrice(room.price_per_night, startDate, endDate);

		res.json({
			available,
			room: {
				id: room._id,
				type: room.room_type,
				capacity: room.capacity,
				price_per_night: room.price_per_night,
				resort: room.resort_id
			},
			booking_details: {
				start_date: startDate,
				end_date: endDate,
				total_price: totalPrice,
				nights: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
			}
		});
	} catch (error) {
		console.error('Error checking availability:', error);
		
		// Handle specific MongoDB errors
		if (error.name === 'CastError') {
			return res.status(400).json({
				error: 'Invalid room ID format',
				code: 'INVALID_ROOM_ID'
			});
		}
		
		res.status(500).json({
			error: 'Failed to check availability',
			code: 'SERVER_ERROR',
			details: error.message
		});
	}
};

/**
 * Get booked dates for a room
 * GET /api/reservations/booked-dates/:roomId
 */
const getBookedDatesForRoom = async (req, res) => {
	try {
		const { roomId } = req.params;
		console.log('=== getBookedDatesForRoom DEBUG START ===');
		console.log('Requested roomId:', roomId);

		// Validate room ID format
		if (!roomId || !roomId.match(/^[0-9a-fA-F]{24}$/)) {
			console.log('Invalid room ID format:', roomId);
			return res.status(400).json({
				error: 'Invalid room ID format',
				code: 'INVALID_ROOM_ID'
			});
		}
		console.log('Room ID format is valid');

		// Check if room exists
		console.log('Searching for room in database...');
		const room = await Room.findById(roomId);
		console.log('Room found:', room ? 'YES' : 'NO');
		if (room) {
			console.log('Room details:', {
				id: room._id,
				room_type: room.room_type,
				deleted: room.deleted,
				resort_id: room.resort_id
			});
		}

		if (!room || room.deleted) {
			console.log('Room not found or deleted');
			return res.status(404).json({
				error: 'Room not found or has been deleted',
				code: 'ROOM_NOT_FOUND',
				roomId: roomId
			});
		}

		// Get booked dates with fallback
		let bookedDates = [];
		console.log('Attempting to fetch booked dates...');
		try {
			console.log('Calling getBookedDates utility function...');
			const bookedRanges = await getBookedDates(roomId);
			console.log('getBookedDates returned ranges:', bookedRanges);
			
			// Convert ranges to individual date strings for frontend calendar
			console.log('Converting ranges to date strings...');
			bookedDates = convertRangesToDateStrings(bookedRanges);
			console.log('Converted to date strings:', bookedDates);
			console.log('Booked dates count:', bookedDates ? bookedDates.length : 0);
		} catch (dateError) {
			console.error('Error in getBookedDates utility:', dateError);
			console.warn('Could not fetch booked dates for room:', roomId, dateError);
			// Continue with empty array as fallback
			bookedDates = [];
		}

		console.log('Final response data:', {
			room_id: roomId,
			booked_dates: bookedDates
		});

		res.json({
			room_id: roomId,
			booked_dates: bookedDates
		});
		console.log('=== getBookedDatesForRoom DEBUG END ===');
	} catch (error) {
		console.error('=== CRITICAL ERROR in getBookedDatesForRoom ===');
		console.error('Error details:', error);
		console.error('Error message:', error.message);
		console.error('Error stack:', error.stack);
		
		// Handle specific MongoDB errors
		if (error.name === 'CastError') {
			console.log('Returning 400 - CastError');
			return res.status(400).json({
				error: 'Invalid room ID format',
				code: 'INVALID_ROOM_ID'
			});
		}
		
		console.log('Returning 500 - Server Error');
		res.status(500).json({
			error: 'Failed to get booked dates',
			code: 'SERVER_ERROR',
			details: error.message
		});
	}
};

/**
 * Create a new reservation
 * POST /api/reservations
 */
const createReservation = async (req, res) => {
	try {
		console.log('=== createReservation DEBUG START ===');
		console.log('req.body:', req.body);
		console.log('req.headers:', req.headers);
		console.log('req.user:', req.user);
		console.log('req.validatedDates:', req.validatedDates);
		
		// Safety check for req.body
		if (!req.body) {
			console.error('req.body is undefined');
			return res.status(400).json({
				error: 'Request body is missing',
				code: 'MISSING_BODY'
			});
		}

		const { room_id, start_date, end_date } = req.body;
		console.log('Destructured values:', { room_id, start_date, end_date });

		const user_id = req.user?.id; // From auth middleware
		console.log('User ID from auth:', user_id);

		if (!user_id) {
			return res.status(401).json({
				error: 'User authentication required',
				code: 'AUTH_REQUIRED'
			});
		}

		// Validate room ID format
		if (!room_id || !room_id.match(/^[0-9a-fA-F]{24}$/)) {
			console.log('Invalid room_id:', room_id);
			return res.status(400).json({
				error: 'Invalid room ID format',
				code: 'INVALID_ROOM_ID'
			});
		}

		// Get room details
		const room = await Room.findById(room_id).populate('resort_id');
		if (!room || room.deleted) {
			return res.status(404).json({
				error: 'Room not found or has been deleted',
				code: 'ROOM_NOT_FOUND',
				roomId: room_id
			});
		}

		// Check if room's resort is still active
		if (!room.resort_id || room.resort_id.deleted) {
			return res.status(404).json({
				error: 'Room found but associated resort is no longer available',
				code: 'RESORT_NOT_AVAILABLE',
				roomId: room_id
			});
		}

		const startDate = req.validatedDates.start_date;
		const endDate = req.validatedDates.end_date;

		// Check availability
		const available = await isRoomAvailable(room_id, startDate, endDate);
		if (!available) {
			return res.status(409).json({
				error: 'Room is not available for the selected dates'
			});
		}

		// Calculate total price
		const totalPrice = calculateTotalPrice(room.price_per_night, startDate, endDate);

		// Create reservation
		const reservation = new Reservation({
			user_id,
			room_id,
			start_date: startDate,
			end_date: endDate,
			total_price: totalPrice,
			status: 'pending'
		});

		await reservation.save();

		// Populate the reservation with related data
		const populatedReservation = await Reservation.findById(reservation._id)
			.populate('user_id', 'username email')
			.populate({
				path: 'room_id',
				populate: {
					path: 'resort_id',
					select: 'resort_name location'
				}
			});

		res.status(201).json({
			message: 'Reservation created successfully',
			reservation: populatedReservation
		});
	} catch (error) {
		console.error('Error creating reservation:', error);
		
		// Handle specific MongoDB errors
		if (error.name === 'CastError') {
			return res.status(400).json({
				error: 'Invalid room or user ID format',
				code: 'INVALID_ID_FORMAT'
			});
		}
		
		if (error.name === 'ValidationError') {
			return res.status(400).json({
				error: 'Validation failed',
				code: 'VALIDATION_ERROR',
				details: error.message
			});
		}
		
		res.status(500).json({
			error: 'Failed to create reservation',
			code: 'SERVER_ERROR',
			details: error.message
		});
	}
};

/**
 * Get user's reservations
 * GET /api/reservations/my-reservations
 */
const getUserReservations = async (req, res) => {
	try {
		const user_id = req.user.id;
		const { status } = req.query;

		// Build query
		const query = { user_id, deleted: false };
		if (status) {
			query.status = status;
		}

		const reservations = await Reservation.find(query)
			.populate({
				path: 'room_id',
				select: '_id room_type capacity price_per_night room_number',
				populate: {
					path: 'resort_id',
					select: 'resort_name location image'
				}
			})
			.sort({ createdAt: -1 });

		res.json({
			reservations
		});
	} catch (error) {
		console.error('Error getting user reservations:', error);
		res.status(500).json({
			error: 'Failed to get reservations'
		});
	}
};

/**
 * Get owner's reservations (for their resorts) with search, filtering, and pagination
 * GET /api/reservations/owner-reservations?status=pending&search=john&page=1&limit=10&sortBy=createdAt&sortOrder=desc
 */
const getOwnerReservations = async (req, res) => {
	try {
		const owner_id = req.user.id;
		const { 
			status, 
			search, 
			page = 1, 
			limit = 10, 
			sortBy = 'createdAt', 
			sortOrder = 'desc',
			startDate,
			endDate
		} = req.query;

		// Validate pagination parameters
		const pageNum = Math.max(1, parseInt(page) || 1);
		const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10)); // Max 100 items per page
		const skip = (pageNum - 1) * limitNum;

		// Validate sort parameters
		const validSortFields = ['createdAt', 'start_date', 'end_date', 'total_price', 'status'];
		const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
		const sortDirection = sortOrder === 'asc' ? 1 : -1;

		// First, get all rooms belonging to owner's resorts
		const rooms = await Room.find({ deleted: false })
			.populate({
				path: 'resort_id',
				match: { owner_id, deleted: false }
			});

		const ownerRoomIds = rooms
			.filter(room => room.resort_id)
			.map(room => room._id);

		if (ownerRoomIds.length === 0) {
			return res.json({
				reservations: [],
				pagination: {
					currentPage: pageNum,
					totalPages: 0,
					totalReservations: 0,
					hasNextPage: false,
					hasPrevPage: false,
					limit: limitNum
				}
			});
		}

		// Build base query for reservations
		const baseQuery = { 
			room_id: { $in: ownerRoomIds }, 
			deleted: false 
		};

		// Add status filter
		if (status && status !== 'all') {
			baseQuery.status = status.toLowerCase();
		}

		// Add date range filter
		if (startDate || endDate) {
			baseQuery.start_date = {};
			if (startDate) {
				baseQuery.start_date.$gte = new Date(startDate);
			}
			if (endDate) {
				baseQuery.start_date.$lte = new Date(endDate);
			}
		}

		// For search functionality, we need to use aggregation pipeline
		let aggregationPipeline = [
			{ $match: baseQuery },
			{
				$lookup: {
					from: 'users',
					localField: 'user_id',
					foreignField: '_id',
					as: 'user_info'
				}
			},
			{
				$lookup: {
					from: 'rooms',
					localField: 'room_id',
					foreignField: '_id',
					as: 'room_info'
				}
			},
			{
				$lookup: {
					from: 'resorts',
					localField: 'room_info.resort_id',
					foreignField: '_id',
					as: 'resort_info'
				}
			},
			{
				$unwind: { path: '$user_info', preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: '$room_info', preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: '$resort_info', preserveNullAndEmptyArrays: true }
			}
		];

		// Add search filter if provided
		if (search && search.trim()) {
			const searchRegex = { $regex: search.trim(), $options: 'i' };
			aggregationPipeline.push({
				$match: {
					$or: [
						{ 'user_info.username': searchRegex },
						{ 'user_info.email': searchRegex },
						{ 'room_info.room_type': searchRegex },
						{ 'resort_info.resort_name': searchRegex }
					]
				}
			});
		}

		// Get total count for pagination
		const countPipeline = [...aggregationPipeline, { $count: 'total' }];
		const countResult = await Reservation.aggregate(countPipeline);
		const totalReservations = countResult.length > 0 ? countResult[0].total : 0;
		const totalPages = Math.ceil(totalReservations / limitNum);

		// Add sorting, skip, and limit
		aggregationPipeline.push(
			{ $sort: { [sortField]: sortDirection } },
			{ $skip: skip },
			{ $limit: limitNum }
		);

		// Project the final structure to match the original populate format
		aggregationPipeline.push({
			$project: {
				_id: 1,
				user_id: '$user_info._id',
				room_id: '$room_info._id',
				start_date: 1,
				end_date: 1,
				total_price: 1,
				status: 1,
				createdAt: 1,
				user_id_populated: {
					_id: '$user_info._id',
					username: '$user_info.username',
					email: '$user_info.email'
				},
				room_id_populated: {
					_id: '$room_info._id',
					room_type: '$room_info.room_type',
					capacity: '$room_info.capacity',
					price_per_night: '$room_info.price_per_night',
					room_number: '$room_info.room_number',
					resort_id: {
						_id: '$resort_info._id',
						resort_name: '$resort_info.resort_name',
						location: '$resort_info.location'
					}
				}
			}
		});

		// Execute the aggregation
		const reservations = await Reservation.aggregate(aggregationPipeline);

		// Calculate pagination info
		const hasNextPage = pageNum < totalPages;
		const hasPrevPage = pageNum > 1;

		res.json({
			reservations,
			pagination: {
				currentPage: pageNum,
				totalPages,
				totalReservations,
				hasNextPage,
				hasPrevPage,
				limit: limitNum
			},
			filters: {
				status: status || 'all',
				search: search || '',
				startDate: startDate || null,
				endDate: endDate || null,
				sortBy: sortField,
				sortOrder: sortOrder
			}
		});
	} catch (error) {
		console.error('Error getting owner reservations:', error);
		res.status(500).json({
			error: 'Failed to get reservations',
			details: error.message
		});
	}
};

/**
 * Update reservation status (approve/reject)
 * PUT /api/reservations/:reservationId/status
 */
const updateReservationStatus = async (req, res) => {
	try {
		const { reservationId } = req.params;
		const { status } = req.body;
		const user_id = req.user.id;

		if (!['approved', 'rejected'].includes(status)) {
			return res.status(400).json({
				error: 'Status must be either approved or rejected'
			});
		}

		// Get reservation with room and resort details
		const reservation = await Reservation.findById(reservationId)
			.populate({
				path: 'room_id',
				populate: {
					path: 'resort_id'
				}
			});

		if (!reservation || reservation.deleted) {
			return res.status(404).json({
				error: 'Reservation not found'
			});
		}

		// Check if user is the owner of the resort
		if (reservation.room_id.resort_id.owner_id.toString() !== user_id) {
			return res.status(403).json({
				error: 'Not authorized to update this reservation'
			});
		}

		// If approving, check availability again
		if (status === 'approved') {
			const available = await isRoomAvailable(
				reservation.room_id._id,
				reservation.start_date,
				reservation.end_date,
				reservationId
			);

			if (!available) {
				return res.status(409).json({
					error: 'Room is no longer available for these dates'
				});
			}
		}

		// Update status
		reservation.status = status;
		await reservation.save();

		res.json({
			message: `Reservation ${status} successfully`,
			reservation
		});
	} catch (error) {
		console.error('Error updating reservation status:', error);
		res.status(500).json({
			error: 'Failed to update reservation status'
		});
	}
};

/**
 * Cancel reservation (customer or owner)
 * DELETE /api/reservations/:reservationId
 */
const cancelReservation = async (req, res) => {
	try {
		const { reservationId,reason } = req.params;
		const user_id = req.user.id;

		const reservation = await Reservation.findById(reservationId)
			.populate({
				path: 'room_id',
				populate: {
					path: 'resort_id'
				}
			});

		if (!reservation || reservation.deleted) {
			return res.status(404).json({
				error: 'Reservation not found'
			});
		}

		// Check if user is either the customer OR the resort owner
		const isCustomer = reservation.user_id.toString() === user_id;
		const isOwner = reservation.room_id.resort_id.owner_id.toString() === user_id;

		if (!isCustomer && !isOwner) {
			return res.status(403).json({
				error: 'Not authorized to cancel this reservation'
			});
		}

		// Different cancellation rules for customers vs owners
		if (isCustomer) {
			// Customer can only cancel pending reservations
			if (reservation.status !== 'pending') {
				return res.status(400).json({
					error: 'Only pending reservations can be cancelled by customers',
					currentStatus: reservation.status
				});
			}
		} else if (isOwner) {
			// Owner can cancel pending or approved reservations
			if (!['pending', 'approved'].includes(reservation.status)) {
				return res.status(400).json({
					error: 'Only pending or approved reservations can be cancelled by the resort owner',
					currentStatus: reservation.status
				});
			}
		}

		// Update reservation status to cancelled instead of soft delete
		reservation.status = 'cancelled';
		reservation.reason = reason
		await reservation.save();

		// Populate the response with updated reservation data
		const cancelledReservation = await Reservation.findById(reservationId)
			.populate('user_id', 'username email')
			.populate({
				path: 'room_id',
				select: 'room_type capacity price_per_night',
				populate: {
					path: 'resort_id',
					select: 'resort_name location'
				}
			});

		res.json({
			message: 'Reservation cancelled successfully',
			reservation: cancelledReservation,
			cancelledBy: isOwner ? 'owner' : 'customer'
		});
	} catch (error) {
		console.error('Error cancelling reservation:', error);
		res.status(500).json({
			error: 'Failed to cancel reservation'
		});
	}
};

/**
 * Get all reservations (for admin purposes)
 * GET /api/reservations
 */
const getAllReservations = async (req, res) => {
	try {
		const { status } = req.query;
		
		// Build query
		const query = { deleted: false };
		if (status) {
			query.status = status;
		}

		const reservations = await Reservation.find(query)
			.populate('user_id', 'username email')
			.populate({
				path: 'room_id',
				populate: {
					path: 'resort_id',
					select: 'resort_name location'
					
				}
			})
			.sort({ createdAt: -1 });

		res.json({
			reservations
		});
	} catch (error) {
		console.error('Error getting all reservations:', error);
		res.status(500).json({
			error: 'Failed to get reservations'
		});
	}
};

/**
 * Get reservation by ID
 * GET /api/reservations/:reservationId
 */
const getReservationById = async (req, res) => {
	try {
		const { reservationId } = req.params;

		const reservation = await Reservation.findOne({ _id: reservationId, deleted: false })
			.populate('user_id', 'username email')
			.populate({
				path: 'room_id',
				populate: {
					path: 'resort_id',
					select: 'resort_name location image'
				}
			});

		if (!reservation) {
			return res.status(404).json({
				error: 'Reservation not found'
			});
		}

		res.json({
			reservation
		});
	} catch (error) {
		console.error('Error getting reservation by ID:', error);
		res.status(500).json({
			error: 'Failed to get reservation'
		});
	}
};

/**
 * Mark reservation as completed (for feedback eligibility)
 * PUT /api/reservations/:reservationId/complete
 */
const completeReservation = async (req, res) => {
	try {
		console.log('=== COMPLETE RESERVATION DEBUG START ===');
		const { reservationId } = req.params;
		const user_id = req.user.id;
		console.log('Reservation ID:', reservationId);
		console.log('User ID:', user_id);

		// Get reservation with room and resort details
		const reservation = await Reservation.findById(reservationId)
			.populate({
				path: 'room_id',
				populate: {
					path: 'resort_id'
				}
			});

		console.log('Found reservation:', reservation ? 'YES' : 'NO');
		if (reservation) {
			console.log('Reservation status:', reservation.status);
			console.log('Reservation end_date:', reservation.end_date);
			console.log('Reservation deleted:', reservation.deleted);
		}

		if (!reservation || reservation.deleted) {
			console.log('ERROR: Reservation not found or deleted');
			return res.status(404).json({
				error: 'Reservation not found'
			});
		}

		// Check if user is the owner of the resort
		console.log('Resort owner ID:', reservation.room_id.resort_id.owner_id.toString());
		console.log('Current user ID:', user_id);
		console.log('Owner check:', reservation.room_id.resort_id.owner_id.toString() === user_id);
		
		if (reservation.room_id.resort_id.owner_id.toString() !== user_id) {
			console.log('ERROR: Not authorized - user is not resort owner');
			return res.status(403).json({
				error: 'Not authorized to complete this reservation'
			});
		}

		// Check if reservation is approved
		console.log('Status check - Current status:', reservation.status);
		if (reservation.status !== 'approved') {
			console.log('ERROR: Reservation status is not approved, current status:', reservation.status);
			return res.status(400).json({
				error: 'Only approved reservations can be marked as completed',
				currentStatus: reservation.status
			});
		}

		// Check if the start date has passed (reservation must have started)
		const currentDate = new Date();
		const startDate = new Date(reservation.start_date);
		const endDate = new Date(reservation.end_date);
		console.log('Date check - Current date:', currentDate.toISOString());
		console.log('Date check - Start date:', startDate.toISOString());
		console.log('Date check - End date:', endDate.toISOString());
		console.log('Date check - Has started?', currentDate >= startDate);
		
		if (currentDate < startDate) {
			console.log('ERROR: Cannot complete before start date');
			return res.status(400).json({
				error: 'Reservation cannot be completed before the start date (guest has not checked in yet)',
				startDate: reservation.start_date,
				currentDate: currentDate.toISOString()
			});
		}

		// Update reservation status to completed
		reservation.status = 'completed';
		await reservation.save();

		// Populate the response
		const completedReservation = await Reservation.findById(reservationId)
			.populate('user_id', 'username email')
			.populate({
				path: 'room_id',
				select: 'room_type capacity price_per_night',
				populate: {
					path: 'resort_id',
					select: 'resort_name location'
				}
			});

		res.json({
			message: 'Reservation marked as completed successfully',
			reservation: completedReservation,
			feedbackEligible: true
		});

	} catch (error) {
		console.error('Error completing reservation:', error);
		res.status(500).json({
			error: 'Failed to complete reservation'
		});
	}
};

/**
 * Auto-complete reservations (can be run as a cron job)
 * POST /api/reservations/auto-complete
 */
const autoCompleteReservations = async (req, res) => {
	try {
		const currentDate = new Date();
		
		// Find all approved reservations that have ended
		const reservationsToComplete = await Reservation.find({
			status: 'approved',
			end_date: { $lt: currentDate },
			deleted: false
		}).populate({
			path: 'room_id',
			populate: {
				path: 'resort_id'
			}
		});

		const completedReservations = [];

		for (const reservation of reservationsToComplete) {
			reservation.status = 'completed';
			await reservation.save();
			completedReservations.push(reservation._id);
		}

		res.json({
			message: `Auto-completed ${completedReservations.length} reservations`,
			completedCount: completedReservations.length,
			completedReservationIds: completedReservations
		});

	} catch (error) {
		console.error('Error auto-completing reservations:', error);
		res.status(500).json({
			error: 'Failed to auto-complete reservations'
		});
	}
};

module.exports = {
	checkAvailability,
	getBookedDatesForRoom,
	createReservation,
	getUserReservations,
	getOwnerReservations,
	updateReservationStatus,
	cancelReservation,
	getAllReservations,
	getReservationById,
	completeReservation,
	autoCompleteReservations
};
