import sequelize from '../config/database.js';
import User from './User.js';
import Student from './Student.js';
import Subject from './Subject.js';
import Attendance from './Attendance.js';
import Mark from './Mark.js';

User.hasOne(Student, { foreignKey: 'user_id', as: 'studentProfile', onDelete: 'CASCADE' });
Student.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Subject, { foreignKey: 'faculty_id', as: 'subjects' });
Subject.belongsTo(User, { foreignKey: 'faculty_id', as: 'faculty' });

Student.hasMany(Attendance, { foreignKey: 'student_id', as: 'attendances', onDelete: 'CASCADE', hooks: true });
Attendance.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

Subject.hasMany(Attendance, { foreignKey: 'subject_id', as: 'attendances', onDelete: 'CASCADE', hooks: true });
Attendance.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' });

Student.hasMany(Mark, { foreignKey: 'student_id', as: 'marks', onDelete: 'CASCADE', hooks: true });
Mark.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

Subject.hasMany(Mark, { foreignKey: 'subject_id', as: 'marks', onDelete: 'CASCADE', hooks: true });
Mark.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' });

export { sequelize, User, Student, Subject, Attendance, Mark };
