import { useState } from 'react';
import { TransactionsPanel } from './features/transactions/TransactionsPanel';
import { UsersTable } from './features/users/UsersTable';
import type { User } from './types';

/**
 * Page layout and the one piece of shared state: which user is selected.
 * Each panel owns its own data loading, paging and sorting.
 */
export function App() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Clicking the selected user again closes their transactions.
  const toggleUser = (user: User) => {
    setSelectedUser((current) => (current?.id === user.id ? null : user));
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Users &amp; Transactions</h1>
        <p className="text-sm text-slate-600">Select a user to see their transactions.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <UsersTable selectedUserId={selectedUser?.id} onSelectUser={toggleUser} />
        {selectedUser ? (
          <TransactionsPanel key={selectedUser.id} user={selectedUser} onClose={() => setSelectedUser(null)} />
        ) : (
          <aside className="hidden rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 lg:block">
            No user selected
          </aside>
        )}
      </div>
    </main>
  );
}
