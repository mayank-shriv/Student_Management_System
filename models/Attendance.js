import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  },
  subject_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true,
  },
  date: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    required: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

attendanceSchema.index({ student_id: 1, subject_id: 1, date: 1 }, { unique: true });

attendanceSchema.virtual('student', {
  ref: 'Student',
  localField: 'student_id',
  foreignField: '_id',
  justOne: true,
});

attendanceSchema.virtual('subject', {
  ref: 'Subject',
  localField: 'subject_id',
  foreignField: '_id',
  justOne: true,
});

export default mongoose.model('Attendance', attendanceSchema);
