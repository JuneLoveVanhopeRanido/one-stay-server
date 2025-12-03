const mongoose = require('mongoose');
const Counter = require('./counter-model');

const roomSchema = new mongoose.Schema({
	resort_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Resort', required: true },
	room_type: { type: String, required: true },
	capacity: { type: Number, required: true },
	price_per_night: { type: Number, required: true },
	status: { type: String, required: true }, // e.g. 'available', 'booked', etc.
	description:{ type: String},
	image: {type: String},
	createdAt: { type: Date, default: Date.now },
	deleted: { type: Boolean, default: false },
	room_number: { type: Number, unique: true },
});

roomSchema.pre('save', async function (next) {
  if (this.room_number) return next();

  try {
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'room_number' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    this.room_number = counter.seq;
    next();
  } catch (err) {
    next(err);
  }
});


module.exports = mongoose.model('Room', roomSchema);
