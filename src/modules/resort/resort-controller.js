const Resort = require('../../models/resort-model');
const Room = require('../../models/room-model');
const Feedback = require('../../models/feedback-model');
const { uploadImage, deleteImage, extractPublicId } = require('../../utils/cloudinary');
const { isRoomAvailable } = require('../../utils/dateAvailability');

// Create a resort
exports.createResort = async (req, res) => {
	try {
		const { resort_name, description } = req.body;
		const owner_id = req.user._id; // Get owner ID from authenticated user
		
		// Parse location from JSON string if it exists
		let location;
		try {
			location = typeof req.body.location === 'string' 
				? JSON.parse(req.body.location) 
				: req.body.location;
		} catch (parseError) {
			console.error('Location parse error:', parseError);
			return res.status(400).json({ message: 'Invalid location data format.' });
		}

		// Validate required location fields
		if (!location || !location.address || !location.latitude || !location.longitude) {
			return res.status(400).json({ 
				message: 'Location with address, latitude, and longitude is required.' 
			});
		}
		
		let imageUrl = null;
		
		// Handle image upload if file is provided
		if (req.file) {
			try {
				const uploadResult = await uploadImage(req.file.buffer, {
					public_id: `resort_${owner_id}_${Date.now()}`
				});
				imageUrl = uploadResult.secure_url;
			} catch (uploadError) {
				console.error('Image upload error:', uploadError);
				return res.status(400).json({ message: 'Image upload failed. Please try again.' });
			}
		}
		
		const resort = new Resort({ 
			owner_id, 
			resort_name, 
			location, 
			description, 
			image: imageUrl 
		});
		await resort.save();
		res.status(201).json(resort);
	} catch (err) {
		console.error('Create resort error:', err);
		res.status(500).json({ message: 'Server error.' });
	}
};


// Get all resorts (excluding soft deleted)
exports.getAllResorts = async (req, res) => {
	try {
		const resorts = await Resort.find({ deleted: false });
		res.json(resorts);
	} catch (err) {
		res.status(500).json({ message: 'Server error.' });
	}
};

