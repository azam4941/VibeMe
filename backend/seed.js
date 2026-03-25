const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rentme';

const demoUsers = [
  {
    phoneNumber: '9999900001',
    name: 'Priya Sharma',
    bio: 'Love deep late-night conversations. Great listener, no judgment! 🌙',
    interests: ['Gossip', 'Vent Listener', 'Late Night', 'Deep Talks'],
    location: 'Mumbai',
    rentMode: true,
    pricePerMinute: 3,
    currentStatus: 'online',
    rating: 4.9,
    totalRatingsCount: 47,
    totalSessions: 128,
    isVerified: true,
    verificationStatus: 'verified',
    isBlocked: false,
    totalEarnings: 12400,
    totalSpent: 0,
    reportCount: 0,
    blockedUsers: [],
    availability: [],
    findInterests: [],
    professionalInterests: [],
    profilePhoto: '',
    isPhotoLocked: false,
    isAdmin: false,
    bio: 'Love deep late-night conversations. Great listener 🌙',
  },
  {
    phoneNumber: '9999900002',
    name: 'Rahul Kumar',
    bio: 'Life coach & motivational speaker. Need someone to talk to? I am here.',
    interests: ['Emotional Support', 'Life Coach', 'Advice', 'Comfort'],
    location: 'Delhi',
    rentMode: true,
    pricePerMinute: 5,
    currentStatus: 'online',
    rating: 4.7,
    totalRatingsCount: 33,
    totalSessions: 89,
    isVerified: true,
    verificationStatus: 'verified',
    isBlocked: false,
    totalEarnings: 8900,
    totalSpent: 200,
    reportCount: 0,
    blockedUsers: [],
    availability: [],
    findInterests: [],
    professionalInterests: [],
    profilePhoto: '',
    isPhotoLocked: false,
    isAdmin: false,
  },
  {
    phoneNumber: '9999900003',
    name: 'Aisha Khan',
    bio: 'Funny, chill, always up for timepass! Let\'s vibe 🎧',
    interests: ['Timepass', 'Gossip', 'Late Night', 'Deep Talks'],
    location: 'Bangalore',
    rentMode: true,
    pricePerMinute: 2,
    currentStatus: 'online',
    rating: 4.8,
    totalRatingsCount: 62,
    totalSessions: 201,
    isVerified: true,
    verificationStatus: 'verified',
    isBlocked: false,
    totalEarnings: 15600,
    totalSpent: 500,
    reportCount: 0,
    blockedUsers: [],
    availability: [],
    findInterests: [],
    professionalInterests: [],
    profilePhoto: '',
    isPhotoLocked: false,
    isAdmin: false,
  },
  {
    phoneNumber: '9999900004',
    name: 'Vikram Patel',
    bio: 'Finance bro by day, gossip queen by night 💸',
    interests: ['Advice', 'Gossip', 'Timepass'],
    location: 'Pune',
    rentMode: true,
    pricePerMinute: 4,
    currentStatus: 'online',
    rating: 4.5,
    totalRatingsCount: 21,
    totalSessions: 54,
    isVerified: false,
    verificationStatus: 'none',
    isBlocked: false,
    totalEarnings: 4200,
    totalSpent: 800,
    reportCount: 0,
    blockedUsers: [],
    availability: [],
    findInterests: [],
    professionalInterests: [],
    profilePhoto: '',
    isPhotoLocked: false,
    isAdmin: false,
  },
  {
    phoneNumber: '9999900005',
    name: 'Sneha Reddy',
    bio: 'Emotional support human. Let me hold space for you 💜',
    interests: ['Emotional Support', 'Vent Listener', 'Comfort', 'Deep Talks'],
    location: 'Hyderabad',
    rentMode: true,
    pricePerMinute: 6,
    currentStatus: 'online',
    rating: 5.0,
    totalRatingsCount: 18,
    totalSessions: 42,
    isVerified: true,
    verificationStatus: 'verified',
    isBlocked: false,
    totalEarnings: 7800,
    totalSpent: 0,
    reportCount: 0,
    blockedUsers: [],
    availability: [],
    findInterests: [],
    professionalInterests: [],
    profilePhoto: '',
    isPhotoLocked: false,
    isAdmin: false,
  },
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const users = db.collection('users');

    for (const u of demoUsers) {
      const exists = await users.findOne({ phoneNumber: u.phoneNumber });
      if (!exists) {
        await users.insertOne({ ...u, createdAt: new Date(), updatedAt: new Date(), lastActiveAt: new Date(), __v: 0 });
        console.log(`✅ Created: ${u.name}`);
      } else {
        // Update existing demo user to ensure rentMode is on
        await users.updateOne({ phoneNumber: u.phoneNumber }, { $set: { rentMode: true, currentStatus: 'online', interests: u.interests, rating: u.rating, totalSessions: u.totalSessions, pricePerMinute: u.pricePerMinute, bio: u.bio, isVerified: u.isVerified } });
        console.log(`🔄 Updated: ${u.name}`);
      }
    }

    const count = await users.countDocuments({ rentMode: true });
    console.log(`\n🎉 Done! ${count} users with Rent Mode ON in the database.`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await client.close();
  }
}

seed();
