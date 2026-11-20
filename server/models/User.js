import { DataTypes } from 'sequelize';

export default function defineUser(sequelize) {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
    },
    role: {
      type: DataTypes.ENUM('MANAGER', 'DEVELOPER'),
      allowNull: false,
      defaultValue: 'DEVELOPER',
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'APPROVED',
    },
    developerCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      field: 'developer_code',
      comment: 'Unique ID assigned by Manager for login',
    },
    managerId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'manager_id',
    },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  User.associate = (models) => {
    // Developers reporting to a Manager
    User.hasMany(models.User, { foreignKey: 'manager_id', as: 'developers' });
    User.belongsTo(models.User, { foreignKey: 'manager_id', as: 'manager' });
    User.hasMany(models.MonitoredEndpoint, { foreignKey: 'user_id', as: 'endpoints', onDelete: 'CASCADE' });
  };

  return User;
}
