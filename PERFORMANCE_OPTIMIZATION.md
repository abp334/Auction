# Performance Optimization Guide

This document explains the performance optimizations implemented to prevent UI freezing and improve database query performance.

## Problem

When hosted, the application experienced delays in database operations causing the UI to freeze until data was fetched or sent.

## Solutions Implemented

### 1. **Optimistic UI Updates** ✅

- **What it does**: Updates the UI immediately before server confirmation
- **Benefits**: Users see instant feedback, no waiting for server response
- **Implementation**:
  - Bidding updates UI immediately, reverts on error
  - Skip updates UI immediately, reverts on error
  - Undo updates UI immediately, reverts on error

### 2. **Database Query Optimization** ✅

- **Selective Field Fetching**: Using `.select()` to fetch only needed fields
- **Lean Queries**: Using `.lean()` for read-only operations (faster, no Mongoose overhead)
- **Examples**:

  ```typescript
  // Before: Fetches all fields
  const auction = await Auction.findById(id);

  // After: Only fetch needed fields
  const auction = await Auction.findById(id).select(
    "state currentBid currentPlayerId"
  );
  ```

### 3. **Database Indexes** ✅

- **Auction Model**:

  - `roomCode` (indexed for fast lookups)
  - `state` (indexed for filtering active auctions)
  - `currentPlayerId` (indexed for current player lookups)
  - Compound indexes: `{ state: 1, roomCode: 1 }`, `{ state: 1, currentPlayerId: 1 }`

- **Player Model**:
  - `teamId` (indexed for filtering unsold players)
  - Compound index: `{ teamId: 1, _id: 1 }`

### 4. **MongoDB Connection Pooling** ✅

- **Connection Pool**: Maintains 5-10 active connections
- **Timeouts**: Optimized for faster connection handling
- **Configuration**:
  ```typescript
  maxPoolSize: 10, // Up to 10 connections
  minPoolSize: 5,  // At least 5 connections
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  bufferCommands: false, // Disable buffering
  ```

### 5. **Loading States** ✅

- **What it does**: Shows loading indicators on buttons during operations
- **Benefits**: Users know the system is working, prevents multiple clicks
- **Implementation**:
  - `isBidding` state for bid button
  - `isSkipping` state for skip button
  - `isUndoing` state for undo button
  - Buttons disabled during operations

### 6. **Server-Side Timer Synchronization** ✅

- **What it does**: Timer runs on server, broadcasts to all clients
- **Benefits**: No client-side timer calculations, all clients synchronized
- **Reduces**: Client-side processing overhead

## Performance Improvements

### Query Optimization Examples

**Before:**

```typescript
// Fetches entire document
const auction = await Auction.findById(id);
const team = await Team.findById(teamId);
const player = await Player.findById(playerId);
```

**After:**

```typescript
// Only fetch needed fields
const auction = await Auction.findById(id).select(
  "state currentBid currentPlayerId"
);
const team = await Team.findById(teamId).select("wallet name id");
const player = await Player.findById(playerId).select("name id");
```

**For read-only operations:**

```typescript
// Use lean() for faster queries (no Mongoose document overhead)
const auctions = await Auction.find(filter).lean();
const teams = await Team.find().sort({ name: 1 }).lean();
```

## Expected Performance Gains

- **Query Speed**: 30-50% faster with selective field fetching
- **Memory Usage**: 40-60% reduction with lean queries
- **UI Responsiveness**: Instant feedback with optimistic updates
- **Connection Efficiency**: Better connection pooling reduces latency

## Best Practices

### When to Use `.select()`

- Always use `.select()` when you only need specific fields
- Reduces network transfer and memory usage
- Example: `Team.findById(id).select("wallet name")`

### When to Use `.lean()`

- Use `.lean()` for read-only operations
- Returns plain JavaScript objects (faster)
- Don't use if you need to modify and save the document
- Example: `Auction.find().lean()`

### When to Use Optimistic Updates

- Use for user actions that need immediate feedback
- Always revert on error
- Examples: Bidding, skipping, undoing

### Database Indexes

- Index frequently queried fields
- Use compound indexes for common query patterns
- Monitor query performance and add indexes as needed

## Monitoring

### Check Query Performance

1. Enable MongoDB query logging in development
2. Monitor slow queries (>100ms)
3. Add indexes for slow queries
4. Use MongoDB Atlas Performance Advisor

### Monitor Connection Pool

```typescript
// Check connection pool status
console.log(mongoose.connection.readyState);
console.log(mongoose.connection.db?.serverConfig?.poolSize);
```

## Additional Optimizations (Future)

1. **Redis Caching**: Cache frequently accessed data (auctions, teams)
2. **Query Result Caching**: Cache auction state for 1-2 seconds
3. **Pagination**: For large lists (players, teams)
4. **CDN**: For static assets (player photos, team logos)
5. **Database Replication**: Read replicas for read-heavy operations

## Troubleshooting

### If queries are still slow:

1. Check MongoDB Atlas cluster tier (upgrade if needed)
2. Verify indexes are being used (`explain()` queries)
3. Check network latency to MongoDB
4. Consider using MongoDB Atlas connection string with SRV

### If UI still freezes:

1. Check if optimistic updates are working
2. Verify loading states are showing
3. Check network tab for slow requests
4. Consider debouncing rapid actions

---

**Note**: These optimizations are production-ready and should significantly improve performance when hosted. The combination of optimistic UI updates, query optimization, and connection pooling should eliminate most UI freezing issues.
