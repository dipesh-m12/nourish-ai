// Mirrors server/src/services/companion/room.rules.ts (ROOM_ITEMS, itemName). Same order.

export const ROOM_ITEMS = [
  'rug',
  'cushion',
  'plant',
  'yarn',
  'frame',
  'lamp',
  'shelf',
  'lights',
] as const;
export type RoomItem = (typeof ROOM_ITEMS)[number];

export const ROOM_ITEM_NAME: Record<RoomItem, string> = {
  rug: 'a rug',
  cushion: 'a cushion',
  plant: 'a plant',
  yarn: 'a ball of yarn',
  frame: 'a picture',
  lamp: 'a lamp',
  shelf: 'a shelf',
  lights: 'fairy lights',
};
