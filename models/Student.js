import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  enrollment_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: { msg: 'Enrollment number already exists' },
    validate: {
      notEmpty: { msg: 'Enrollment number is required' },
    },
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'students',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['user_id'] },
    { unique: true, fields: ['enrollment_no'] },
  ],
});

export default Student;
