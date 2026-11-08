/**
 * The assistant's how-it-works slides, shown once on first opening the chat. Art: transparent
 * WebP made from the source PNGs in assets/images/chatai (960 px wide, 60-100 KB each).
 * `aspect` is width / height of each image, so it's laid out at its true shape.
 */
export const ASSISTANT_INTRO = [
  {
    key: 'challenges',
    image: require('@/assets/images/chat/chat-1-challenges.webp'),
    aspect: 960 / 753,
    title: 'Just say it',
    body: 'Water, walks, meals, sleep: tell Nourish and it updates your challenges for you.',
  },
  {
    key: 'follow-up',
    image: require('@/assets/images/chat/chat-2-follow-up.webp'),
    aspect: 960 / 753,
    title: 'It asks what it needs',
    body: 'Missing a detail? Nourish asks, you tap an answer. No forms.',
  },
  {
    key: 'workout',
    image: require('@/assets/images/chat/chat-3-workout.webp'),
    aspect: 960 / 819,
    title: 'Workouts count too',
    body: 'Name any exercise and it works out the calories you burned.',
  },
  {
    key: 'undo',
    image: require('@/assets/images/chat/chat-4-undo.webp'),
    aspect: 960 / 753,
    title: 'You stay in charge',
    body: 'Nothing is logged until you confirm it with a photo. Changed your mind? Just say undo.',
  },
] as const;
