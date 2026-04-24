import { matchSorter } from "match-sorter";
// @ts-expect-error - no types, but it's a tiny function
import sortBy from "sort-by";
import type { DataRepositories } from "./repositories/types";

export type FriendMutation = {
  uniqueId?: string;
  name: string;
  email: string;
};

let repositories: DataRepositories | null = null;

async function getRepositories() {
  if (!repositories) {
    const { getRepositories } = await import("./repositories/index.server.js");
    repositories = getRepositories();
  }
  return repositories;
}

export async function getFriends(query?: string | null) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const repository = await getRepositories();
  let friends = await repository.getFriends();
  if (query) {
    friends = matchSorter(friends, query, {
      keys: ["name", "description"],
    });
  }
  return friends.sort(sortBy("name", "createdAt"));
}

export async function createEmptyFriend() {
  const repository = await getRepositories();
  return repository.createFriend({name: "", email: ""});
}

export async function getFriend(uniqueId: string) {
  const repository = await getRepositories();
  const friend = await repository.getFriend(uniqueId); 
  if (!friend) {
    console.log(`No friend found for ${uniqueId}`);
  }
  return friend;
}

export async function updateFriend(uniqueId: string, updates: FriendMutation) {
  const repository = await getRepositories();
  return repository.updateFriend(uniqueId, updates);
}

export async function deleteFriend(uniqueId: string) {
  const repository = await getRepositories();
  await repository.deleteFriend(uniqueId);
}
