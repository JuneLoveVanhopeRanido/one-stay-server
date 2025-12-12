const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
	user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
	start_date: { type: Date, required: true },
	end_date: { type: Date, required: true },
	total_price: { type: Number, required: true },
	status: { 
		type: String, 
		enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'], 
		default: 'pending' 
	},
	createdAt: { type: Date, default: Date.now },
	deleted: { type: Boolean, default: false },
	reason: { type: String },
});

module.exports = mongoose.model('Reservation', reservationSchema);
