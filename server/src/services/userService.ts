import type { Transaction, TransactionSortField, User, UserSortField } from '../types';
import { NotFoundError } from '../errors/AppError';
import { toPage, type ListQuery, type Page } from '../pagination';
import type { TransactionRepository } from '../repositories/transactionRepository';
import type { UserRepository } from '../repositories/userRepository';

/**
 * Use cases for users. This layer holds the rules that are neither HTTP nor SQL,
 * e.g. "asking for a missing user's transactions is an error, not an empty list".
 * It is deliberately thin today; it is where authorization/tenant checks would go.
 */
export interface UserService {
  listUsers(query: ListQuery<UserSortField>): Page<User>;
  getUser(id: number): User;
  listTransactionsForUser(userId: number, query: ListQuery<TransactionSortField>): Page<Transaction>;
}

export function createUserService(deps: {
  users: UserRepository;
  transactions: TransactionRepository;
}): UserService {
  const { users, transactions } = deps;

  const getUser = (id: number): User => {
    const user = users.findById(id);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    return user;
  };

  return {
    listUsers: (query) => toPage(users.findPage(query), query),
    getUser,
    listTransactionsForUser: (userId, query) => {
      // Distinguishes "unknown user" (404) from "user with no transactions" (empty page).
      getUser(userId);
      return toPage(transactions.findPageByUserId(userId, query), query);
    },
  };
}
