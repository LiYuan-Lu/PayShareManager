import { matchSorter } from "match-sorter";
// @ts-expect-error - no types, but it's a tiny function
import sortBy from "sort-by";
import type { DataRepositories } from "./repositories/types";

export type FriendMutation = {
  uniqueId?: string;
  name: string;
  email: string;
};

export type FriendUsage = {
  groupCount: number;
  paymentCount: number;
};

let repositories: DataRepositories | null = null;

async function getRepositories() {
  if (!repositories) {
    const { getRepositories } = await import("./repositories/index.server.js");
    repositories = getRepositories();
  }
  return repositories;
}

export async function getFriends(ownerUserId: string, query?: string | null) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const repository = await getRepositories();
  let friends = await repository.getFriends(ownerUserId);
  if (query) {
    friends = matchSorter(friends, query, {
      keys: ["name", "description"],
    });
  }
  return friends.sort(sortBy("name", "createdAt"));
}

export async function createEmptyFriend(ownerUserId: string) {
  const repository = await getRepositories();
  return repository.createFriend(ownerUserId, {name: "", email: ""});
}

export async function createFriend(ownerUserId: string, values: FriendMutation) {
  const repository = await getRepositories();
  return repository.createFriend(ownerUserId, values);
}

export async function getFriend(ownerUserId: string, uniqueId: string) {
  const repository = await getRepositories();
  const friend = await repository.getFriend(ownerUserId, uniqueId); 
  if (!friend) {
    console.log(`No friend found for ${uniqueId}`);
  }
  return friend;
}

export async function updateFriend(ownerUserId: string, uniqueId: string, updates: FriendMutation) {
  const repository = await getRepositories();
  return repository.updateFriend(ownerUserId, uniqueId, updates);
}

export async function deleteFriend(ownerUserId: string, uniqueId: string) {
  const repository = await getRepositories();
  const usage = await repository.getFriendUsage(ownerUserId, uniqueId);
  if (usage.groupCount > 0 || usage.paymentCount > 0) {
    throw new Error("This friend is already used in groups or payments and cannot be deleted.");
  }
  await repository.deleteFriend(ownerUserId, uniqueId);
}

export async function getFriendUsage(ownerUserId: string, uniqueId: string) {
  const repository = await getRepositories();
  return repository.getFriendUsage(ownerUserId, uniqueId);
}
