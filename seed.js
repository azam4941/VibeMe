const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://localhost:27017/rentme';

const userSchema = new mongoose.Schema({
  phoneNumber: String,
  name: String,
  bio: String,
  interests: [String],
  location: String,
  profilePhoto: String,
  isVerified: Boolean,
  rentMode: Boolean,
  pricePerMinute: Number,
  rating: Number,
  totalSessions: Number,
  currentStatus: String,
  availability: Array,
  isAdmin: Boolean,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const names = [
  'Arun Kumar', 'Priya Singh', 'Rahul Sharma', 'Ananya Gupta', 'Vikram Malik',
  'Sanya Verma', 'Amit Patel', 'Sneha Reddy', 'Rohan Das', 'Ishani Bose',
  'Karan Johar', 'Meera Iyer', 'Sumit Negi', 'Tanvi Shah', 'Aditya Rao',
  'Pooja Mishra', 'Deepak Singh', 'Kavita Roy', 'Harsh Vardhan', 'Shreya Jain'
];

const interestsPool = [
  'Technology', 'Music', 'Gaming', 'Fitness', 'Art', 'Business', 'Cooking', 
  'Travel', 'Photography', 'Writing', 'Languages', 'Yoga', 'Stocks'
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Deleting old test users (except the admin Azam if exists)
  // await User.deleteMany({ isAdmin: { $ne: true } });

  const users = [];
  for (let i = 0; i < 20; i++) {
    const isVerified = Math.random() > 0.4;
    const rentMode = Math.random() > 0.3;
    const phone = '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
    
    users.push({
      phoneNumber: phone,
      name: names[i] || `Test User ${i+1}`,
      bio: `Professional ${interestsPool[Math.floor(Math.random() * interestsPool.length)]} enthusiast with 5+ years of experience. Happy to share my time!`,
      interests: [
        interestsPool[Math.floor(Math.random() * interestsPool.length)],
        interestsPool[Math.floor(Math.random() * interestsPool.length)]
      ].filter((v, i, a) => a.indexOf(v) === i),
      location: 'New Delhi, India',
      profilePhoto: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).substring(7)}`,
      isVerified: isVerified,
      rentMode: rentMode,
      pricePerMinute: rentMode ? Math.floor(10 + Math.random() * 90) : 0,
      rating: 4 + Math.random(),
      totalSessions: Math.floor(Math.random() * 50),
      currentStatus: 'online',
      availability: [
        { day: 'monday', startTime: '09:00', endTime: '18:00' },
        { day: 'wednesday', startTime: '10:00', endTime: '17:00' }
      ],
      isAdmin: false
    });
  }

  await User.insertMany(users);
  console.log('Successfully seeded 20 profiles');
  process.exit();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
