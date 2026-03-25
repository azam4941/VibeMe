const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017/rentme';
const USER_ID = 'mockup-user-id';

const discoverUsers = [
  {
    phoneNumber: '9000000001',
    name: 'Anjali Gupta',
    bio: 'Professional dancer. Need to vent about life? I am a great listener! ✨',
    interests: ['Yoga', 'Vent Listener', 'Emotional Support', 'Meditation'],
    location: 'Mumbai',
    rentMode: true,
    pricePerMinute: 8,
    currentStatus: 'online',
    rating: 4.9,
    totalRatingsCount: 120,
    totalSessions: 340,
    isVerified: true,
    verificationStatus: 'verified',
    profilePhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
  },
  {
    phoneNumber: '9000000002',
    name: 'Karan Mehra',
    bio: 'Startup consultant. Let\'s gossip about the tech world and timepass.',
    interests: ['Startups', 'Timepass', 'Gossip', 'Business'],
    location: 'Bangalore',
    rentMode: true,
    pricePerMinute: 15,
    currentStatus: 'online',
    rating: 4.8,
    totalRatingsCount: 85,
    totalSessions: 150,
    isVerified: true,
    verificationStatus: 'verified',
    profilePhoto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
  },
  {
    phoneNumber: '9000000003',
    name: 'Zoya Verma',
    bio: 'Travel blogger here! I offer emotional support and fun gossip! ✈️',
    interests: ['Travel', 'Emotional Support', 'Gossip', 'Vent Listener'],
    location: 'Delhi',
    rentMode: true,
    pricePerMinute: 5,
    currentStatus: 'online',
    rating: 4.7,
    totalRatingsCount: 50,
    totalSessions: 110,
    isVerified: true,
    verificationStatus: 'verified',
    profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
  }
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const users = db.collection('users');
    const notifications = db.collection('notifications');

    console.log('🌱 Starting full data seed...');

    // 1. Create/Update Mockup User with Wallet Data
    await users.updateOne(
      { _id: USER_ID },
      {
        $set: {
          name: 'Test User (Mock)',
          phoneNumber: '9876543210',
          balance: 1500.75,
          totalEarnings: 2400,
          totalSpent: 899.25,
          isAdmin: true,
          rentMode: false,
          isVerified: true,
          verificationStatus: 'verified',
          transactions: [
            { type: 'credit', amount: 1000, description: 'Bank Recharge', createdAt: new Date(Date.now() - 3600000 * 24) },
            { type: 'debit', amount: 120, description: 'Call with Anjali', createdAt: new Date(Date.now() - 3600000 * 5) },
            { type: 'credit', amount: 500, description: 'Referral Bonus', createdAt: new Date(Date.now() - 3600000 * 2) },
            { type: 'debit', amount: 50, description: 'Gift Sent', createdAt: new Date() }
          ],
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    console.log('✅ Mock User & Wallet data ready.');

    // 2. Insert Discoverable Users
    for (const u of discoverUsers) {
      await users.updateOne(
        { phoneNumber: u.phoneNumber },
        { $set: { ...u, updatedAt: new Date(), createdAt: new Date() } },
        { upsert: true }
      );
    }
    console.log('✅ Discover page users created/updated.');

    // 3. Insert Notifications
    await notifications.deleteMany({ userId: USER_ID });
    await notifications.insertMany([
      { userId: USER_ID, title: 'Payment Success', body: '₹1000 was added to your wallet successfully.', type: 'payment', isRead: false, createdAt: new Date(Date.now() - 3600000) },
      { userId: USER_ID, title: 'Welcome!', body: 'Welcome to VibeMe! Complete your profile to get started.', type: 'system', isRead: true, createdAt: new Date(Date.now() - 3600000 * 24) },
      { userId: USER_ID, title: 'Identity Verified', body: 'Your identity has been successfully verified.', type: 'verification', isRead: false, createdAt: new Date() }
    ]);
    console.log('✅ Sample notifications added.');

    console.log('\n🎉 ALL FUNCTIONS SEEDED! You can now check Discover, Wallet, and Notifications.');

  } catch (err) {
    console.error('❌ Error seeding data:', err);
  } finally {
    await client.close();
  }
}

seed();
