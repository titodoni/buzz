# Friend search matches emails exactly, never partially

Emails live in `auth.users`, which clients cannot read, so search runs through the security-definer function `search_users(q)`. It matches **Display Names by substring** but **emails only by exact, case-insensitive match**, and it never returns the email. Partial email matching (what Requirement 3.1 literally asks for) would let any signed-in user probe for other people's addresses, which conflicts with the product rule of no stranger discovery beyond a direct friend request.
