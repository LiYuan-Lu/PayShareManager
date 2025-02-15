import { matchSorter } from "match-sorter";
// @ts-expect-error - no types, but it's a tiny function
import sortBy from "sort-by";
import invariant from "tiny-invariant";
import { v4 as uuidv4 } from 'uuid';

export type FriendMutation = {
  uniqueId?: string;
  name: string;
  email: string;
};

const fakeFriends = {
  records: {} as Record<string, FriendMutation>,

  async getAll(): Promise<FriendMutation[]> {
    return Object.keys(fakeFriends.records)
      .map((key) => fakeFriends.records[key])
      .sort(sortBy("-createdAt", "name"));
  },

  async get(id: string): Promise<FriendMutation | null> {
    return fakeFriends.records[id] || null;
  },

  async getUniqueId(): Promise<string> {
    let uniqueId = '';
    do {
      uniqueId = uuidv4();
    } 
    while(uniqueId in fakeFriends.records);

    return uniqueId;
  },

  async create(values: FriendMutation): Promise<FriendMutation> {
    const uniqueId = await this.getUniqueId();
    const createdAt = new Date().toISOString();
    const newFriend = { uniqueId, createdAt, ...values };
    fakeFriends.records[uniqueId] = newFriend;
    return newFriend;
  },

  async set(uniqueId: string, values: FriendMutation): Promise<FriendMutation> {
    const friend = await fakeFriends.get(uniqueId);
    invariant(friend, `No friend found for ${uniqueId}`);
    const updatedFriend = { ...friend, ...values };
    fakeFriends.records[uniqueId] = updatedFriend;
    return updatedFriend;
  },

  destroy(uniqueId: string): null {
    delete fakeFriends.records[uniqueId];
    return null;
  },
};

export async function getFriends(query?: string | null) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  let friends = await fakeFriends.getAll();
  if (query) {
    friends = matchSorter(friends, query, {
      keys: ["name", "description"],
    });
  }
  return friends.sort(sortBy("name", "createdAt"));
}

export async function createEmptyFriend() {
  const friend = await fakeFriends.create({name: "", email: ""});
  return friend;
}

export async function getFriend(uniqueId: string) {
  const friend = await fakeFriends.get(uniqueId); 
  if (!friend) {
    console.log(`No friend found for ${uniqueId}`);
  }
  return fakeFriends.get(uniqueId);
}

export async function updateFriend(uniqueId: string, updates: FriendMutation) {
  const friend = await fakeFriends.get(uniqueId);
  if (!friend) {
    throw new Error(`No friend found for ${uniqueId}`);
  }
  const updatedFriend = { ...friend, ...updates };
  await fakeFriends.set(uniqueId, updatedFriend);
  return friend;
}

export async function deleteFriend(uniqueId: string) {
  fakeFriends.destroy(uniqueId);
}

[
  {
    name: "Friend 1",
    email: "test@test.com"
  },
  {
    name: "Friend 2",
    email: "test@test.com"
  },
  {
    name: "Friend 3",
    email: "test@test.com"
  },
].forEach((friend) => {
  fakeFriends.create({
    ...friend,
  });
});