import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Name is required' },
      len: { args: [2, 100], msg: 'Name must be between 2 and 100 characters' },
    },
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: { msg: 'Email already registered' },
    validate: {
      isEmail: { msg: 'Please provide a valid email' },
    },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      // Custom validator that skips length checks when password is null
      // (Google-only accounts have no password).  Do NOT assign a pre-hashed
      // value directly — the validation would pass incorrectly.
      passwordLength(value) {
        if (value !== null && value !== undefined && value.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
      },
    },
  },
  google_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
  },
  refresh_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  reset_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  reset_token_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('faculty', 'student'),
    allowNull: false,
    defaultValue: 'student',
  },
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['email'] },
    { unique: true, fields: ['google_id'] },
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
  },
});

User.prototype.comparePassword = async function (candidatePassword) {
  // Google-only accounts have no password — always return false.
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toSafeObject = function () {
  const { id, name, email, role, createdAt } = this;
  return { id, name, email, role, createdAt };
};

export default User;