// Get featured resorts with enhanced data (rating, reviews, price)
exports.getFeaturedResorts = async (req, res) => {
	try {
		const resorts = await Resort.find({ deleted: false }).lean();
		
		// Enhance each resort with aggregated data
		const enhancedResorts = await Promise.all(
			resorts.map(async (resort) => {
				
				// Get lowest room price
				const rooms = await Room.find({ 
					resort_id: resort._id,
					deleted: false 
				}).sort({ price_per_night: 1 }).limit(1);
				
				const lowestPrice = rooms.length > 0 ? rooms[0].price_per_night : 0;
				
				// Get available rooms count
				const availableRoomsCount = await Room.countDocuments({
					resort_id: resort._id,
					status: 'available',
					deleted: false
				});


				// Get all rooms for this resort
						const all_rooms = await Room.find({ 
							resort_id: resort._id, 
							deleted: false 
						});
				
						if (all_rooms.length === 0) {
							return res.status(404).json({ 
								success: false, 
								message: 'Resort not found or has no rooms' 
							});
						}
				
						const roomIds = all_rooms.map(room => room._id);
				
						// Get all feedbacks for rooms in this resort (customer_to_owner only for resort rating)
						const feedbacks = await Feedback.find({
							room_id: { $in: roomIds },
							feedback_type: 'customer_to_owner',
							deleted: false
						});
				
						// Calculate average rating
						let averageRating = 0;
						if (feedbacks.length > 0) {
							const totalRating = feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
							averageRating = (totalRating / feedbacks.length).toFixed(2);
						}
				
				return {
					...resort,
					rating: averageRating,
					price_per_night: lowestPrice,
					available_rooms: availableRoomsCount
				};
			})
		);
		
		// Sort by rating (highest first), then by creation date (newest first)
		enhancedResorts.sort((a, b) => {
			if (b.rating !== a.rating) {
				return b.rating - a.rating;
			}
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
		
		res.json(enhancedResorts);
	} catch (err) {
		console.error('Get featured resorts error:', err);
		res.status(500).json({ message: 'Server error.' });
	}
};

exports.getAvailableResorts = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    const resorts = await Resort.find({ deleted: false }).select("_id");

    const availableResortIds = [];

    for (const resort of resorts) {
      const rooms = await Room.find({
        resort_id: resort._id,
        deleted: false,
      }).select("_id");

      let hasAvailableRoom = false;

	for (const room of rooms) {
		// skip rooms that are not available
		// if (room.status !== "available") continue;

		const isAvailable = await isRoomAvailable(
			room._id,
			startDate,
			endDate
		);

		if (isAvailable) {
			hasAvailableRoom = true;
			break; // no need to check more rooms
		}
		}

		if (hasAvailableRoom) {
			availableResortIds.push(resort._id);
		}
	}


    return res.json({
      resortIds: availableResortIds,
    });

  } catch (err) {
    console.error("Get available resorts error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// Search resorts by name or location (excluding soft deleted)
exports.searchResorts = async (req, res) => {
	try {
		const { q } = req.query;
		const query = {
			deleted: false,
			$or: [
				{ resort_name: { $regex: q, $options: 'i' } },
				{ 'location.address': { $regex: q, $options: 'i' } }
			]
		};
		const resorts = await Resort.find(q ? query : { deleted: false });
		res.json(resorts);
	} catch (err) {
		res.status(500).json({ message: 'Server error.' });
	}
};

// Get resort by ID
// exports.getResortById = async (req, res) => {
// 	try {
// 		const resort = await Resort.findById(req.params.id);
// 		if (!resort) return res.status(404).json({ message: 'Resort not found.' });
// 		res.json(resort);
// 	} catch (err) {
// 		res.status(500).json({ message: 'Server error.' });
// 	}
// };
exports.getResortById = async (req, res) => {
	try {
		const resort = await Resort.findOne({
			_id: req.params.id,
			deleted: false
		}).lean(); // clean JS object

		if (!resort) {
			return res.status(404).json({ message: "Resort not found." });
		}

		// Get rooms owned by this resort
		const rooms = await Room.find({ resort_id: resort._id, deleted: false })
			.select("_id room_type room_number")
			.lean();

		const roomIds = rooms.map(r => r._id);

		// Get all feedback for these rooms
		const feedbacks = await Feedback.find({
			room_id: { $in: roomIds },
			deleted: false
		})
			.populate("from_user_id", "username")
			.populate("to_user_id", "username")
			.populate("room_id", "room_type room_number")
			.lean();

		// Transform into frontend-friendly format
		const formattedFeedbacks = feedbacks.map(fb => ({
			_id: fb._id,
			rating: fb.rating,
			comment: fb.comment,
			createdAt: fb.createdAt,
			from_user: {
				_id: fb.from_user_id._id,
				username: fb.from_user_id.username
			},
			to_user: {
				_id: fb.to_user_id._id,
				username: fb.to_user_id.username
			},
			room: {
				_id: fb.room_id._id,
				room_type: fb.room_id.room_type,
				room_number: fb.room_id.room_number
			}
		}));

		res.json({
			...resort,
			feedbacks: formattedFeedbacks
		});

	} catch (err) {
		console.error("GET RESORT ERROR:", err);
		res.status(500).json({ message: "Server error." });
	}
};





// Get resort by owner ID
exports.getResortByOwnerId = async (req, res) => {
	try {
		const { owner_id } = req.params;
		const resort = await Resort.findOne({ owner_id, deleted: false });
		if (!resort) return res.status(404).json({ message: 'Resort not found for this owner.' });
		res.json(resort);
	} catch (err) {
		console.error('Get resort by owner ID error:', err);
		res.status(500).json({ message: 'Server error.' });
	}
};

// Get current owner's resort (using authenticated user)
exports.getMyResort = async (req, res) => {
	try {
		const owner_id = req.user._id; // Get owner ID from authenticated user
		const resort = await Resort.findOne({ owner_id, deleted: false });
		if (!resort) return res.status(404).json({ message: 'No resort found for your account.' });
		res.json(resort);
	} catch (err) {
		console.error('Get my resort error:', err);
		res.status(500).json({ message: 'Server error.' });
	}
};

// Update resort
exports.updateResort = async (req, res) => {
	try {
		const { resort_name, description } = req.body;
		
		// Parse location from JSON string if it exists
		let location;
		if (req.body.location) {
			try {
				location = typeof req.body.location === 'string' 
					? JSON.parse(req.body.location) 
					: req.body.location;
			} catch (parseError) {
				console.error('Location parse error:', parseError);
				return res.status(400).json({ message: 'Invalid location data format.' });
			}
		}
		
		// First, get the existing resort to check for existing image
		const existingResort = await Resort.findById(req.params.id);
		if (!existingResort) {
			return res.status(404).json({ message: 'Resort not found.' });
		}
		
		let imageUrl = existingResort.image; // Keep existing image by default
		
		// Handle new image upload if file is provided
		if (req.file) {
			try {
				// Delete old image from Cloudinary if it exists
				if (existingResort.image) {
					const oldPublicId = extractPublicId(existingResort.image);
					if (oldPublicId) {
						await deleteImage(oldPublicId);
					}
				}
				
				// Upload new image
				const uploadResult = await uploadImage(req.file.buffer, {
					public_id: `resort_${existingResort.owner_id}_${Date.now()}`
				});
				imageUrl = uploadResult.secure_url;
			} catch (uploadError) {
				console.error('Image upload error:', uploadError);
				return res.status(400).json({ message: 'Image upload failed. Please try again.' });
			}
		}
		
		// Build update object with only provided fields
		const updateData = {};
		if (resort_name) updateData.resort_name = resort_name;
		if (location) updateData.location = location;
		if (description !== undefined) updateData.description = description;
		updateData.image = imageUrl;
		
		const resort = await Resort.findByIdAndUpdate(
			req.params.id,
			updateData,
			{ new: true }
		);
		
		res.json(resort);
	} catch (err) {
		console.error('Update resort error:', err);
		res.status(500).json({ message: 'Server error.' });
	}
};

// Delete resort (soft delete)
exports.deleteResort = async (req, res) => {
	try {
		const existingResort = await Resort.findById(req.params.id);
		if (!existingResort) {
			return res.status(404).json({ message: 'Resort not found.' });
		}
		
		// Delete image from Cloudinary if it exists
		if (existingResort.image) {
			try {
				const publicId = extractPublicId(existingResort.image);
				if (publicId) {
					await deleteImage(publicId);
				}
			} catch (deleteError) {
				console.error('Error deleting image from Cloudinary:', deleteError);
				// Continue with resort deletion even if image deletion fails
			}
		}
		
		const resort = await Resort.findByIdAndUpdate(
			req.params.id,
			{ deleted: true },
			{ new: true }
		);
		
		res.json({ message: 'Resort deleted.' });
	} catch (err) {
		console.error('Delete resort error:', err);
		res.status(500).json({ message: 'Server error.' });
	}
};

// Upload/Update resort image only
exports.uploadResortImage = async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ message: 'No image file provided.' });
		}
		
		const resort = await Resort.findById(req.params.id);
		if (!resort) {
			return res.status(404).json({ message: 'Resort not found.' });
		}
		
		// Check if user owns this resort
		if (resort.owner_id.toString() !== req.user._id.toString()) {
			return res.status(403).json({ message: 'Not authorized to update this resort.' });
		}
		
		try {
			// Delete old image from Cloudinary if it exists
			if (resort.image) {
				const oldPublicId = extractPublicId(resort.image);
				if (oldPublicId) {
					await deleteImage(oldPublicId);
				}
			}
			
			// Upload new image
			const uploadResult = await uploadImage(req.file.buffer, {
				public_id: `resort_${resort.owner_id}_${Date.now()}`
			});
			
			// Update resort with new image URL
			resort.image = uploadResult.secure_url;
			await resort.save();
			
			res.json({ 
				message: 'Image uploaded successfully.',
				imageUrl: uploadResult.secure_url,
				resort: resort
			});
		} catch (uploadError) {
			console.error('Image upload error:', uploadError);
			return res.status(400).json({ message: 'Image upload failed. Please try again.' });
		}
	} catch (err) {
		console.error('Upload resort image error:', err);
		res.status(500).json({ message: 'Server error.' });
	}
};
