const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
	resort_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Resort', required: true },
	room_type: { type: String, required: true },
	capacity: { type: Number, required: true },
	price_per_night: { type: Number, required: true },
	status: { type: String, required: true }, // e.g. 'available', 'booked', etc.
	description:{ type: String},
	image: {type: String},
	createdAt: { type: Date, default: Date.now },
	deleted: { type: Boolean, default: false }
});

module.exports = mongoose.model('Room', roomSchema);
