db.users.updateMany({}, { $set: { isBlocked: false, isPhotoLocked: false, rentMode: true, currentStatus: 'online' } });
print('Updated all 21 users for full visibility');
