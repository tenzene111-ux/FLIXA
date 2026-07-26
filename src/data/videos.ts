export type VideoPost = {
  id: string;
  username: string;
  caption: string;
  song: string;
  likes: string;
  comments: string;
  shares: string;
  avatar: string;
  gradient: readonly [string, string];
};

export const videos: VideoPost[] = [
  {
    id: '1',
    username: '@sarah.dreams',
    caption: 'City lights and late nights. #nightvibes #citylife',
    song: 'Midnight Skies — Ovyy',
    likes: '128.7K',
    comments: '1,234',
    shares: '12.6K',
    avatar: 'https://i.pravatar.cc/100?img=32',
    gradient: ['#2B1055', '#7597DE'],
  },
  {
    id: '2',
    username: '@alexcartermusic',
    caption: 'New song out now 🎵 studio session behind the scenes',
    song: 'Neon Heart — Alex Carter',
    likes: '95.2K',
    comments: '842',
    shares: '5.1K',
    avatar: 'https://i.pravatar.cc/100?img=12',
    gradient: ['#41295a', '#2F0743'],
  },
  {
    id: '3',
    username: '@luna.lights',
    caption: 'Summer vibes only ☀️ #SummerVibes #GoodEnergy',
    song: 'Golden Hour — Ovyy',
    likes: '243.9K',
    comments: '3,021',
    shares: '18.4K',
    avatar: 'https://i.pravatar.cc/100?img=45',
    gradient: ['#FF9A8B', '#FF6A88'],
  },
  {
    id: '4',
    username: '@kane.pixels',
    caption: 'Dance challenge attempt #4 😅 #DanceChallenge',
    song: 'Good Energy — Kane Pixels',
    likes: '87.3K',
    comments: '612',
    shares: '4.4K',
    avatar: 'https://i.pravatar.cc/100?img=15',
    gradient: ['#0F2027', '#2C5364'],
  },
];

export default videos;
